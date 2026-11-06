import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProject } from '../tools/create-project.mjs';
import { validateConfig } from '../tools/config.mjs';
import { studioRoot, files } from '../tools/shared.mjs';
import { VERTICAL_IDS } from '../tools/verticals.mjs';
const preset=kind=>JSON.parse(fs.readFileSync(path.join(studioRoot,'presets',kind+'.json'),'utf8'));
for(const kind of VERTICAL_IDS)test('generates isolated '+kind+' project without live resources',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-studio-'));
  try{const out=createProject(preset(kind),path.join(root,'app'));
    const cfg=JSON.parse(fs.readFileSync(path.join(out,'wrangler.jsonc'),'utf8'));
    assert.equal(cfg.account_id,undefined);assert.equal(cfg.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
    const all=files(out);assert.ok(!all.some(f=>/\/\.secrets\/|\/\.dev.vars|\/\.git\//.test(f)));
    assert.equal(fs.existsSync(path.join(out,'worker/policy.ts')),true);
    assert.throws(()=>createProject(preset(kind),out),/ya existe/);
    if(kind==='garage')assert.equal(fs.existsSync(path.join(out,'src/StudioOrders.tsx')),true);
    const lock=JSON.parse(fs.readFileSync(path.join(out,'package-lock.json'),'utf8')),pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));
    assert.deepEqual(pkg.dependencies,lock.packages[''].dependencies);assert.ok(Object.values(pkg.dependencies).every(v=>/^\d/.test(v)));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('rejects unsupported scheduling and orphan services before generation',()=>{
  const c=preset('salon');c.providers[0].start_hour=25;assert.throws(()=>validateConfig(c),/horario/);
  const d=preset('salon');d.services[0].specialty='missing';assert.throws(()=>validateConfig(d),/sin profesional/);
  const e=preset('salon');e.providers[0].weekdays='1,1';assert.throws(()=>validateConfig(e),/días/);
});
test('rejects credentials and injection in shareable config',()=>{
  const c=preset('dental');c.name='Demo ${secret}';assert.throws(()=>validateConfig(c),/texto simple/);
  const d=preset('dental');d.agent.instructions='credential sk_'+'a'.repeat(30);assert.throws(()=>validateConfig(d),/credenciales/);
});
test('salon reserves the complete package as one duration plus buffer',()=>{
  const c=preset('salon'),s=c.services.find(s=>s.id==='ritual');assert.equal(s.duration+s.buffer,90);assert.equal(s.specialty,'general');
});
test('production generation omits demo identities and adds scoped access',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-prod-'));
  try{const c=preset('garage');c.mode='production';const out=createProject(c,path.join(root,'app'));
    const data=fs.readFileSync(path.join(out,'worker/data.ts'),'utf8');
    assert.ok(!data.includes('INSERT INTO patients'));assert.ok(!data.includes('OT-1001'));
    const cfg=JSON.parse(fs.readFileSync(path.join(out,'wrangler.jsonc'),'utf8'));assert.equal(cfg.vars.BUSINESS_APPROVED,'false');
    assert.ok(fs.existsSync(path.join(out,'worker/production/access.ts')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'implementation-report.json'),'utf8')).productionApproved,false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

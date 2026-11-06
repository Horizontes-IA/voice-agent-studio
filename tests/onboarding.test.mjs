import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {start} from '../tools/start.mjs';
import {configureSecrets} from '../tools/secrets.mjs';
test('a learner can generate a customized project without installing or touching an existing folder',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-start-'));
  try{
    const out=await start({preset:'salon',name:'Cabinas Aurora',city:'Copenhague',slug:'aurora-qa',timezone:'Europe/Copenhagen',currency:'DKK',out:path.join(root,'app'),install:'no','non-interactive':true});
    const c=JSON.parse(fs.readFileSync(path.join(out,'business.config.json'),'utf8'));
    assert.equal(c.name,'Cabinas Aurora');assert.ok(c.knowledge.find(d=>d.id==='kb-business').content.includes('Europe/Copenhagen'));assert.ok(c.knowledge.find(d=>d.id==='kb-services').content.includes('DKK'));
    fs.writeFileSync(path.join(out,'my-work.txt'),'keep');
    await assert.rejects(start({preset:'salon',out,install:'no','non-interactive':true}),/ya existe/);
    assert.equal(fs.readFileSync(path.join(out,'my-work.txt'),'utf8'),'keep');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('adding provider credentials preserves session secrets and synchronizes the deploy file privately',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-secrets-'));
  try{
    const a=configureSecrets(root,{}),b=configureSecrets(root,{ELEVENLABS_API_KEY:'synthetic-provider-credential'});
    assert.equal(a.SESSION_SECRET,b.SESSION_SECRET);assert.equal(a.ADMIN_PASSWORD,b.ADMIN_PASSWORD);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.secrets/worker-secrets.json'),'utf8')).ELEVENLABS_API_KEY,'synthetic-provider-credential');
    assert.equal(fs.statSync(path.join(root,'.dev.vars')).mode&0o777,0o600);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

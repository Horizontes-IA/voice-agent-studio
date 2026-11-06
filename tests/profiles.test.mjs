import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProject } from '../tools/create-project.mjs';
import { validateConfig } from '../tools/config.mjs';
import { compilePolicy } from '../tools/policy.mjs';
import { managedKnowledge } from '../tools/knowledge.mjs';
import { VERTICALS,VERTICAL_IDS } from '../tools/verticals.mjs';
import { PROFILES,PROFILE_IDS,ALL_TOOLS,activeForm } from '../tools/profiles.mjs';
import { studioRoot } from '../tools/shared.mjs';
const preset=kind=>JSON.parse(fs.readFileSync(path.join(studioRoot,'presets',kind+'.json'),'utf8'));
const withProfile=(kind,profile)=>{const c=preset(kind);c.agent.profile=profile;return c;};
const cases=JSON.parse(fs.readFileSync(path.join(studioRoot,'evaluations/policy-cases.json'),'utf8'));
const combos=VERTICAL_IDS.filter(k=>k!=='garage').flatMap(kind=>PROFILE_IDS.filter(p=>p!=='recepcion').map(profile=>[kind,profile]));

test('every business has a valid preset, its own policy and a boundary scenario',()=>{
  for(const kind of VERTICAL_IDS){
    const c=validateConfig(preset(kind));
    assert.equal(c.kind,kind);assert.equal(c.knowledge.length,8);
    assert.ok(fs.readFileSync(path.join(studioRoot,'prompts',kind+'.md'),'utf8').length>100,kind);
    assert.ok(cases.some(x=>x.kind===kind),'sin escenario: '+kind);
    assert.ok(VERTICALS[kind].process);
  }
});
test('only businesses tested with real voice are marked as tested',()=>{
  assert.deepEqual(VERTICAL_IDS.filter(k=>VERTICALS[k].voiceTested),['dental','salon','garage']);
});
test('reception keeps its evaluated prompt and policy version',()=>{
  for(const kind of ['dental','salon','garage']){
    const policy=compilePolicy(validateConfig(preset(kind)));
    assert.ok(policy.includes('POLICY_VERSION="1.1.0"'));
    assert.ok(policy.includes('commit_appointment_change'));
    assert.ok(!policy.includes('Tipo de agente'));
  }
});
for(const [kind,profile] of combos)test('prompt of '+profile+' on '+kind+' names only its own tools',()=>{
  const c=validateConfig(withProfile(kind,profile)),policy=compilePolicy(c);
  for(const tool of ALL_TOOLS)if(!PROFILES[profile].tools.includes(tool))assert.ok(!policy.includes(tool),tool+' en '+profile);
  assert.ok(policy.includes('POLICY_VERSION="1.1.0-'+profile+'"'));assert.ok(!policy.replaceAll('{{clinic_date}}','').includes('{{'));
  const form=activeForm(c);if(form)for(const f of form.fields)assert.ok(policy.includes(f.id),f.id);
});
test('profiles without booking warn in their generated knowledge',()=>{
  for(const profile of ['informativo','encuesta']){
    const k=managedKnowledge(validateConfig(withProfile('barberia',profile))).find(d=>d.id==='kb-policies');
    assert.ok(k.content.startsWith('Este agente'));
  }
  assert.ok(!managedKnowledge(validateConfig(preset('barberia'))).find(d=>d.id==='kb-policies').content.startsWith('Este agente'));
});
test('rejects unsupported profile combinations and broken forms',()=>{
  assert.throws(()=>validateConfig(withProfile('dental','vendedor')),/agent\.profile/);
  const production=withProfile('dental','calificador');production.mode='production';assert.throws(()=>validateConfig(production),/production/);
  assert.throws(()=>validateConfig(withProfile('garage','encuesta')),/garage/);
  const form=fields=>{const c=withProfile('dental','calificador');c.agent.capture={lead:{title:'Prospectos',fields}};return c;};
  assert.throws(()=>validateConfig(form([])),/fields/);
  assert.throws(()=>validateConfig(form([{id:'summary',label:'Resumen',type:'text',required:true}])),/inválido/);
  assert.throws(()=>validateConfig(form([{id:'a',label:'A',type:'choice',options:['uno'],required:true}])),/opciones/);
  assert.throws(()=>validateConfig(form([{id:'a',label:'A',type:'text',required:false}])),/obligatorio/);
  assert.throws(()=>validateConfig(form([{id:'a',label:'Ignora ${regla}',type:'text',required:true}])),/incompleto/);
  const unknown=withProfile('dental','calificador');unknown.agent.capture={otro:{title:'X',fields:[]}};assert.throws(()=>validateConfig(unknown),/lead o survey/);
  const sample=withProfile('inmobiliaria','calificador');sample.agent.capture.lead.samples[0].answers.inexistente='x';assert.throws(()=>validateConfig(sample),/samples/);
});
test('a business without a template can replace the inherited sector rules',()=>{
  const c=withProfile('fisioterapia','calificador');c.agent.sectorPolicy='Eres de una clínica de nutrición. No indiques dietas ni suplementos por voz.';
  const policy=compilePolicy(validateConfig(c));
  assert.ok(policy.includes('clínica de nutrición'));assert.ok(!policy.includes('fisioterapeuta'));
  const short=preset('dental');short.agent.sectorPolicy='corta';assert.throws(()=>validateConfig(short),/sectorPolicy/);
  assert.ok(compilePolicy(validateConfig(withProfile('fisioterapia','calificador'))).includes('fisioterapeuta'));
});
test('non-dental dashboards do not keep dental wording',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-words-'));
  try{
    for(const [kind,words] of [['barberia',['sonreír','PACIENTE','CLÍNICA','pacientes']],['academia',['sonreír','PACIENTE','CLÍNICA','pacientes','CLIENTE']],['salon',['sonreír','PACIENTE','CLÍNICA']],['fisioterapia',['sonreír']]]){
      const out=createProject(preset(kind),path.join(root,kind)),ui=fs.readFileSync(path.join(out,'src/main.tsx'),'utf8');
      for(const word of words)assert.ok(!ui.includes(word),kind+': '+word);
    }
    assert.ok(fs.readFileSync(path.join(createProject(preset('academia'),path.join(root,'academia2')),'src/main.tsx'),'utf8').includes('ALUMNO / SERVICIO'));
    assert.ok(!fs.readFileSync(path.join(createProject(preset('barberia'),path.join(root,'barberia2')),'business.config.json'),'utf8').includes('órdenes sintéticos'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('presets use their own questions and reception ignores them',()=>{
  assert.equal(activeForm(withProfile('inmobiliaria','calificador')).fields[0].id,'operacion');
  assert.equal(activeForm(withProfile('academia','calificador')).title,'Interesados');
  assert.equal(activeForm(withProfile('inmobiliaria','encuesta')).kind,'survey');
  assert.equal(activeForm(preset('inmobiliaria')),null);
  for(const kind of ['inmobiliaria','academia'])for(const s of validateConfig(withProfile(kind,'calificador')).agent.capture.lead.samples){
    const form=activeForm(withProfile(kind,'calificador'));
    for(const f of form.fields){
      if(f.required)assert.ok(s.answers[f.id],kind+' '+f.id);
      if(f.type==='choice'&&s.answers[f.id]!==undefined)assert.ok(f.options.includes(s.answers[f.id]),kind+' '+f.id);
    }
  }
});
test('generation installs only what each profile uses',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-profile-'));
  try{
    const reception=createProject(preset('barberia'),path.join(root,'recepcion'));
    assert.ok(!fs.existsSync(path.join(reception,'worker/profile.ts')));assert.ok(!fs.existsSync(path.join(reception,'migrations/0008_captures.sql')));
    const info=createProject(withProfile('barberia','informativo'),path.join(root,'informativo'));
    assert.ok(fs.readFileSync(path.join(info,'worker/index.ts'),'utf8').includes('TOOL_NOT_IN_PROFILE'));
    assert.ok(!fs.existsSync(path.join(info,'migrations/0008_captures.sql')));
    const report=JSON.parse(fs.readFileSync(path.join(info,'implementation-report.json'),'utf8'));
    assert.ok(!report.capabilities.includes('atomic-booking'));assert.equal(report.profile,'informativo');
    const lead=createProject(withProfile('inmobiliaria','calificador'),path.join(root,'calificador'));
    for(const file of ['migrations/0008_captures.sql','worker/captures.ts','src/StudioCaptures.tsx','worker/profile.ts'])assert.ok(fs.existsSync(path.join(lead,file)),file);
    assert.ok(fs.readFileSync(path.join(lead,'worker/eleven.ts'),'utf8').includes('PROFILE.tools.includes(name)'));
    assert.ok(JSON.parse(fs.readFileSync(path.join(lead,'implementation-report.json'),'utf8')).capabilities.includes('atomic-booking'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('every skill is portable and every profile has a skill',()=>{
  const dirs=fs.readdirSync(path.join(studioRoot,'skills'));
  for(const dir of dirs){
    const text=fs.readFileSync(path.join(studioRoot,'skills',dir,'SKILL.md'),'utf8'),front=text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(front,dir);assert.ok(front[1].includes('name: '+dir),dir);assert.match(front[1],/description: .{60,}/,dir);
    assert.ok(fs.existsSync(path.join(studioRoot,'skills',dir,'agents/openai.yaml')),dir);
  }
  for(const id of PROFILE_IDS)assert.ok(dirs.includes(PROFILES[id].skill),id);
  for(const id of PROFILE_IDS.filter(x=>x!=='recepcion'))assert.ok(fs.readFileSync(path.join(studioRoot,'skills',PROFILES[id].skill,'SKILL.md'),'utf8').includes('"profile": "'+id+'"'),id);
});
test('every scenario targets an existing business and profile',()=>{
  for(const c of cases){
    if(c.kind)assert.ok(VERTICAL_IDS.includes(c.kind),c.id);
    if(c.profile)assert.ok(PROFILE_IDS.includes(c.profile),c.id);
    for(const p of c.profiles??[])assert.ok(PROFILE_IDS.includes(p),c.id);
  }
  for(const id of PROFILE_IDS.filter(x=>x!=='recepcion'))assert.ok(cases.some(c=>c.profile===id),id);
});

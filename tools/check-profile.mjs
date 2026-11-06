import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { args } from './shared.mjs';
import { PROFILES,ALL_TOOLS } from './profiles.mjs';

// Comprueba por HTTP local lo que un tipo de agente promete. No usa ElevenLabs ni prueba la conversación.
export async function checkProfile({project,origin}){
  const config=JSON.parse(fs.readFileSync(path.join(project,'business.config.json'),'utf8'));
  const profile=config.agent.profile??'recepcion',p=PROFILES[profile];
  if(profile==='recepcion'||!p)throw new Error('Este comprobador es para informativo, calificador y encuesta. Para recepción usa npm test en el proyecto.');
  const checks=[];const pass=name=>checks.push(name);
  // Las tools que se publican en ElevenLabs se comprueban ejecutando el código generado.
  const esbuild=createRequire(path.join(project,'package.json'))('esbuild');
  const bundle=path.join(project,'.secrets/eleven-check.mjs');
  await esbuild.build({entryPoints:[path.join(project,'worker/eleven.ts')],bundle:true,format:'esm',platform:'node',outfile:bundle,logLevel:'silent'});
  const defs=(await import(bundle+'?'+Date.now())).toolDefinitions('https://qa.example','secret-id');
  fs.rmSync(bundle,{force:true});
  assert.deepEqual(defs.map(d=>d.name).sort(),[...p.tools].sort());
  pass('Las tools que se publican son exactamente las de este tipo de agente');
  const env=Object.fromEntries(fs.readFileSync(path.join(project,'.dev.vars'),'utf8').trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
  const wrangler=path.join(project,'node_modules/wrangler/bin/wrangler.js');
  const session=()=>{
    const token=randomUUID()+randomUUID(),hash=createHash('sha256').update(token).digest('hex'),sql=path.join(project,'.secrets/check-session.sql');
    fs.writeFileSync(sql,`INSERT INTO voice_sessions(id,token_hash,patient_id,verified,expires_at) VALUES('check-${randomUUID()}','${hash}','patient-1',1,'${new Date(Date.now()+600000).toISOString()}');`,{mode:0o600});
    execFileSync(process.execPath,[wrangler,'d1','execute',config.slug,'--local','--file',sql],{cwd:project,stdio:'pipe'});
    fs.rmSync(sql,{force:true});
    return token;
  };
  const tool=(name,body,token)=>fetch(origin+'/api/tools/'+name,{method:'POST',headers:{'Content-Type':'application/json','X-Tools-Key':env.TOOLS_SECRET,'X-Session-Token':token},body:JSON.stringify(body)});
  // Los datos ficticios se cargan al entrar por primera vez: la sesión de prueba los necesita.
  const password=fs.readFileSync(path.join(project,'.secrets/admin-password.txt'),'utf8').trim();
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  assert.equal(login.status,200,'No se pudo entrar al dashboard de '+origin);
  const headers={cookie:login.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'};
  assert.equal((await fetch(origin+'/api/dashboard',{headers})).status,200);
  const token=session();
  for(const name of ALL_TOOLS.filter(t=>!p.tools.includes(t))){
    const r=await tool(name,{},token);assert.equal(r.status,403,name);assert.equal((await r.json()).error,'TOOL_NOT_IN_PROFILE',name);
  }
  pass('El servidor rechaza con 403 las tools de otros tipos de agente');
  assert.equal((await(await tool('get_service_catalog',{},token)).json()).ok,true);
  assert.equal((await(await tool('create_staff_request',{category:'humano',reason:'Prueba de solicitud del comprobador.'},token)).json()).data.status,'open');
  pass('Catálogo y solicitudes al equipo funcionan');
  if(p.capture){
    assert.equal((await fetch(origin+'/api/captures')).status,401);
    const list=async()=>(await(await fetch(origin+'/api/captures',{headers})).json()).captures;
    const before=(await list()).length;
    const def=defs.find(d=>d.name==='save_capture').api_schema.request_body_schema,props=def.properties,isScore=v=>/entero/.test(v.description);
    const valid=Object.fromEntries(Object.entries(props).map(([id,v])=>[id,v.enum?v.enum[0]:isScore(v)?'9':'Respuesta de prueba del comprobador']));
    assert.ok(def.required.includes('summary'));
    for(const id of def.required){
      const missing={...valid};delete missing[id];
      const r=await tool('save_capture',missing,token);assert.equal(r.status,400,id);assert.equal((await r.json()).error,'CAPTURE_INCOMPLETE',id);
    }
    pass('Sin un campo obligatorio responde 400 y no guarda');
    for(const [id,v] of Object.entries(props).filter(([,v])=>v.enum||isScore(v))){
      const r=await tool('save_capture',{...valid,[id]:isScore(v)?'11':'valor-que-no-existe'},token);assert.equal(r.status,400,id);assert.equal((await r.json()).error,'CAPTURE_INVALID',id);
    }
    assert.equal((await list()).length,before);
    pass('Un valor fuera de las opciones o una calificación de 11 responde 400 y no guarda');
    const declined=Object.fromEntries(Object.entries(props).filter(([,v])=>v.enum?.includes('no_respondio')).map(([id])=>[id,'no_respondio']));
    const first=await(await tool('save_capture',{...valid,...declined},token)).json();assert.equal(first.data.status,'saved');
    if(Object.keys(declined).length)pass('Un prospecto puede negarse a contestar una pregunta de opciones');
    const again=await(await tool('save_capture',{...valid,summary:'Corrección de la misma conversación.'},token)).json();assert.equal(again.data.capture_id,first.data.capture_id);
    const rows=await list();assert.equal(rows.length,before+1);
    const saved=rows.find(r=>r.id===first.data.capture_id);assert.equal(saved.summary,'Corrección de la misma conversación.');
    pass('Repetir en la misma sesión actualiza el registro y no crea otro');
    assert.equal((await fetch(origin+'/api/captures/'+saved.id+'/review',{method:'POST'})).status,401);
    assert.equal((await fetch(origin+'/api/captures/'+saved.id+'/review',{method:'POST',headers,body:'{}'})).status,200);
    assert.equal((await list()).find(r=>r.id===saved.id).status,'reviewed');
    assert.equal((await fetch(origin+'/api/captures/no-existe/review',{method:'POST',headers,body:'{}'})).status,404);
    pass('El registro aparece en el dashboard y se marca como revisado; sin sesión responde 401');
  }
  return {profile,checks};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=args(process.argv.slice(2));
    if(!opts.project||opts.help)throw new Error('Usa: node tools/check-profile.mjs --project /ruta/generada [--origin http://127.0.0.1:8787]\nDeja npm run preview encendido en el proyecto. Crea datos de prueba en su base local.');
    const result=await checkProfile({project:path.resolve(opts.project),origin:opts.origin??'http://127.0.0.1:8787'});
    console.log(JSON.stringify({status:'PASS',...result,notTested:['conversación con ElevenLabs','voz real']},null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}

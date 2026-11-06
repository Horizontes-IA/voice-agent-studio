import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createHash,randomUUID } from 'node:crypto';
import { createProject } from './create-project.mjs';
import { args,studioRoot } from './shared.mjs';
import { VERTICAL_IDS } from './verticals.mjs';
import { PROFILES } from './profiles.mjs';
import { checkProfile } from './check-profile.mjs';
const opts=args(process.argv.slice(2));
// Cada tipo de agente se prueba sobre un negocio distinto. --only permite repetir una parte sin regenerar todo.
const PROFILE_RUNS={'profile-informativo':['veterinaria','informativo'],'profile-calificador':['inmobiliaria','calificador'],'profile-encuesta':['fisioterapia','encuesta'],'profile-informativo-laboratorio':['laboratorio','informativo'],'profile-calificador-seguros':['seguros','calificador'],'profile-encuesta-spa':['spa','encuesta']};
const ALL_RUNS=[...VERTICAL_IDS,'production','custom',...Object.keys(PROFILE_RUNS)];
const only=typeof opts.only==='string'?opts.only.split(','):null;
const originRoot=path.resolve(studioRoot,'..');
const validation=path.join(studioRoot,'.validation');fs.mkdirSync(validation,{recursive:true});
const results=[];
// Se guarda tras cada corrida para que un fallo a medias no borre la evidencia. --only conserva las demás.
const resultsFile=path.join(validation,'results.json');
const previous=only&&fs.existsSync(resultsFile)?JSON.parse(fs.readFileSync(resultsFile,'utf8')).results:[];
const portFree=port=>new Promise(resolve=>{const probe=net.createServer().once('error',()=>resolve(false)).once('listening',()=>probe.close(()=>resolve(true))).listen(port,'127.0.0.1');});
function saveResults(){fs.writeFileSync(resultsFile,JSON.stringify({date:new Date().toISOString(),results:[...previous.filter(r=>!results.some(x=>x.kind===r.kind)),...results],providers:'simulated-or-not-connected',liveVoiceTested:false},null,2));}
for(const [index,kind] of ALL_RUNS.entries()){
  if(only&&!only.includes(kind))continue;
  const profileRun=PROFILE_RUNS[kind];
  const target=path.join(validation,kind),fresh=path.join(validation,kind+'-'+Date.now());
  const config=JSON.parse(fs.readFileSync(path.join(studioRoot,'presets',kind==='production'?'dental':kind==='custom'?'salon':profileRun?profileRun[0]:kind)+'.json','utf8'));if(kind==='production')config.mode='production';
  if(profileRun){config.agent.profile=profileRun[1];config.slug=config.slug.replace('-demo','')+'-'+profileRun[1];}
  if(kind==='custom'){
    config.slug='custom-qa';config.timezone='Europe/Copenhagen';config.currency='DKK';config.resources=[{id:1,name:'Cabina A'},{id:2,name:'Cabina B'},{id:3,name:'Cabina C'}];
    config.openingHours=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,d===0?[['08:00','13:00']]:[['07:00','12:00'],['14:00','22:00']]]));
    for(const p of config.providers)p.schedule={...Object.fromEntries(p.weekdays.split(',').map(d=>[d,[['08:00','20:00']]])),0:[['08:00','13:00']]};
    config.services[0].name='Corte {premium} y "acabado"';config.services[0].resource_ids=[3];config.booking={slotMinutes:10,maxAdvanceDays:90,cancellationHours:12};
    const closure=new Date();closure.setUTCDate(closure.getUTCDate()+10);config.closures=[closure.toISOString().slice(0,10)];
  }
  createProject(config,fresh);
  // Validation directories are owned by this harness; preserve installed dependencies only.
  if(fs.existsSync(target)){
    for(const entry of fs.readdirSync(target))if(entry!=='node_modules')fs.rmSync(path.join(target,entry),{recursive:true,force:true});
    fs.cpSync(fresh,target,{recursive:true});fs.rmSync(fresh,{recursive:true,force:true});
  }else fs.renameSync(fresh,target);
  const logs=[];
  function run(command,args){try{const output=execFileSync(command,args,{cwd:target,encoding:'utf8',stdio:'pipe',timeout:120000});logs.push({command:[command,...args].join(' '),status:'PASS'});return output;}catch(e){console.error(e.stdout?.toString().slice(-5000),e.stderr?.toString().slice(-2000));throw e;}}
  if(!fs.existsSync(path.join(target,'node_modules')))run('npm',['ci','--no-audit','--no-fund']);
  run('npm',['run','build']);run('npm',['run','setup']);
  const wrangler=path.join(target,'node_modules/wrangler/bin/wrangler.js');
  run(process.execPath,[wrangler,'d1','migrations','apply',config.slug,'--local']);
  // Otro proyecto puede estar usando el puerto de esta corrida: se salta en vez de fallar.
  let port=8790+index;while(!await portFree(port))port+=100;
  const origin='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,[wrangler,'dev','--port',String(port)],{cwd:target,stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
  try{
    let ready=false;for(let n=0;n<100;n++){try{const r=await fetch(origin+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
    if(!ready)throw new Error('Servidor no arrancó: '+serverLog.slice(-2000));
    if(kind==='production'){
      assert.equal((await fetch(origin+'/api/dashboard')).status,401);
      assert.equal((await fetch(origin+'/api/dashboard',{headers:{'Cf-Access-Jwt-Assertion':'forged.jwt.value'}})).status,401);
      assert.equal((await fetch(origin+'/api/portal/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'+528100000001',consent:true})})).status,503);
      assert.equal((await fetch(origin+'/api/tools/get_my_appointments',{method:'POST'})).status,503);
      assert.equal((await fetch(origin+'/patient')).status,200);
      logs.push({command:'HTTP production: anonymous, forged JWT, disabled OTP, unapproved tool, portal',status:'PASS',assertions:5});
    }else{
      // Existing API regressions run against each generated preset and its own local database.
      // Estas pruebas reservan citas con tools que informativo y encuesta no tienen a propósito.
      if(profileRun&&!PROFILES[profileRun[1]].tools.includes('commit_appointment_change'))logs.push({command:'npm test',status:'SKIPPED',reason:'booking tools disabled by profile; covered by HTTP profile checks'});
      else{
      const output=execFileSync('npm',['test'],{cwd:target,env:{...process.env,TEST_ORIGIN:origin},encoding:'utf8',stdio:'pipe',timeout:120000});
      logs.push({command:'npm test',status:'PASS',summary:output.replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(l=>/Test Files|Tests /.test(l)).join(' ')});
      }
      execFileSync('npx',['playwright','test'],{cwd:target,env:{...process.env,TEST_ORIGIN:origin},encoding:'utf8',stdio:'pipe',timeout:120000});
      logs.push({command:'npx playwright test',status:'PASS',coverage:'desktop, mobile, navigation, editor, input focus'});
      const boundedToken=randomUUID()+randomUUID(),boundedHash=createHash('sha256').update(boundedToken).digest('hex');
      fs.writeFileSync(path.join(target,'.secrets/budget-test.sql'),`INSERT INTO voice_sessions(id,token_hash,patient_id,verified,expires_at) VALUES('budget-test','${boundedHash}','patient-1',1,'${new Date(Date.now()+600000).toISOString()}');`,{mode:0o600});
      run(process.execPath,[wrangler,'d1','execute',config.slug,'--local','--file','.secrets/budget-test.sql']);
      const secretValues=Object.fromEntries(fs.readFileSync(path.join(target,'.dev.vars'),'utf8').trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
      const boundedHeaders={'Content-Type':'application/json','X-Tools-Key':secretValues.TOOLS_SECRET,'X-Session-Token':boundedToken};
      for(let count=0;count<3;count++){
        const result=await(await fetch(origin+'/api/tools/get_service_catalog',{method:'POST',headers:boundedHeaders,body:'{}'})).json();
        if(count<2)assert.equal(result.ok,true);else{assert.equal(result.error,'TOOL_BUDGET_EXHAUSTED');assert.equal(result.retryable,false);}
      }
      logs.push({command:'HTTP per-session tool budget: third catalog call is denied by server',status:'PASS',assertions:4});
      if(profileRun)logs.push({command:'HTTP profile '+profileRun[1],status:'PASS',...await checkProfile({project:target,origin})});
      if(kind==='custom'){
        const password=fs.readFileSync(path.join(target,'.secrets/admin-password.txt'),'utf8').trim();
        const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
        const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
        const date=new Date();date.setUTCDate(date.getUTCDate()+7);while(date.getUTCDay()!==0)date.setUTCDate(date.getUTCDate()+1);
        const slots=await(await fetch(origin+'/api/availability?service_id=corte&date='+date.toISOString().slice(0,10),{headers})).json();
        assert.ok(slots.slots.length);assert.ok(slots.slots.every(s=>s.chair===3));
        const closed=await(await fetch(origin+'/api/availability?service_id=corte&date='+config.closures[0],{headers})).json();assert.deepEqual(closed.slots,[]);
        const dash=await(await fetch(origin+'/api/dashboard',{headers})).json();assert.equal(dash.timezone,'Europe/Copenhagen');
        assert.ok(dash.knowledge.find(d=>d.id==='kb-services').content.includes('DKK'));
        logs.push({command:'HTTP custom: Sunday booking, third resource restriction, closure, IANA zone, generated knowledge',status:'PASS',assertions:5});
      }
      if(kind==='garage'){
        const password=fs.readFileSync(path.join(target,'.secrets/admin-password.txt'),'utf8').trim();
        const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
        const cookie=login.headers.get('set-cookie').split(';')[0],headers={cookie,'Content-Type':'application/json'};
        assert.equal((await fetch(origin+'/api/work-orders')).status,401);
        const orders=await (await fetch(origin+'/api/work-orders',{headers})).json();assert.equal(orders.orders.length,2);
        const token=randomUUID()+randomUUID(),hash=createHash('sha256').update(token).digest('hex'),expires=new Date(Date.now()+600000).toISOString();
        fs.writeFileSync(path.join(target,'.secrets/orders-test.sql'),`INSERT INTO voice_sessions(id,token_hash,patient_id,verified,expires_at) VALUES('orders-test','${hash}','patient-1',1,'${expires}');`,{mode:0o600});
        run(process.execPath,[wrangler,'d1','execute',config.slug,'--local','--file','.secrets/orders-test.sql']);
        const env=Object.fromEntries(fs.readFileSync(path.join(target,'.dev.vars'),'utf8').trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
        const tool=await(await fetch(origin+'/api/tools/get_my_work_orders',{method:'POST',headers:{'Content-Type':'application/json','X-Tools-Key':env.TOOLS_SECRET,'X-Session-Token':token},body:JSON.stringify({patient_id:'patient-2'})})).json();
        assert.equal(tool.data.orders.length,1);assert.equal(tool.data.orders[0].id,'OT-1001');
        const change={status:'ready',public_note:'Prueba autorizada: listo para recoger.',version:1};
        assert.equal((await fetch(origin+'/api/work-orders/OT-1001',{method:'POST',headers,body:JSON.stringify(change)})).status,200);
        assert.equal((await fetch(origin+'/api/work-orders/OT-1001',{method:'POST',headers,body:JSON.stringify(change)})).status,409);
        logs.push({command:'HTTP garage: authentication, own-order scope, update, stale version',status:'PASS',assertions:6});
      }
    }
    results.push({kind,checks:logs});saveResults();console.log(kind+': PASS');
  }catch(e){console.error(serverLog.slice(-1500));throw e;}
  finally{server.kill('SIGTERM');}
}
console.log('Resultados: '+path.join(validation,'results.json'));

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {configureSecrets} from './secrets.mjs';

// Runs inside a generated project. The state belongs to this installation only.
export async function deploy(root=process.cwd(),{voiceId=process.env.ELEVENLABS_VOICE_ID}={}){
  const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
  const c=read('business.config.json'),cfg=read('wrangler.jsonc'),secrets=configureSecrets(root);
  const statePath=path.join(root,'.secrets/deployment.json');
  let state=fs.existsSync(statePath)?read('.secrets/deployment.json'):null;
  const persist=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n',{mode:0o600});
  const command=(argv)=>{try{return execFileSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),...argv],{cwd:root,encoding:'utf8',stdio:'pipe',timeout:180000,env:{...process.env,CI:'true',NO_COLOR:'1'}});}catch(e){const output=String(e.stderr??'')+String(e.stdout??'');const error=new Error('Wrangler falló: '+argv[0]+' '+(argv[1]??'')+'. Revisa su log privado; el asistente conserva el estado.');error.workerMissing=/\[code: 10007\]/.test(output);throw error;}};
  const jsonCommand=argv=>JSON.parse(command(argv));
  const identity=jsonCommand(['whoami','--json']);
  const accounts=identity.accounts??[];
  const accountId=cfg.account_id??(accounts.length===1?accounts[0].id:undefined);
  if(!accountId||!accounts.some(a=>a.id===accountId))throw new Error('Selecciona una cuenta Cloudflare propia con account_id en wrangler.jsonc.');
  if(state?.accountId&&state.accountId!==accountId)throw new Error('La cuenta Cloudflare cambió. No se reutiliza el estado de otra cuenta.');
  cfg.account_id=accountId;
  fs.writeFileSync(path.join(root,'wrangler.jsonc'),JSON.stringify(cfg,null,2)+'\n');
  const workerExists=()=>{try{jsonCommand(['deployments','list','--name',c.slug,'--json']);return true;}catch(e){if(e.workerMissing)return false;throw e;}};
  if(!state){
    if(cfg.d1_databases[0].database_id!=='00000000-0000-0000-0000-000000000000')throw new Error('Este asistente solo inicia proyectos nuevos. No adopta bases existentes.');
    if(workerExists())throw new Error('Ya existe un Worker con ese nombre. Genera otro proyecto con slug único.');
    if(jsonCommand(['d1','list','--json']).some(d=>d.name===c.slug))throw new Error('Ya existe una D1 con ese nombre. Usa un slug único.');
    state={id:randomUUID(),accountId,slug:c.slug,mode:c.mode??'demo',createdAt:new Date().toISOString(),databaseId:null,origin:null,publication:'not_started'};persist();
  }
  if(state.slug!==c.slug||state.mode!==(c.mode??'demo'))throw new Error('El nombre o modo cambió después de iniciar el despliegue. Genera otra instalación.');
  if(!state.databaseId){
    if(!state.databaseCreatePending){state.databaseCreatePending=true;persist();command(['d1','create',c.slug,'--binding','DB','--update-config']);}
    // Recover an interrupted create by reading, never by blindly creating again.
    const databases=jsonCommand(['d1','list','--json']).filter(d=>d.name===c.slug);
    if(databases.length!==1)throw new Error('No se pudo reconciliar D1. Revisa .secrets/deployment.json y la cuenta antes de otra escritura.');
    state.databaseId=databases[0].uuid;persist();
  }
  if(cfg.d1_databases[0].database_id!=='00000000-0000-0000-0000-000000000000'&&cfg.d1_databases[0].database_id!==state.databaseId)throw new Error('La D1 configurada no pertenece a esta instalación.');
  cfg.d1_databases[0].database_id=state.databaseId;
  fs.writeFileSync(path.join(root,'wrangler.jsonc'),JSON.stringify(cfg,null,2)+'\n');
  console.log('Aplicando migraciones y compilando '+c.slug+'…');
  command(['d1','migrations','apply',c.slug,'--remote']);
  execFileSync('npm',['run','build'],{cwd:root,stdio:'inherit',timeout:180000});
  state.deployPending=true;persist();
  const output=command(['deploy']);
  const urls=output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/g)??[];
  if(!urls.length)throw new Error('Worker publicado, pero no se detectó la URL. Revisa el log privado y registra origin en .secrets/deployment.json antes de continuar.');
  state.origin=urls.at(-1);state.deployPending=false;persist();
  command(['secret','bulk','.secrets/worker-secrets.json']);
  let healthy=false;
  for(let n=0;n<10;n++){
    try{const response=await fetch(state.origin+'/api/health',{signal:AbortSignal.timeout(10000)});healthy=response.ok;}catch{}
    if(healthy)break;await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(!healthy)throw new Error('El Worker no supera health. No se publica el agente.');
  if(state.mode==='production'){
    console.log('Worker: '+state.origin+'\nCandidato protegido. Continúa con PRODUCCION.md para Access, OTP, CRM y aceptación; no se activa automáticamente.');return state;
  }
  if(!secrets.ELEVENLABS_API_KEY){console.log('Worker: '+state.origin+'\nConecta ElevenLabs y selecciona una voz desde el dashboard; o repite con ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en el entorno privado.');return state;}
  const login=await fetch(state.origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:secrets.ADMIN_PASSWORD})});
  const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!login.ok||!cookie)throw new Error('No se pudo iniciar sesión privada en el Worker.');
  const api=async(endpoint,body,method=body===undefined?'GET':'POST')=>{const response=await fetch(state.origin+'/api'+endpoint,{method,headers:{cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error('API '+endpoint+' devolvió '+response.status+'. Consulta el dashboard privado.');return data;};
  const dashboard=await api('/dashboard');
  if(dashboard.settings.remote_agent_id){state.agentId=dashboard.settings.remote_agent_id;state.publication='complete';persist();}
  if(state.publication==='pending')throw new Error('La publicación anterior no tiene resultado confirmado. Revisa el job en el dashboard antes de volver a publicar.');
  if(state.publication!=='complete'){
    if(!voiceId){console.log('Worker: '+state.origin+'\nSelecciona una voz y publica desde el dashboard. No se elige una voz al azar.');return state;}
    const voices=await api('/voices');if(!voices.voices.some(v=>v.id===voiceId))throw new Error('La voz elegida no está disponible para esta cuenta de Agents.');
    await api('/agent',{...dashboard.settings,voice_id:voiceId},'PUT');
    state.publication='pending';persist();
    await api('/agent/publish',{});
    const result=await api('/dashboard');state.agentId=result.settings.remote_agent_id;state.publication='complete';persist();
  }
  console.log('Worker: '+state.origin+'\nAgente publicado: '+state.agentId+'\nPendiente: probar conversación y agenda. Credenciales en .secrets/ (no compartir).');return state;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await deploy();}catch(e){console.error(e.message);process.exitCode=1;}

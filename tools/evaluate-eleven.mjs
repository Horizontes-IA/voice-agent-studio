import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { args,studioRoot } from './shared.mjs';
const opts=args(process.argv.slice(2));
if(!opts.project||!opts['agent-id'])throw new Error('Usa --project /ruta/generada --agent-id tu-agente [--run]. Sin --run solo prepara el plan.');
const project=path.resolve(opts.project),config=JSON.parse(fs.readFileSync(path.join(project,'business.config.json'),'utf8'));
const cases=JSON.parse(fs.readFileSync(path.join(studioRoot,'evaluations/policy-cases.json'),'utf8')).filter(c=>{const profile=config.agent.profile??'recepcion';return(!c.kind||(c.kind===config.kind&&!config.agent.sectorPolicy))&&(c.profile?c.profile===profile:!c.profiles||c.profiles.includes(profile))&&(!opts.case||opts.case===c.id);}).map(c=>({...c,scenario:c.scenario.replace('una limpieza','el servicio '+config.services[0].name)}));
if(!cases.length)throw new Error('No hay escenarios que coincidan con el filtro.');
const source=stripTypeScriptTypes(fs.readFileSync(path.join(project,'worker/policy.ts'),'utf8'));
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const prompt=module.buildPolicy({name:config.agent.name,instructions:config.agent.instructions});
const hash=createHash('sha256').update(prompt).digest('hex');
if(!opts.run){console.log(JSON.stringify({mode:'plan',agent:opts['agent-id'],promptHash:hash,cases:cases.map(c=>c.id),realToolsDisabled:true,providerCalls:0},null,2));process.exit(0);}
const key=process.env.ELEVENLABS_API_KEY;if(!key)throw new Error('Configura ELEVENLABS_API_KEY de forma privada.');
const out=path.resolve(opts.out??path.join(project,'.secrets/policy-evals'));fs.mkdirSync(out,{recursive:true,mode:0o700});
const stateFile=path.join(out,'state.json');
let state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{agent:opts['agent-id'],promptHash:hash,fixtureVersion:2,caseIds:cases.map(c=>c.id),tests:{},createdAt:new Date().toISOString()};
if(state.agent!==opts['agent-id']||state.promptHash!==hash)throw new Error('Usa otra carpeta de resultados para un agente o prompt diferente.');
if(state.caseIds&&JSON.stringify(state.caseIds)!==JSON.stringify(cases.map(c=>c.id)))throw new Error('El filtro de escenarios cambió. Usa otra carpeta de resultados.');
if((state.fixtureVersion??1)!==2&&!state.invocation)throw new Error('Los fixtures cambiaron. Usa otra carpeta para crear una suite nueva; las invocaciones previas solo se consultan.');
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2),{mode:0o600});
async function api(route,method='GET',body){
  const r=await fetch('https://api.elevenlabs.io'+route,{method,headers:{'xi-api-key':key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
  if(!r.ok)throw new Error('ElevenLabs HTTP '+r.status+' en '+route+'. Revisa el estado guardado antes de repetir una escritura.');
  return r.json();
}
const agent=await api('/v1/convai/agents/'+encodeURIComponent(state.agent));
if(!agent.conversation_config?.agent?.prompt?.prompt?.includes(config.name))throw new Error('El agente de referencia no corresponde a este negocio. Usa el ID publicado por esta instalación para conservar sus tools y conocimiento.');
const mockOverrides={};
const toolNames={};
for(const id of agent.conversation_config?.agent?.prompt?.tool_ids??[]){
  const tool=await api('/v1/convai/tools/'+encodeURIComponent(id));
  const name=tool.tool_config?.name??tool.name;
  toolNames[name]=id;
  let data={ok:false,error:'BACKEND_UNAVAILABLE',retryable:false,next_action:'explain_unavailable'};
  if(name==='get_verification_status')data={ok:true,data:{verified:true,mode:'demo',method:'synthetic-test-session'}};
  if(name==='get_clinic_status')data={ok:true,data:{date:new Date().toISOString().slice(0,10),timezone:config.timezone,demo:true}};
  if(name==='get_my_appointments')data={ok:true,data:{appointments:[]}};
  if(name==='save_capture')data={ok:true,data:{capture_id:'simulacion',status:'saved'}};
  mockOverrides[id]=[{parameter_conditions:[],mock_result:JSON.stringify(data),is_error:false}];
}
for(const c of cases){
  if(state.tests[c.id]?.id)continue;
  if(state.tests[c.id]?.state==='creating')throw new Error('Creación anterior incierta para '+c.id+'. Comprueba ElevenLabs y completa su ID en state.json antes de continuar.');
  state.tests[c.id]={state:'creating'};save();
  const overrides=structuredClone(mockOverrides);
  // This case tests clarification, not a second outage. Keep its read tools available.
  if(c.id==='ambiguous-date'){
    const mock=data=>[{parameter_conditions:[],mock_result:JSON.stringify({ok:true,data}),is_error:false}];
    if(toolNames.get_service_catalog)overrides[toolNames.get_service_catalog]=mock({currency:config.currency??'MXN',services:config.services});
    if(toolNames.search_availability)overrides[toolNames.search_availability]=mock({slots:[]});
  }
  const result=await api('/v1/convai/agent-testing/create','POST',{type:'simulation',name:'Horizontes Studio · '+c.name,simulation_scenario:c.scenario,simulation_max_turns:8,success_conditions:c.criteria,tool_mock_config:{mocking_strategy:'all',fallback_strategy:'raise_error'},tool_mock_overrides:overrides,dynamic_variables:{clinic_date:new Date().toISOString().slice(0,10),patient_name:'Persona de prueba',session_token:'synthetic-not-valid',pending_operation_id:''}});
  state.tests[c.id]={state:'created',id:result.id};save();
}
if(!state.invocation){
  if(state.runState==='starting')throw new Error('Invocación anterior incierta. Comprueba ElevenLabs antes de repetir.');
  state.runState='starting';save();
  const conversationConfig=structuredClone(agent.conversation_config);conversationConfig.agent.prompt.prompt=prompt;
  const result=await api('/v1/convai/agents/'+encodeURIComponent(state.agent)+'/run-tests','POST',{tests:Object.values(state.tests).map(t=>({test_id:t.id})),repeat_count:1,agent_config_override:{conversation_config:conversationConfig,platform_settings:agent.platform_settings}});
  state.invocation=result.id;state.runState='started';save();
}
// One snapshot per invocation. Re-run to fetch progress; never restart an uncertain write.
const status=await api('/v1/convai/test-invocations/'+encodeURIComponent(state.invocation));
fs.writeFileSync(path.join(out,'result.private.json'),JSON.stringify(status,null,2),{mode:0o600});
const runs=status.test_runs??[];
const summary={agent:state.agent,promptHash:hash,fixtureVersion:state.fixtureVersion??1,invocation:state.invocation,tools:'all-mocked-raise-error',audioTested:false,results:runs.map(r=>{
  const calls=(r.agent_responses??[]).flatMap(turn=>turn.tool_calls??[]),trajectoryFailures=[];
  for(const name of ['get_service_catalog','create_staff_request'])if(calls.filter(call=>call.tool_name===name).length>2)trajectoryFailures.push('RETRY_BUDGET_EXCEEDED:'+name);
  const scenario=Object.entries(state.tests).find(([,t])=>t.id===r.test_id)?.[0];
  if(scenario==='cancel-intent'&&calls.some(c=>c.tool_name==='commit_appointment_change'))trajectoryFailures.push('COMMIT_AFTER_STOP');
  return {name:r.test_name??r.test_id,status:r.status,result:r.condition_result?.result??r.condition_result?.is_passed??r.condition_result,trajectoryFailures,credits:r.credits_used??null};
})};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2),{mode:0o600});
console.log(JSON.stringify(summary,null,2));

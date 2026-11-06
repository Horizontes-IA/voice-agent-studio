import fs from 'node:fs';
import path from 'node:path';
import {studioRoot,write,patch,replaceOnce} from './shared.mjs';

const READ=['get_service_catalog','get_clinic_status'];
const BOOKING=['get_verification_status','get_my_appointments','search_availability','prepare_appointment_change','commit_appointment_change','get_operation_status','join_waitlist'];
const NO_BOOKING=['Reservar','Cambiar o cancelar','Errores, interrupciones y reintentos'];
export const ALL_TOOLS=[...READ,...BOOKING,'create_staff_request','save_capture','get_my_work_orders'];

// recepcion conserva el prompt y las tools evaluadas con voz real: no pasa por installProfile.
export const PROFILES={
  recepcion:{label:'Recepción',summary:'Responde dudas y reserva, cambia o cancela citas.',skill:'voice-agent-studio'},
  informativo:{label:'Informativo',summary:'Responde dudas con el conocimiento del negocio y deja solicitudes al equipo. No agenda.',skill:'agente-informativo',
    tools:[...READ,'create_staff_request'],drop:[...NO_BOOKING,'Identidad y acceso'],
    greeting:'¿En qué te puedo orientar?',heading:'Cuéntame qué necesitas saber.',card:['Resuelvo dudas y dejo','tus solicitudes al equipo.'],
    capabilities:'Conocimiento publicado en ElevenLabs; catálogo y horario general en D1; solicitudes pendientes en el dashboard. Sin acceso a la agenda ni a datos de personas. No hay SMS, email, WhatsApp, telefonía ni transferencia conectados por defecto.',
    knowledgeNote:'Este agente solo informa: no consulta la agenda ni reserva. Las peticiones de cita quedan como solicitud para el equipo.'},
  calificador:{label:'Calificador',summary:'Hace preguntas de calificación, guarda al prospecto y puede agendarle una cita.',skill:'agente-calificador',
    tools:[...READ,...BOOKING,'create_staff_request','save_capture'],capture:'lead',
    greeting:'Cuéntame, ¿qué estás buscando?',heading:'Cuéntame qué estás buscando.',card:['Entiendo qué buscas, registro','tus datos y agendo si quieres.'],
    capabilities:'Respuestas de calificación, agenda y datos en D1; conocimiento publicado en ElevenLabs; solicitudes pendientes en el dashboard. No hay SMS, email, WhatsApp, telefonía ni transferencia conectados por defecto.'},
  encuesta:{label:'Encuesta',summary:'Recoge la opinión después de una visita y avisa al equipo si hay una queja.',skill:'agente-encuesta',
    tools:[...READ,'get_verification_status','create_staff_request','save_capture'],capture:'survey',drop:NO_BOOKING,
    greeting:'¿Tienes dos minutos para contarme cómo te fue en tu visita?',heading:'Cuéntame cómo te fue.',card:['Te pregunto cómo te fue','y lo paso al equipo.'],
    capabilities:'Respuestas de la encuesta en D1; conocimiento publicado en ElevenLabs; solicitudes pendientes en el dashboard. No agenda. No hay SMS, email, WhatsApp, telefonía ni transferencia conectados por defecto.',
    knowledgeNote:'Este agente recoge opiniones: no consulta la agenda ni reserva. Las peticiones de cita quedan como solicitud para el equipo.'},
};
export const PROFILE_IDS=Object.keys(PROFILES);
export const profileOf=c=>c.agent?.profile??'recepcion';

const DEFAULT_FORMS={
  lead:{title:'Prospectos',fields:[
    {id:'necesidad',label:'Qué necesita',type:'text',required:true},
    {id:'presupuesto',label:'Presupuesto aproximado',type:'text',required:false},
    {id:'plazo',label:'Cuándo quiere resolverlo',type:'text',required:true},
    {id:'temperatura',label:'Interés',type:'choice',options:['caliente','tibio','frio'],required:true},
  ],samples:[
    {summary:'Quiere empezar este mes y pidió agendar una cita.',answers:{necesidad:'Quiere contratar el servicio principal',presupuesto:'Ya tiene un presupuesto definido',plazo:'Este mes',temperatura:'caliente'}},
    {summary:'Le interesa, pero todavía está comparando opciones.',answers:{necesidad:'Busca conocer precios y opciones',presupuesto:'Aún no lo sabe',plazo:'En dos o tres meses',temperatura:'tibio'}},
    {summary:'Solo estaba explorando y prefirió no agendar.',answers:{necesidad:'Quería información general',plazo:'Sin fecha',temperatura:'frio'}},
  ]},
  survey:{title:'Encuestas',fields:[
    {id:'recomendacion',label:'Del 0 al 10, ¿qué tanto nos recomendarías?',type:'score',required:true},
    {id:'motivo',label:'Por qué esa calificación',type:'text',required:true},
    {id:'mejora',label:'Qué mejorarías',type:'text',required:false},
    {id:'contacto',label:'Acepta que el equipo le contacte',type:'choice',options:['si','no'],required:true},
  ],samples:[
    {summary:'Quedó contenta con la atención y lo recomendaría.',answers:{recomendacion:9,motivo:'La atendieron a tiempo y le explicaron todo',contacto:'si'}},
    {summary:'Esperó más de lo previsto. Se avisó al equipo.',answers:{recomendacion:6,motivo:'Tuvo que esperar 30 minutos',mejora:'Avisar cuando hay retrasos',contacto:'si'}},
    {summary:'Experiencia muy buena, sin comentarios pendientes.',answers:{recomendacion:10,motivo:'El trato fue excelente',contacto:'no'}},
  ]},
};
export function activeForm(c){
  const kind=PROFILES[profileOf(c)].capture;
  if(!kind)return null;
  const form=c.agent.capture?.[kind]??DEFAULT_FORMS[kind];
  return {kind,title:form.title,fields:form.fields,samples:form.samples??(c.agent.capture?.[kind]?null:DEFAULT_FORMS[kind].samples)};
}
export function validateProfile(c,fail){
  const id=profileOf(c);
  if(!PROFILE_IDS.includes(id))fail('agent.profile: '+PROFILE_IDS.join(', '));
  if(id!=='recepcion'&&c.mode==='production')fail('agent.profile: el modo production solo admite recepcion');
  if(id!=='recepcion'&&c.kind==='garage')fail('agent.profile: la plantilla garage solo admite recepcion porque sus órdenes dependen de esa política');
  const sector=c.agent?.sectorPolicy;
  if(sector!==undefined&&(typeof sector!=='string'||sector.trim().length<20||sector.length>3000))fail('agent.sectorPolicy: 20–3000 caracteres');
  const plain=v=>typeof v==='string'&&v.trim().length>0&&v.length<=120&&!/[\\"'`<>${}\r\n]/.test(v);
  for(const [kind,form] of Object.entries(c.agent?.capture??{})){
    if(!DEFAULT_FORMS[kind])fail('agent.capture: usa lead o survey');
    if(!plain(form?.title)||!Array.isArray(form.fields)||!form.fields.length||form.fields.length>12)fail('agent.capture.'+kind+': title y 1–12 fields');
    const ids=new Set();
    for(const f of form.fields){
      if(typeof f.id!=='string'||!/^[a-z][a-z0-9_]{0,39}$/.test(f.id)||f.id==='summary'||ids.has(f.id))fail('agent.capture.'+kind+': id de campo inválido o duplicado');
      ids.add(f.id);
      if(!plain(f.label)||typeof f.required!=='boolean'||!['text','choice','score'].includes(f.type))fail('agent.capture.'+kind+': campo incompleto '+f.id);
      if(f.type==='choice'&&(!Array.isArray(f.options)||f.options.length<2||f.options.length>8||!f.options.every(plain)))fail('agent.capture.'+kind+': opciones inválidas en '+f.id);
    }
    if(!form.fields.some(f=>f.required))fail('agent.capture.'+kind+': necesita al menos un campo obligatorio');
    if(form.samples!==undefined&&(!Array.isArray(form.samples)||form.samples.length>3||form.samples.some(x=>!plain(x?.summary)||!x.answers||Object.keys(x.answers).some(id=>!ids.has(id)))))fail('agent.capture.'+kind+': samples admite hasta 3 ejemplos con summary y answers de campos existentes');
  }
}
const describe=f=>'- '+f.id+': '+f.label+(f.type==='choice'?' (solo '+f.options.join(', ')+')':f.type==='score'?' (entero de 0 a 10)':'')+(f.required?'':' (opcional)');
// El prompt no debe nombrar herramientas que este perfil no tiene: se retiran sus secciones completas.
export function applyProfile(core,c){
  const p=PROFILES[profileOf(c)],form=activeForm(c);
  const sections=core.split(/^(?=# )/m).filter(s=>!(p.drop??[]).some(h=>s.startsWith('# '+h+'\n')));
  const text=fs.readFileSync(path.join(studioRoot,'prompts/profiles',profileOf(c)+'.md'),'utf8').replaceAll('{{CAPTURE_FIELDS}}',form?form.fields.map(describe).join('\n'):'').trim()+'\n\n';
  const index=sections.findIndex(s=>s.startsWith('# Proceso del sector'));
  if(index<0)throw new Error('Prompt incompatible: falta Proceso del sector');
  sections.splice(index,0,text);
  return sections.join('');
}
export function profileCapabilities(c,base){
  const id=profileOf(c);
  if(id==='recepcion')return base;
  const p=PROFILES[id];
  return [...base.filter(x=>x!=='atomic-booking'||p.tools.includes('commit_appointment_change')),'agent-profile-'+id,...(p.capture?['structured-capture-'+p.capture]:[])];
}
// Registros de ejemplo para que la página no se vea vacía en una demo. Solo existen en modo demo.
function sampleRows(form){
  return [0,1,2].map(i=>{
    const sample=form.samples?.[i],answers=sample?.answers??Object.fromEntries(form.fields.map(f=>[f.id,f.type==='score'?[9,6,10][i]:f.type==='choice'?f.options[i%f.options.length]:'Ejemplo ficticio '+(i+1)]));
    const score=form.fields.find(f=>f.type==='score');
    return {id:'seed-capture-'+(i+1),session:'seed-capture-'+(i+1),person:'patient-'+(i+1),answers:JSON.stringify(answers),summary:sample?.summary??'Registro de ejemplo para la demostración.',score:score?answers[score.id]??null:null};
  });
}
export function installProfile(out,c){
  const id=profileOf(c);
  if(id==='recepcion')return;
  const p=PROFILES[id],form=activeForm(c),read=name=>fs.readFileSync(path.join(studioRoot,'modules',name),'utf8');
  write(out,'worker/profile.ts','// Generado por Voice Agent Studio. El servidor rechaza cualquier tool fuera de esta lista.\nexport type CaptureField={id:string;label:string;type:"text"|"choice"|"score";required:boolean;options?:string[]};\nexport const PROFILE:{id:string;tools:string[];capture:{kind:"lead"|"survey";title:string;fields:CaptureField[]}|null}='+JSON.stringify({id,tools:p.tools,capture:form&&{kind:form.kind,title:form.title,fields:form.fields}},null,2)+';\n');
  patch(out,'worker/eleven.ts',s=>{
    s='import { PROFILE } from "./profile";\n'+s;
    if(form){
      const properties={summary:{type:'string',description:'Resumen breve de la conversación, sin datos sensibles.'},...Object.fromEntries(form.fields.map(f=>[f.id,{type:'string',description:f.label+(f.type==='score'?'. Número entero de 0 a 10.':''),...(f.type==='choice'?{enum:form.kind==='lead'?[...f.options,'no_respondio']:f.options}:{})}]))};
      const required=['summary',...form.fields.filter(f=>f.required).map(f=>f.id)];
      s=replaceOnce(s,'  return defs.map(','  defs.push(["save_capture","Guarda las respuestas de esta conversación. Usa solo lo que dijo la persona.",'+JSON.stringify(properties)+','+JSON.stringify(required)+']);\n  return defs.map(');
    }
    return replaceOnce(s,'  return defs.map(','  return defs.filter(([name])=>PROFILE.tools.includes(name)).map(');
  });
  patch(out,'worker/index.ts',s=>{
    s='import { PROFILE } from "./profile";\n'+s;
    s=replaceOnce(s,'  const name = c.req.param("name");','  const name = c.req.param("name");\n  if(!PROFILE.tools.includes(name))return c.json({ok:false,error:"TOOL_NOT_IN_PROFILE",retryable:false,next_action:"explain_unavailable"},403);');
    if(form){
      s='import { parseCapture } from "./captures";\n'+s;
      s=replaceOnce(s,'  else if (name === "create_staff_request") {',read('captures-tool.ts.txt')+'  else if (name === "create_staff_request") {');
      s=replaceOnce(s,'app.post("/api/tools/:name",',read('captures-routes.ts.txt')+'\napp.post("/api/tools/:name",');
      s=replaceOnce(s,'  const toolTitles: Record<string, string> = {','  const toolTitles: Record<string, string> = {\n    save_capture: "Respuestas registradas",');
    }
    return s;
  });
  patch(out,'worker/data.ts',s=>{
    s=replaceOnce(s,'¿Quieres agendar una cita o necesitas información?',p.greeting);
    if(!form)return s;
    return replaceOnce(s,'  await db.batch(statements);','  await db.batch(statements);\n  await db.batch('+JSON.stringify(sampleRows(form))+'.map(r=>db.prepare("INSERT INTO captures(id,kind,session_id,patient_id,answers,summary,score) VALUES(?,?,?,?,?,?,?)").bind(r.id,'+JSON.stringify(form.kind)+',r.session,r.person,r.answers,r.summary,r.score)));');
  });
  patch(out,'src/main.tsx',s=>{
    const card=/Resuelvo dudas, encuentro horarios\s*<br \/>y acompaño a tus \S+?\./;
    if(!card.test(s))throw new Error('Base incompatible: tarjeta del agente');
    s=s.replace(card,p.card[0]+'\n            <br />'+p.card[1]);
    if(!form)return s;
    s='import StudioCaptures from "./StudioCaptures";\n'+s;
    s=replaceOnce(s,'"overview" | "agenda"','"captures" | "overview" | "agenda"');
    s=replaceOnce(s,'const nav: { id: Page; label: string; icon: LucideIcon }[] = [','const nav: { id: Page; label: string; icon: LucideIcon }[] = [\n  { id: "captures", label: '+JSON.stringify(form.title)+', icon: FileText },');
    return replaceOnce(s,'{page === "overview" && (','{page === "captures" && <StudioCaptures />}\n          {page === "overview" && (');
  });
  patch(out,'src/VoiceDialog.tsx',s=>replaceOnce(s,'Hablemos de tu próxima visita.',p.heading));
  if(form){
    write(out,'migrations/0008_captures.sql',read('captures.sql'));
    write(out,'worker/captures.ts',read('captures.ts.txt'));
    write(out,'src/StudioCaptures.tsx',read('StudioCaptures.tsx'));
  }
  fs.appendFileSync(path.join(out,'AGENTS.md'),'\n\nTipo de agente: '+p.label+'. '+p.summary+' Sus tools están en worker/profile.ts y el servidor rechaza las demás. No cambies la lista sin revisar prompts y pruebas. Solo modo demo.\n');
  fs.appendFileSync(path.join(out,'README.md'),'\n## Tipo de agente: '+p.label+'\n\n'+p.summary+' Este tipo solo funciona en modo demo y por voz en el navegador.\n');
}

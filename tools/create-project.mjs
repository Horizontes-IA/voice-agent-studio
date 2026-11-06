import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args, studioRoot, copyBase, write, patch, json, replaceOnce } from './shared.mjs';
import { validateConfig } from './config.mjs';
import { compilePolicy } from './policy.mjs';
import { installProduction } from './production.mjs';
import { installEngine } from './engine.mjs';
import { managedKnowledge } from './knowledge.mjs';
import { VERTICALS,VERTICAL_IDS,vocabulary } from './verticals.mjs';
import { PROFILE_IDS,installProfile,profileCapabilities } from './profiles.mjs';

const KIT_VERSION=JSON.parse(fs.readFileSync(path.join(studioRoot,'package.json'),'utf8')).version;

export function createProject(config, destination, {publicDemo=false}={}) {
  const c=validateConfig(config), out=path.resolve(destination);
  if(!publicDemo)c.knowledge=managedKnowledge(c);
  if(fs.existsSync(out)) throw new Error('El destino ya existe. Elige una carpeta nueva; no se sobrescribe trabajo.');
  copyBase(out);
  if(!publicDemo) write(out,'worker/policy.ts',compilePolicy(c));
  const module = name => fs.readFileSync(path.join(studioRoot,'modules',name),'utf8');
  json(out,'business.config.json',c);
  write(out,'.gitignore','node_modules/\ndist/\n.wrangler/\n.dev.vars*\n.env*\n!.env.example\n.secrets/\ntest-results/\nplaywright-report/\n.DS_Store\n');
  write(out,'.env.example','# Documentación de nombres. El backend usa .dev.vars generado por npm run setup.\n# ELEVENLABS_API_KEY se configura en el dashboard privado o como secreto del Worker.\n');
  json(out,'wrangler.jsonc',{
    $schema:'./node_modules/wrangler/config-schema.json',name:c.slug,workers_dev:true,preview_urls:false,
    main:'worker/index.ts',compatibility_date:'2026-10-18',compatibility_flags:['nodejs_compat'],
    assets:{directory:'./dist',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*']},
    d1_databases:[{binding:'DB',database_name:c.slug,database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:'migrations'}],
    vars:{APP_ENV:'demo',CLINIC_TIMEZONE:c.timezone},triggers:{crons:['*/5 * * * *']},observability:{enabled:true,head_sampling_rate:0.1}
  });
  const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));
  pkg.name=c.slug; pkg.version=publicDemo?'1.0.0':KIT_VERSION; pkg.license=publicDemo?'MIT':'UNLICENSED'; pkg.engines={node:'>=22.22.0'};
  if(!publicDemo){
    for(const name of ['deploy.mjs','secrets.mjs'])fs.copyFileSync(path.join(studioRoot,'tools',name),path.join(out,'scripts',name));
    pkg.scripts['deploy:guided']='node scripts/deploy.mjs';
    pkg.scripts['setup']='node scripts/secrets.mjs';
  }
  pkg.scripts['setup']??='node scripts/init-secrets.mjs';
  pkg.scripts['db:local']=`wrangler d1 migrations apply ${c.slug} --local`;
  pkg.scripts['db:remote']=`wrangler d1 migrations apply ${c.slug} --remote`;
  pkg.scripts['doctor']='node scripts/doctor.mjs';
  // Freeze declared versions to the already validated lockfile, rather than drifting on 'latest'.
  const lock=JSON.parse(fs.readFileSync(path.join(out,'package-lock.json'),'utf8'));
  for(const group of ['dependencies','devDependencies']) for(const dep of Object.keys(pkg[group])) {
    const version=lock.packages['node_modules/'+dep]?.version;
    if(!version) throw new Error('No hay versión bloqueada para '+dep);
    pkg[group][dep]=version;
  }
  lock.name=pkg.name; lock.version=pkg.version; lock.packages[''].name=pkg.name;lock.packages[''].version=pkg.version;
  lock.packages[''].license=pkg.license; lock.packages[''].engines=pkg.engines;
  lock.packages[''].dependencies=pkg.dependencies; lock.packages[''].devDependencies=pkg.devDependencies;
  json(out,'package.json',pkg);json(out,'package-lock.json',lock);
  fs.copyFileSync(path.join(studioRoot,'tools/doctor.mjs'),path.join(out,'scripts/doctor.mjs'));
  patch(out,'worker/data.ts',s=>{
    s='import business from "../business.config.json";\n'+s;
    s=s.replace('export const ZONE = "America/Monterrey";','export const ZONE = business.timezone;');
    const start=s.indexOf('export const defaultAgent:');
    const end=s.indexOf('export async function getSettings');
    if(start<0||end<start) throw new Error('Base incompatible: defaultAgent');
    s=s.slice(0,start)+`export const defaultAgent: AgentSettings = {name:business.agent.name,first_message: "Hola, soy "+business.agent.name+", asistente virtual de "+business.name+". ¿Quieres agendar una cita o necesitas información?", instructions:business.agent.instructions,voice_id:"",llm:"gpt-4.1",active:true,speed:1,max_duration:600,version:1,published_version:0,remote_agent_id:"",last_published_at:null};\n`+s.slice(end);
    s=s.slice(0,s.indexOf('export const kbSeeds ='))+'export const kbSeeds = business.knowledge;\n'+module(publicDemo?'public-seed.ts.txt':'seed.ts.txt');
    if(c.kind==='garage') s=s.replace('  await db.batch(statements);',`  await db.batch(statements);\n  await db.batch([\n    db.prepare("INSERT INTO work_orders(id,patient_id,vehicle,status,public_note) VALUES(?,?,?,?,?)").bind('OT-1001','patient-1','Sedán azul · DEMO-001','inspection','El equipo está realizando la inspección inicial. Aún no hay presupuesto aprobado.'),\n    db.prepare("INSERT INTO work_orders(id,patient_id,vehicle,status,public_note) VALUES(?,?,?,?,?)").bind('OT-1002','patient-2','SUV blanca · DEMO-002','ready','El vehículo está listo para recoger. Recepción confirma los detalles de entrega.')\n  ]);`);
    return s;
  });
  const terms = vocabulary(c);
  function relabel(s){s=s.replaceAll('America/Monterrey','__STUDIO_TIMEZONE__');for(const [a,b] of terms)s=s.replaceAll(a,b);return s.replaceAll('__STUDIO_TIMEZONE__',c.timezone);}
  for(const file of ['src/main.tsx','src/lib.ts','src/VoiceDialog.tsx','worker/index.ts','worker/booking.ts','tests/browser.spec.ts','index.html']) patch(out,file,relabel);
  for(const file of ['src/main.tsx','src/VoiceDialog.tsx'])patch(out,file,s=>s.replaceAll('Sofía',c.agent.name));
  if(c.kind==='dental') for(const file of ['src/main.tsx','src/VoiceDialog.tsx','index.html']) patch(out,file,s=>s.replaceAll('Sonrisa Norte',c.name));
  patch(out,'src/lib.ts',s=>s.replaceAll('"America/Monterrey"',JSON.stringify(c.timezone)));
  patch(out,'src/main.tsx',s=>{
    s=s.replaceAll('"valoracion"',JSON.stringify(c.services[0].id));
    s=s.replaceAll('sonrisa norte',c.name.toLowerCase()).replaceAll('CLINIC OS',c.kind==='dental'?'CLINIC OS':'VOICE OS');
    s=s.replaceAll('initials="SN"','initials='+JSON.stringify(c.name.split(/\s+/).map(n=>n[0]).slice(0,2).join('')));
    if(c.kind!=='dental')s=s.replace(/Más tiempo para\s*(<br \/>)?\s*hacer sonreír\./,'Más tiempo para atender\n          a cada persona.');
    if(c.kind!=='dental'){
      const icon=VERTICALS[c.kind].icon;
      // Un icono que la base ya importa no se puede importar dos veces.
      if(!s.slice(0,s.indexOf('from "lucide-react"')).includes('  '+icon+',\n'))s=replaceOnce(s,'  Zap,\n','  '+icon+',\n  Zap,\n');
      s=s.replace(/function Tooth\([\s\S]*?\nfunction Badge\(/,`function Tooth({size=30}:{size?:number}) {return <${icon} size={size}/>;}\nfunction Badge(`);
      // El icono del espacio de trabajo era clínico; las plantillas probadas conservan su interfaz.
      if(!VERTICALS[c.kind].voiceTested){s=replaceOnce(s,'<Stethoscope size={17} />','<Tooth size={17} />');s=replaceOnce(s,'  Stethoscope,\n','');}
    }
    return s;
  });
  patch(out,'worker/eleven.ts',s=>{
    s='import business from "../business.config.json";\n'+s;
    s=s.replace('recepcionista virtual de Clínica Sonrisa Norte, una clínica ficticia en Monterrey','recepcionista virtual de ${business.name}, un negocio ficticio en ${business.city}');
    s=s.replace('Zona: America/Monterrey (UTC menos seis).','Zona: ${business.timezone}.');
    s=s.replaceAll('Sonrisa Norte','${business.name}');
    // Only template literals interpolate: these three source locations were quoted strings.
    s=s.replace('"${business.name} tools "','business.name + " tools "').replace('"${business.name} · conversaciones"','business.name + " · conversaciones"').replace('"${business.name} · "','business.name + " · "');
    s=s.replace('[SN" + id.slice','[" + business.slug + "-" + id.slice');
    if(c.kind!=='dental') {
      s=s.replace('Nunca diagnostiques, prescribas, recomiendes dosis ni decidas tratamientos.','No diagnostiques problemas de salud ni averías, no autorices presupuestos ni reparaciones.');
      s=s.replace('Para solicitudes de persona o dudas clínicas:','Para solicitudes de persona o dudas fuera de alcance:');
      s=s.replace('No reserves tratamientos quirúrgicos; ofrece valoración.','Reserva únicamente servicios del catálogo; trabajos especiales requieren revisión humana.');
    }
    if(c.kind==='garage') {
      s=replaceOnce(s,'  return defs.map(',`  defs.push(["get_my_work_orders","Consulta solo las órdenes del cliente de la sesión verificada, sin aceptar un ID de cliente.",{},[]]);\n  return defs.map(`);
      s=s.replace('# Cierre\\n','Para estado del vehículo: comprueba get_verification_status, llama get_my_work_orders y lee solo el estado y public_note. Sin promised_at no hay fecha de entrega confirmada. No afirmes listo si status no es ready.\\n# Cierre\\n');
    }
    if(!publicDemo){
      s='import { buildPolicy } from "./policy";\n'+s;
      const begin=s.indexOf('export function systemPrompt(s: AgentSettings) {');
      const end=s.indexOf('export async function publish(',begin);
      if(begin<0||end<0)throw new Error('Base incompatible: systemPrompt');
      s=s.slice(0,begin)+'export function systemPrompt(s:AgentSettings){return buildPolicy(s);}\n'+s.slice(end);
    }
    // Las plantillas probadas con voz real conservan sus descripciones de tools intactas.
    return VERTICALS[c.kind].voiceTested?s:relabel(s);
  });
  if(!publicDemo)patch(out,'worker/index.ts',s=>{
    s=s.replace('    return c.json({ error: e.code }, e.status as 400);','    return c.json({ ok:false,error:e.code,retryable:false,next_action:["SLOT_UNAVAILABLE","OPERATION_EXPIRED","SLOT_SELECTION_EXPIRED"].includes(e.code)?"search_again":"explain_unavailable" }, e.status as 400);');
    s=s.replace('"No se pudo completar la operación. Consulta el estado antes de reintentar.",','"No se pudo completar la operación. Consulta el estado antes de reintentar.",\n      ok:false,retryable:false,next_action:"explain_unavailable",');
    // Catalog and staff requests are deliberately bounded per conversation, independently of the LLM.
    return replaceOnce(s,'  let result: unknown;',`  if(["get_service_catalog","create_staff_request"].includes(name)&&!await rateLimit(db,"tool-budget:"+session.id+":"+name,2,1500))return c.json({ok:false,error:"TOOL_BUDGET_EXHAUSTED",retryable:false,next_action:"explain_unavailable"});
  let result: unknown;`);
  });
  if(c.kind==='garage') {
    write(out,'migrations/0006_work_orders.sql',module('work-orders.sql'));
    write(out,'src/StudioOrders.tsx',module('StudioOrders.tsx'));
    patch(out,'worker/index.ts',s=>{
      s=replaceOnce(s,'app.post("/api/tools/:name",',module('work-orders-routes.ts.txt')+'\napp.post("/api/tools/:name",');
      return replaceOnce(s,'if (name === "get_my_appointments")',`if (name === "get_my_work_orders") result = {orders:(await db.prepare("SELECT id,vehicle,status,public_note,promised_at FROM work_orders WHERE patient_id=? ORDER BY updated_at DESC").bind(session.patient_id).all()).results};\n    else if (name === "get_my_appointments")`);
    });
    patch(out,'src/main.tsx',s=>{
      s='import StudioOrders from "./StudioOrders";\n'+s;
      s=replaceOnce(s,'"overview" | "agenda"','"orders" | "overview" | "agenda"');
      s=replaceOnce(s,'const nav: { id: Page; label: string; icon: LucideIcon }[] = [','const nav: { id: Page; label: string; icon: LucideIcon }[] = [\n  { id: "orders", label: "Órdenes", icon: Settings2 },');
      return replaceOnce(s,'{page === "overview" && (','{page === "orders" && <StudioOrders />}\n          {page === "overview" && (');
    });
  }
  // Adapt inherited API regressions to the preset's real IDs, rather than leaving dental-only tests.
  patch(out,'tests/integration.test.ts',s=>s.replaceAll('"sonrisa-norte"',JSON.stringify(c.slug)).replaceAll('service_id=valoracion','service_id='+c.services[0].id).replaceAll('"valoracion"',JSON.stringify(c.services[0].id)).replaceAll('"ortodoncia"',JSON.stringify(c.services[2]?.id??c.services[0].id)).replaceAll('"ana"',JSON.stringify(c.providers[0].id)));
  const instructions=fs.readFileSync(path.join(studioRoot,'public/README.md'),'utf8').replaceAll('Sonrisa Norte',c.name).replaceAll('sonrisa-demo',c.slug);
  write(out,'README.md',instructions);
  write(out,'AGENTS.md',`# ${c.name}\n\nProyecto de Voice Agent Studio. Lee README.md y business.config.json antes de editar. ${publicDemo?'Motor público: dos recursos, domingo cerrado, lunes–viernes 09–19, sábado 09–14.':'Motor: recursos, moneda, zona IANA, horarios generales y por profesional, cierres y políticas en business.config.json.'} Cada cita usa un profesional y un recurso. Los documentos kb-business, kb-services, kb-team y kb-policies se generan desde la configuración. Cada despliegue usa sus propias cuentas, DB, secretos y agente. No copies recursos de otro cliente. Demo usa identidades ficticias elegidas por administrador; production exige Access y portal con OTP. No prometas capacidades sin conectar y probar.\n`);
  json(out,'implementation-report.json',{version:publicDemo?'1.0.0':KIT_VERSION,kind:c.kind,...(publicDemo?{}:{profile:c.agent.profile??'recepcion'}),business:c.name,stage:'generated-not-deployed',capabilities:profileCapabilities(c,['dashboard','knowledge-base','browser-voice-after-publishing','atomic-booking',...(c.kind==='garage'?['owned-work-order-status']:[])]),pending:['own-provider-accounts','local-tests','https-deployment','voice-selection-and-publishing','live-voice-test'],productionGaps:['individual-staff-auth','real-customer-verification','retention-policy','business-protocol-approval'],constraints:{resources:c.resources.length,timezone:c.timezone,currency:c.currency,booking:c.booking,salonPackages:'single-provider-single-resource'},testsExecuted:[]});
  if(!publicDemo)installEngine(out,c);
  if(c.mode==='production')installProduction(out,c);
  installProfile(out,c);
  return out;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const opts=args(process.argv.slice(2));
    if(opts.help){console.log('node tools/create-project.mjs --preset '+VERTICAL_IDS.join('|')+' --out /ruta/nueva\nO: --config /ruta/business.json --out /ruta/nueva\nOpcional: --profile '+PROFILE_IDS.join('|')+' --mode demo|production');process.exit(0);}
    if(!opts.out || typeof opts.out!=='string') throw new Error('Falta --out con una carpeta nueva');
    if(!opts.config&&!VERTICAL_IDS.includes(opts.preset)) throw new Error('Selecciona --preset '+VERTICAL_IDS.join('|')+' o --config archivo.json');
    const source=opts.config?path.resolve(opts.config):path.join(studioRoot,'presets',opts.preset+'.json');
    const config=JSON.parse(fs.readFileSync(source,'utf8'));if(opts.mode)config.mode=opts.mode;if(opts.profile)config.agent.profile=opts.profile;
    const out=createProject(config,opts.out);
    console.log('Proyecto generado en '+out+'\nLee README.md. Aún no se desplegó ni se consumió ElevenLabs.');
  } catch(e){console.error(e.message);process.exitCode=1;}
}

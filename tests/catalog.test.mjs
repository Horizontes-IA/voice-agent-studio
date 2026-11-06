import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { createProject } from '../tools/create-project.mjs';
import { validateConfig } from '../tools/config.mjs';
import { compilePolicy } from '../tools/policy.mjs';
import { VERTICALS,VERTICAL_IDS } from '../tools/verticals.mjs';
import { PROFILE_IDS,activeForm } from '../tools/profiles.mjs';
import { computeQuote,quoteMarkdown } from '../tools/cotizar.mjs';
import { computeValuation,valuationMarkdown } from '../tools/valorar.mjs';
import { buildReport,monthBounds,queries } from '../tools/reporte-llamadas.mjs';
import { studioRoot } from '../tools/shared.mjs';

const read=(...p)=>fs.readFileSync(path.join(studioRoot,...p),'utf8');
const preset=kind=>JSON.parse(read('presets',kind+'.json'));
const NEW=['nutricion','psicologia','pediatria','laboratorio','optica','spa','gimnasio','motos','seguros','contabilidad','manejo','eventos'];
const SKILLS=fs.readdirSync(path.join(studioRoot,'skills'));
const tmp=name=>fs.mkdtempSync(path.join(os.tmpdir(),'voice-'+name+'-'));
const DENTAL=/dental|odont|ortodon|\bdientes?\b|\bmuelas?\b|caries|sonrisa|sonre[ií]r|sill[oó]n|limpieza de rutina|clinic os/i;

test('the kit has more than 20 business templates and more than 10 skills',()=>{
  assert.equal(VERTICAL_IDS.length,21);
  for(const kind of NEW)assert.ok(VERTICAL_IDS.includes(kind),kind);
  assert.equal(SKILLS.length,12);
  for(const skill of ['cotizar-agente','dashboard-a-medida','valorar-negocio','plantilla-nueva','analizar-llamadas','conectar-telefono','propuesta-cliente','entrega-cliente'])assert.ok(SKILLS.includes(skill),skill);
});
test('new templates are complete, distinct and validate',()=>{
  const seen={slug:new Set(),name:new Set(),agent:new Set()};
  for(const kind of VERTICAL_IDS){
    const c=preset(kind);
    for(const [key,value] of [['slug',c.slug],['name',c.name],['agent',c.agent.name]]){assert.ok(!seen[key].has(value),kind+' repite '+key+': '+value);seen[key].add(value);}
  }
  for(const kind of NEW){
    const c=validateConfig(preset(kind));
    assert.ok(c.providers.length>=2,kind);assert.ok(c.services.length>=3,kind);assert.ok(c.resources.length>=2,kind);
    assert.ok(c.services.some(s=>s.specialty!==c.providers[0].specialty),kind+': el catálogo necesita un servicio de otra especialidad para probar compatibilidad');
    assert.deepEqual(c.knowledge.map(d=>d.id),['kb-business','kb-services','kb-team','kb-policies','kb-prices','kb-first','kb-escalation','kb-faq']);
    assert.ok(VERTICALS[kind].process.length<=70,kind);assert.equal(VERTICALS[kind].voiceTested,false);
    assert.ok(!/\+\d{7,}|\b\d{3}[ -]\d{3}[ -]\d{4}\b|@[a-z]+\.[a-z]/i.test(JSON.stringify(c)),kind+': no debe traer contactos');
  }
});
test('new templates keep the brand palette, without cyan',()=>{
  for(const kind of NEW)for(const p of preset(kind).providers){
    const [r,g,b]=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16));
    assert.ok(!(b>r&&g>r),kind+' '+p.color);
  }
});
test('health templates refuse diagnosis and send emergencies elsewhere',()=>{
  const health=VERTICAL_IDS.filter(k=>VERTICALS[k].health);
  assert.deepEqual(health,['veterinaria','fisioterapia','nutricion','psicologia','pediatria','laboratorio','optica']);
  for(const kind of health){
    const prompt=read('prompts',kind+'.md');
    assert.match(prompt,/No diagnostiques|no diagnostiques/,kind);
    assert.match(prompt,/urgencia|atención médica de inmediato/,kind);
    assert.match(prompt,/medicamentos?|ejercicios|dietas|gotas/,kind);
  }
  const crisis=read('prompts/psicologia.md');
  assert.match(crisis,/hacerse daño/);assert.match(crisis,/No inventes números/);
});
test('every new business has a scenario for its main limit',()=>{
  const cases=JSON.parse(read('evaluations/policy-cases.json'));
  for(const kind of NEW){
    const own=cases.filter(c=>c.kind===kind);assert.ok(own.length>=1,kind);
    for(const c of own){assert.ok(c.criteria.length>=2,c.id);assert.ok(!DENTAL.test(c.scenario),c.id);}
  }
  assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
});
test('reception of the voice-tested templates keeps its exact generated code',()=>{
  // Sumas de la 1.2. Si cambian, la evidencia de voz real de VALIDACION.md deja de aplicar.
  const expected={
    dental:['a6e88b8ed151c712784763add0cf455cfd0e00f4556d80e5fe80dc200be758c9','0c8b678738b06f83d4938211697bd4936a3779642890d67d38fc296f4ae823d8'],
    salon:['04bdd1c1496c8a8d80bcdd46ed5f893f5c39bd8f829df7d909e7900dd98f117a','0c8b678738b06f83d4938211697bd4936a3779642890d67d38fc296f4ae823d8'],
    garage:['f16fc5d145799ac1ceafb6d136148a19a0d9575168b893b0e592c2f7546ea42a','ec2f68bb03afe36b19ff9e98e1cb3935eb3a0f4fdc6724a3f3fc01bc1dd80e6a'],
  };
  const root=tmp('regression');
  try{
    for(const [kind,[policy,eleven]] of Object.entries(expected)){
      const out=createProject(preset(kind),path.join(root,kind)),sha=f=>createHash('sha256').update(fs.readFileSync(path.join(out,f))).digest('hex');
      assert.equal(sha('worker/policy.ts'),policy,kind+' policy');assert.equal(sha('worker/eleven.ts'),eleven,kind+' eleven');
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
  assert.deepEqual(VERTICAL_IDS.filter(k=>VERTICALS[k].voiceTested),['dental','salon','garage']);
});
test('only voice-tested templates keep the Mexican accent line in the core prompt',()=>{
  assert.ok(compilePolicy(validateConfig(preset('dental'))).includes('Atiendes en español mexicano.'));
  for(const kind of NEW)assert.ok(!compilePolicy(validateConfig(preset(kind))).includes('Atiendes en español mexicano.'),kind);
});
test('generated projects keep each business vocabulary, without dental wording',()=>{
  const root=tmp('vocabulary');
  try{
    for(const kind of VERTICAL_IDS.filter(k=>k!=='dental')){
      const out=createProject(preset(kind),path.join(root,kind)),v=VERTICALS[kind];
      for(const file of ['src/main.tsx','src/lib.ts','src/VoiceDialog.tsx','worker/index.ts','worker/booking.ts','worker/eleven.ts','worker/policy.ts','worker/data.ts','index.html','business.config.json','README.md','tests/browser.spec.ts']){
        const text=fs.readFileSync(path.join(out,file),'utf8');
        const visible=file==='src/main.tsx'?text.replace(/\bTooth\b/g,''):text;
        if(!(['salon','garage'].includes(kind)&&file==='worker/eleven.ts'))assert.ok(!DENTAL.test(visible.replaceAll('{{clinic_date}}','')),kind+' '+file+': '+visible.match(DENTAL)?.[0]);
        if(!NEW.includes(kind))continue;
        const clean=text.replace(/get_clinic_status|clinic_session|clinic_date|patient_\w+/g,'');
        if(!v.clinic)assert.ok(!/cl[ií]nic/i.test(clean),kind+' '+file+': clínica');
        if(!v.patients)assert.ok(!/pacient/i.test(clean),kind+' '+file+': paciente');
      }
      if(NEW.includes(kind)){
        const ui=fs.readFileSync(path.join(out,'src/main.tsx'),'utf8');
        assert.ok(!ui.includes('Stethoscope'),kind);assert.ok(ui.includes('  '+v.icon+',\n'),kind);
        if(!v.health)assert.ok(!ui.includes('no receta'),kind);
      }
    }
    assert.ok(fs.readFileSync(path.join(root,'gimnasio/src/main.tsx'),'utf8').includes('Tus socios'));
    assert.ok(fs.readFileSync(path.join(root,'manejo/src/main.tsx'),'utf8').includes('Tus alumnos'));
    assert.ok(fs.readFileSync(path.join(root,'pediatria/src/main.tsx'),'utf8').includes('Tus pacientes'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('every new template generates with every agent type and in production',()=>{
  const root=tmp('combos');
  try{
    for(const kind of NEW){
      for(const profile of PROFILE_IDS){const c=preset(kind);if(profile!=='recepcion')c.agent.profile=profile;createProject(c,path.join(root,kind+'-'+profile));}
      const c=preset(kind);c.mode='production';const out=createProject(c,path.join(root,kind+'-production'));
      assert.ok(fs.existsSync(path.join(out,'worker/production/access.ts')),kind);
    }
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('custom qualifying questions fit their own form',()=>{
  for(const kind of ['seguros','gimnasio','manejo','eventos']){
    const c=preset(kind);c.agent.profile='calificador';const form=activeForm(validateConfig(c));
    assert.notEqual(form.fields[0].id,'necesidad',kind);assert.equal(form.samples.length,3,kind);
    for(const s of form.samples)for(const f of form.fields){
      if(f.required)assert.ok(s.answers[f.id],kind+' '+f.id);
      if(f.type==='choice'&&s.answers[f.id]!==undefined)assert.ok(f.options.includes(s.answers[f.id]),kind+' '+f.id);
    }
  }
});

test('every skill has valid frontmatter and Codex metadata',()=>{
  for(const dir of SKILLS){
    const text=read('skills',dir,'SKILL.md'),front=text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(front,dir);
    const entries=front[1].split('\n').map(line=>{const i=line.indexOf(': ');return [line.slice(0,i),line.slice(i+2)];});
    assert.deepEqual(entries.map(e=>e[0]),['name','description'],dir);
    const {name,description}=Object.fromEntries(entries);
    assert.equal(name,dir);assert.match(name,/^[a-z0-9]+(-[a-z0-9]+)*$/);assert.ok(name.length<=64,dir);
    // Sin comillas, ": " o un inicio especial rompen el YAML; "<" y ">" los rechaza el validador de Codex.
    assert.ok(!description.includes(': ')&&!/^[\[{"'&*!|>%@`]/.test(description)&&!/[<>]/.test(description),dir);
    assert.ok(description.length>=60&&description.length<=1024,dir);assert.match(description,/Usar (cuando|para)/,dir);
    const yaml=read('skills',dir,'agents/openai.yaml');
    const field=k=>yaml.match(new RegExp('^  '+k+': "([^"]*)"$','m'))?.[1];
    assert.ok(field('display_name')?.length<=24,dir);
    assert.ok(field('short_description')?.length>=25&&field('short_description').length<=64,dir);
    assert.ok(field('default_prompt')?.includes('$'+dir),dir);
  }
});
test('skills are portable, concrete and only name files that exist',()=>{
  for(const dir of SKILLS){
    const text=read('skills',dir,'SKILL.md');
    assert.ok(!/\/Users\/|\bsant(i|iago)\b|horizontesia\.com|@gmail|innovandohorizontes|2,500/i.test(text),dir+': dato personal');
    assert.ok(text.split('\n').length>=20,dir);assert.match(text,/`[^`]+`/,dir);
    for(const m of text.matchAll(/`((?:tools|materials|presets|prompts|evaluations|production|skills)\/[^`\s<]+)`/g)){if(!m[1].endsWith('/'))assert.ok(fs.existsSync(path.join(studioRoot,m[1])),dir+': '+m[1]);}
    for(const m of text.matchAll(/`(tools\/[^`\s]+\.mjs)/g))assert.ok(fs.existsSync(path.join(studioRoot,m[1])),dir+': '+m[1]);
    for(const m of text.matchAll(/\]\((references\/[^)]+)\)/g))assert.ok(fs.existsSync(path.join(studioRoot,'skills',dir,m[1])),dir+': '+m[1]);
    for(const m of text.matchAll(/`([a-z]+-[a-z-]+)`/g))if(/^(agente-|cotizar-|valorar-|dashboard-a-|plantilla-|analizar-|conectar-|propuesta-|entrega-|voice-agent-)/.test(m[1]))assert.ok(SKILLS.includes(m[1]),dir+': '+m[1]);
  }
});
test('honesty limits stay in the skills that need them',()=>{
  assert.match(read('skills/conectar-telefono/SKILL.md'),/\*\*Esta conexión no está probada\.\*\*/);
  assert.match(read('skills/conectar-telefono/agents/openai.yaml'),/Requiere desarrollo y pruebas/);
  assert.match(read('skills/valorar-negocio/SKILL.md'),/nunca inventes una cifra/);
  assert.match(read('skills/cotizar-agente/SKILL.md'),/Nunca escribas una tarifa de memoria/);
  assert.match(read('skills/plantilla-nueva/SKILL.md'),/No pongas `voiceTested: true`/);
  assert.match(read('skills/entrega-cliente/SKILL.md'),/NOT_RUN/);
  assert.match(read('skills/propuesta-cliente/SKILL.md'),/listo para producción/);
});
test('the dashboard recipe matches the generated code',()=>{
  const root=tmp('dashboard');
  try{
    const recipe=read('skills/dashboard-a-medida/references/pagina-metricas.md');
    const calificador=preset('seguros');calificador.agent.profile='calificador';
    for(const [name,config] of [['recepcion',preset('gimnasio')],['calificador',calificador],['production',{...preset('motos'),mode:'production'}]]){
      const out=createProject(config,path.join(root,name)),ui=fs.readFileSync(path.join(out,'src/main.tsx'),'utf8'),api=fs.readFileSync(path.join(out,'worker/index.ts'),'utf8');
      for(const marker of ['"overview" | "agenda"','const nav: { id: Page;','{page === "overview" && (','const metrics = [','Activity as ActivityIcon'])assert.ok(ui.includes(marker),name+': '+marker);
      assert.ok(api.includes('app.post("/api/tools/:name",'),name);
      for(const table of ['conversations','appointments','staff_requests'])assert.ok(fs.readFileSync(path.join(out,'migrations/0001_initial.sql'),'utf8').includes('CREATE TABLE '+table),table);
    }
    assert.ok(recipe.includes('app.post("/api/tools/:name",'));assert.ok(recipe.includes('{page === "overview" && ('));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

function runPage(file,values){
  const html=read(file),script=html.match(/<script>([\s\S]*)<\/script>/)[1],elements={};
  const get=id=>elements[id]??={value:'',validity:{valid:true},textContent:'',innerHTML:'',addEventListener(_,fn){elements.__update=fn;}};
  for(const m of html.matchAll(/<input id="(\w+)"[^>]*?(?: value="([^"]*)")?>/g))get(m[1]).value=m[2]??'';
  for(const [k,v] of Object.entries(values))get(k).value=String(v);
  vm.runInNewContext(script,{document:{getElementById:get},Intl,Math,Number});
  return {text:id=>get(id).textContent,html:id=>get(id).innerHTML};
}
const SAMPLE={cliente:'Negocio',moneda:'USD',fuente_costos:'Prueba',conversaciones:800,minutos_por_conversacion:2.5,costo_voz_minuto:0.09,costo_modelo_minuto:0.015,costo_telefonia_minuto:0.02,fijos:40,variables:15,horas_operacion:3,costo_hora:25,contingencia_pct:15,margen_pct:35,implementacion:3000};
test('the quote tool and the calculator give the same numbers',()=>{
  const r=computeQuote(SAMPLE),usd=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD'}).format(v);
  const page=runPage('materials/business/calculadora.html',{conversations:800,duration:2.5,voice:0.09,model:0.015,phone:0.02,fixed:40,variable:15,hours:3,hour:25,reserve:15,margin:35,setup:3000});
  assert.equal(page.text('minutes'),'2,000');assert.equal(page.text('cost'),usd(r.costo));assert.equal(page.text('price'),usd(r.mensualidad));assert.equal(page.text('extra'),usd(r.minutoExcedente));assert.equal(page.text('implementation'),usd(3000));
  assert.ok(page.html('lines').includes('Telefonía'));
  assert.ok(Math.abs(r.costo-(2000*0.125+40+15+75)*1.15)<1e-9);assert.ok(Math.abs(r.mensualidad-r.costo/0.65)<1e-9);assert.ok(Math.abs(r.lineas.voz-180)<1e-9);
});
test('the calculator keeps its previous default result',()=>{
  const page=runPage('materials/business/calculadora.html',{});
  assert.equal(page.text('cost'),new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD'}).format(385.2));
  assert.equal(page.text('price'),new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD'}).format(642));
});
test('the quote refuses missing data and separates what the client sees',()=>{
  assert.throws(()=>computeQuote({...SAMPLE,costo_voz_minuto:undefined}),/costo_voz_minuto/);
  assert.throws(()=>computeQuote({...SAMPLE,fuente_costos:''}),/fuente_costos/);
  assert.throws(()=>computeQuote({...SAMPLE,margen_pct:96}),/margen_pct/);
  const text=quoteMarkdown(SAMPLE),[client,internal]=text.split('## Interno');
  assert.ok(client.includes('Mensualidad'));assert.ok(!client.includes('Contingencia'));assert.ok(!client.includes('Prueba'));
  assert.ok(internal.includes('Origen de las tarifas: Prueba'));assert.ok(internal.includes('Costo de proveedores por minuto'));
  const example=read('skills/cotizar-agente/SKILL.md').match(/```json\n([\s\S]*?)```/)[1].replace(/^ {3}/gm,'');
  assert.ok(computeQuote(JSON.parse(example)).mensualidad>0);
});
const OWNER={negocio:'Negocio',moneda:'MXN',fuente:'Dueño',llamadas_mes:1000,perdidas_pct:30,conversion_pct:50,valor_cita:800,margen_pct:50};
const PRICED={mensualidad:6000,implementacion:30000};
test('the valuation never fills in a number and shows what pays the agent',()=>{
  for(const key of Object.keys(OWNER)){const {[key]:_,...rest}=OWNER;assert.throws(()=>computeValuation(rest),new RegExp(key),key);}
  assert.throws(()=>computeValuation({...OWNER,valor_cita:0}),/mayores que cero/);
  assert.throws(()=>computeValuation({...OWNER,llamadas_mes:0}),/llamadas_mes/);
  assert.throws(()=>computeValuation({...OWNER,perdidas_pct:130}),/perdidas_pct/);
  assert.throws(()=>computeValuation({...OWNER,perdidas_pct:0.3}),/fracción/);
  assert.throws(()=>computeValuation({...OWNER,mensualidad:6000}),/implementacion/);
  assert.throws(()=>computeValuation({...OWNER,mensualidad:0,implementacion:0}),/mensualidad/);
  assert.throws(()=>computeValuation({...OWNER,recuperable_pct:[20]}),/recuperable_pct/);
  const first=computeValuation(OWNER),firstText=valuationMarkdown(OWNER);
  assert.equal(first.llamadasPerdidas,300);assert.equal(first.citasPerdidas,150);assert.equal(first.ingresoPerdido,120000);assert.equal(first.citasParaCubrir,null);
  assert.ok(firstText.includes('Falta la cotización'));assert.ok(firstText.includes('Es un techo'));assert.ok(firstText.includes('MXN'));
  const r=computeValuation({...OWNER,...PRICED}),text=valuationMarkdown({...OWNER,...PRICED});
  assert.equal(r.citasParaCubrir,15);assert.deepEqual(r.escenarios,[]);
  assert.ok(!text.includes('Escenarios'));assert.ok(text.includes('15 citas recuperadas'));assert.ok(text.includes('No es una promesa'));
  const [low,high]=computeValuation({...OWNER,...PRICED,recuperable_pct:[5,40]}).escenarios;
  assert.equal(low.mesesRecuperacion,null);assert.equal(high.citas,60);assert.equal(high.neto,18000);
  assert.ok(valuationMarkdown({...OWNER,...PRICED,recuperable_pct:[5,40]}).includes('No se recupera'));
  assert.deepEqual(Object.keys(JSON.parse(read('skills/valorar-negocio/SKILL.md').match(/```json\n([\s\S]*?)```/)[1].replace(/^ {3}/gm,''))),Object.keys(OWNER));
});
test('the valuation page starts empty and matches the tool',()=>{
  const n=v=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(v);
  for(const m of read('materials/business/valoracion.html').matchAll(/<input id="\w+"[^>]*>/g))assert.ok(!/ value=/.test(m[0]),m[0]);
  const empty=runPage('materials/business/valoracion.html',{});assert.ok(empty.text('validation').includes('Completa'));assert.equal(empty.text('breakEven'),'—');
  const unpriced=runPage('materials/business/valoracion.html',{calls:1000,lost:30,conversion:50,value:800,margin:50});
  assert.equal(unpriced.text('lostBookings'),n(150));assert.equal(unpriced.text('breakEven'),'—');assert.equal(unpriced.text('validation'),'');
  const page=runPage('materials/business/valoracion.html',{calls:1000,lost:30,conversion:50,value:800,margin:50,monthly:6000,setup:30000,recoverable:40});
  const r=computeValuation({...OWNER,...PRICED,recuperable_pct:[40]});
  assert.equal(page.text('lostCalls'),n(r.llamadasPerdidas));assert.equal(page.text('breakEven'),n(r.citasParaCubrir));assert.equal(page.text('net'),n(r.escenarios[0].neto));assert.equal(page.text('payback'),n(r.escenarios[0].mesesRecuperacion));
});
test('the monthly report reads counts only and uses the business time zone',()=>{
  const [from,to]=monthBounds('2026-10','America/Bogota');
  assert.equal(from,'2026-10-01 05:00:00');assert.equal(to,'2026-11-01 05:00:00');
  assert.deepEqual(monthBounds('2026-12','America/Mexico_City'),['2026-12-01 06:00:00','2027-01-01 06:00:00']);
  assert.throws(()=>monthBounds('2026-13','America/Bogota'),/YYYY-MM/);
  const q=queries(from,to,true);
  for(const sql of Object.values(q)){assert.match(sql,/^SELECT /);assert.ok(!/\b(name|phone|email|summary|transcript|reason|answers|patient_id)\b/.test(sql),sql);}
  const config={...preset('motos'),openingHours:{1:[['09:00','19:00']]}};
  const data={calls:[{started_at:'2026-10-05 15:00:00',duration:120,status:'done'},{started_at:'2026-10-06 03:00:00',duration:60,status:'done'},{started_at:'2026-10-07 15:00:00',duration:0,status:'active'}],appointments:[{source:'agent',status:'booked',n:3},{source:'agent',status:'cancelled',n:1},{source:'demo',status:'booked',n:50}],requests:[{category:'agenda',priority:'high',status:'open',n:2},{category:'humano',priority:'normal',status:'resolved',n:1}],waitlist:[{n:4}]};
  const later=Date.parse('2026-12-15T12:00:00Z'),text=buildReport({config,month:'2026-10',data,now:later});
  assert.ok(text.includes('modo demo'));assert.ok(!text.includes('Mes en curso'));
  assert.ok(buildReport({config,month:'2026-10',data,now:Date.parse('2026-10-20T12:00:00Z')}).includes('Mes en curso'));
  assert.ok(!buildReport({config:{...config,mode:'production'},month:'2026-10',data,now:later}).includes('modo demo'));
  assert.ok(buildReport({config,month:'2026-10',data:{...data,calls:[]},now:later}).includes('sin ninguna conversación'));
  assert.ok(text.includes('| Duración promedio de las sincronizadas | 1.5 min |'));
  assert.ok(text.includes('| Conversaciones | 3 |'));assert.ok(text.includes('| Minutos | 3 |'));assert.ok(text.includes('| Fuera del horario del negocio | 2 |'));assert.ok(text.includes('| Sin datos sincronizados de ElevenLabs | 1 |'));
  assert.ok(text.includes('| Citas creadas por el agente | 4 |'));assert.ok(text.includes('| De esas, canceladas después | 1 |'));assert.ok(text.includes('| Sin resolver | 2 |'));assert.ok(text.includes('Sin dato: no se indicó --costo-minuto'));
  const costed=buildReport({config,month:'2026-10',data,costPerMinute:0.1,costCurrency:'USD',now:later});assert.ok(costed.includes('USD'));assert.ok(costed.includes('3 min'));
});

test('documents agree on the counts and do not repeat the old ones',()=>{
  const readme=read('README.md'),start=read('INICIO.html');
  const rows=readme.split('## 21 negocios')[1].split('\n## ')[0].split('\n').filter(l=>l.startsWith('| ')&&!l.startsWith('| Negocio'));
  assert.equal(rows.length,VERTICAL_IDS.length);
  for(const kind of VERTICAL_IDS){
    assert.ok(rows.some(r=>r.includes('`'+kind+'`')),kind);assert.ok(start.includes('presets/'+kind+'.json'),kind);
    assert.ok(rows.some(r=>r.includes('`'+kind+'`')&&r.trim().endsWith(VERTICALS[kind].voiceTested?'Probada |':'Por probar |')),kind);
  }
  for(const skill of SKILLS){assert.ok(readme.includes('`'+skill+'`'),skill);assert.ok(start.includes('skills/'+skill+'/SKILL.md'),skill);}
  for(const m of start.matchAll(/href="([^"#]+)"/g))assert.ok(fs.existsSync(path.join(studioRoot,m[1])),m[1]);
  // materials/launch es interno: existe en la fuente, no en el paquete público.
  const docs=['README.md','INICIO.html','USO.md','materials/launch/OFERTA.md','public/README.md','skills/voice-agent-studio/SKILL.md','skills/voice-agent-studio/references/configuration.md','evaluations/README.md'].filter(doc=>fs.existsSync(path.join(studioRoot,doc)));
  for(const doc of docs)assert.ok(!/nueve (plantillas|negocios)|Nueve negocios|cuatro skills|versión 1\.2|· v1\.2/i.test(read(doc)),doc);
  for(const doc of ['README.md','INICIO.html','public/README.md','materials/workshop/FACILITADOR.md'])assert.ok(!/privado para miembros|repositorio de miembros|repositorio privado/i.test(read(doc)),doc);
  assert.ok(!/mínimo interno|consultoría de Santi/.test(read('materials/business/03-propuesta.md')));
  assert.ok(fs.existsSync(path.join(studioRoot,'AGENTS.md'))&&fs.existsSync(path.join(studioRoot,'CLAUDE.md')));
  for(const doc of ['README.md','INICIO.html','materials/launch/OFERTA.md','public/README.md'].filter(doc=>fs.existsSync(path.join(studioRoot,doc))))assert.match(read(doc),/\b21 plantillas|\b21 negocios/,doc);
  const pkg=JSON.parse(read('package.json'));assert.equal(pkg.version,'1.3.1');assert.equal(JSON.parse(read('package-lock.json')).version,'1.3.1');
  assert.ok(read('CHANGELOG.md').startsWith('# Cambios\n\n## 1.3.1'));assert.ok(read('VALIDACION.md').startsWith('# Validación de entrega · v1.3.1'));
  assert.match(read('VALIDACION.md').split('\n---\n')[0],/NOT_RUN/);
});

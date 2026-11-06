import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {args} from './shared.mjs';
const opts=args(process.argv.slice(2));
if(!opts.project||!opts.origin)throw new Error('Usa --project /ruta/demo --origin https://tu-worker.workers.dev [--move]');
const project=path.resolve(opts.project),origin=new URL(opts.origin).origin;
const config=JSON.parse(fs.readFileSync(path.join(project,'business.config.json'),'utf8'));
if(config.mode==='production')throw new Error('Esta prueba crea y cancela citas ficticias. Usa una instalación demo aislada.');
if((config.agent.profile??'recepcion')!=='recepcion')throw new Error('Esta prueba reserva citas y solo aplica al agente de recepción. Para este tipo de agente usa tools/evaluate-eleven.mjs y una prueba hablada.');
const require=createRequire(path.join(project,'package.json')),{chromium,expect}=require('@playwright/test');
const output=path.join(project,'.secrets/voice-qa-'+Date.now());fs.mkdirSync(output,{recursive:true,mode:0o700});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({permissions:['microphone'],viewport:{width:1440,height:1000}}),page=await context.newPage();
const evidence={kind:config.kind,origin,date:new Date().toISOString(),status:'RUNNING',input:'typed messages over the real ElevenLabs voice session; fake microphone',asrTested:false,audioFrames:0,transcript:[],browserErrors:[],checks:[]};
page.on('pageerror',e=>evidence.browserErrors.push(e.message));
page.on('websocket',ws=>ws.on('framereceived',frame=>{try{const event=JSON.parse(frame.payload.toString());if(event.type==='audio')evidence.audioFrames++;if(event.type==='agent_response')evidence.transcript.push(event.agent_response_event?.agent_response);if(event.type==='error')evidence.browserErrors.push('ElevenLabs conversation error');}catch{}}));
const api=async(endpoint,body)=>{const response=body===undefined?await context.request.get(origin+'/api'+endpoint):await context.request.post(origin+'/api'+endpoint,{data:body});if(!response.ok())throw new Error('API '+endpoint+' HTTP '+response.status());return response.json();};
let sessionId='';
try{
  await api('/auth/login',{password:fs.readFileSync(path.join(project,'.secrets/admin-password.txt'),'utf8').trim()});
  const dashboard=await api('/dashboard'),patient=dashboard.patients.find(p=>p.id==='patient-1');
  const service=config.services.find(s=>s.id==='ritual')??config.services[0];
  const provider=config.providers.find(p=>p.specialty===service.specialty);
  let selected,date;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(let offset=35;offset<Math.min(65,config.booking.maxAdvanceDays);offset++){
    const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);date=d.toISOString().slice(0,10);
    const result=await api('/availability?service_id='+service.id+'&provider_id='+provider.id+'&date='+date);
    if(result.slots.length>2){selected=result.slots[0];break;}
  }
  if(!selected)throw new Error('Sin ventana para la prueba aislada.');
  const label=new Intl.DateTimeFormat('es-MX',{timeZone:config.timezone,day:'numeric',month:'long',year:'numeric'}).format(new Date(selected.starts_at));
  const time=new Intl.DateTimeFormat('es-MX',{timeZone:config.timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(selected.starts_at));
  await page.goto(origin);await page.locator('.heading-actions').getByRole('button',{name:'Probar agente'}).click();
  await page.getByRole('dialog').locator('select').selectOption(patient.id);
  const [session]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/voice/session'),{timeout:45000}),page.getByRole('dialog').getByRole('button',{name:'Iniciar conversación',exact:true}).click()]);
  if(!session.ok())throw new Error('No se inició la sesión de voz: HTTP '+session.status()+'. '+JSON.stringify(await session.json()));
  sessionId=(await session.json()).session_id;
  await page.getByRole('button',{name:'Terminar prueba',exact:true}).waitFor({timeout:45000});
  await page.getByRole('button',{name:'Silenciar micrófono',exact:true}).click();
  const agentMessages=page.locator('.live-messages .transcript-message.ai');
  await expect(agentMessages).not.toHaveCount(0,{timeout:30000});
  const listen=()=>page.getByRole('heading',{name:'Te escucho.',exact:true}).waitFor({timeout:45000});
  const send=async text=>{await listen();await page.getByRole('textbox',{name:'Enviar un mensaje al agente'}).fill(text);await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();};
  const state=()=>api('/voice/'+sessionId+'/status');
  const prepared=async()=>{await expect.poll(async()=>(await state()).operation?.state,{timeout:65000,intervals:[1000,2000]}).toBe('prepared');await expect(agentMessages.last()).toContainText(/confirm|autoriza|proced|parece bien/i,{timeout:30000});await listen();};
  const committed=()=>expect.poll(async()=>(await state()).operation?.state,{timeout:65000,intervals:[1000,2000]}).toBe('committed');
  const count=await agentMessages.count();
  await send(`Soy ${patient.name}, la persona ficticia de esta sesión. Quiero reservar ${service.name} para mí el ${label} a las ${time} con ${provider.name}. Ese es el servicio y horario que elijo; prepara el resumen para revisarlo.`);
  await expect.poll(()=>agentMessages.count(),{timeout:40000}).toBeGreaterThan(count);await listen();
  if((await state()).operation?.state!=='prepared')await send(`Elijo la opción de las ${time} con ${provider.name} para ${service.name} el ${label}. Prepara esa opción y léeme el resumen antes de confirmar.`);
  await prepared();
  await send('Sí, confirmo esa reserva que acabas de resumir.');await committed();
  let d=await api('/dashboard');let appointment=d.appointments.find(a=>a.patient_id===patient.id&&a.source==='agent'&&a.service_id===service.id&&a.starts_at===selected.starts_at&&a.status==='booked');
  if(!appointment)throw new Error('La reserva no coincide con la intención de la prueba.');
  if((Date.parse(appointment.occupied_until)-Date.parse(appointment.starts_at))/60000!==service.duration+service.buffer)throw new Error('Duración o buffer incorrectos.');
  evidence.checks.push({name:'create-after-confirmation',status:'PASS',service:service.id,duration:service.duration,buffer:service.buffer});
  if(opts.move){
    await listen();const options=await api('/availability?service_id='+service.id+'&date='+date+'&provider_id='+provider.id+'&appointment_id='+appointment.id),next=options.slots.find(s=>s.starts_at!==appointment.starts_at&&Date.parse(s.starts_at)>Date.parse(appointment.occupied_until));
    if(!next)throw new Error('Falta segunda opción para cambio.');
    const nextTime=new Intl.DateTimeFormat('es-MX',{timeZone:config.timezone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(next.starts_at));
    await send(`Quiero cambiar únicamente la cita de ${service.name} que acabamos de reservar al mismo día ${label}, a las ${nextTime}, con ${provider.name}. Prepara el cambio y pídeme confirmación.`);
    await prepared();await send('Sí, confirmo ese cambio al nuevo horario.');await committed();
    d=await api('/dashboard');appointment=d.appointments.find(a=>a.id===appointment.id);if(appointment.starts_at!==next.starts_at)throw new Error('El cambio no se guardó en la cita original.');
    evidence.checks.push({name:'move-same-appointment-after-confirmation',status:'PASS'});
  }
  await listen();await send(`Quiero cancelar únicamente la cita de ${service.name} que acabamos de gestionar. Todavía no la canceles: prepara la cancelación y léeme qué se cancelará para que confirme.`);
  await prepared();
  d=await api('/dashboard');if(d.appointments.find(a=>a.id===appointment.id)?.status!=='booked')throw new Error('Cancelación ejecutada antes de confirmación.');
  await send('Sí, confirmo cancelar esa cita.');await committed();
  d=await api('/dashboard');if(d.appointments.find(a=>a.id===appointment.id)?.status!=='cancelled')throw new Error('Cancelación no persistida.');
  evidence.checks.push({name:'cancel-after-confirmation',status:'PASS'});
  if(config.kind==='garage'){
    await listen();const previous=await agentMessages.count();await send('Ahora consulta el estado de mi vehículo y dime la nota pública de mi orden.');
    await expect.poll(()=>agentMessages.count(),{timeout:40000}).toBeGreaterThan(previous);await listen();
    await expect(agentMessages.last()).toContainText(/inspecci|revisi|presupuesto/i,{timeout:30000});
    evidence.checks.push({name:'own-work-order-read',status:'PASS'});
  }
  if(!evidence.audioFrames)throw new Error('No se recibieron frames de audio del proveedor.');
  if(evidence.browserErrors.length)throw new Error('Errores de navegador durante conversación.');
  await page.screenshot({path:path.join(output,'conversation.png'),fullPage:true});evidence.status='PASS';
}catch(e){evidence.status='FAIL';evidence.error=e.message;fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2),{mode:0o600});try{await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});}catch{}process.exitCode=1;}
finally{
  try{await page.getByRole('button',{name:'Terminar prueba',exact:true}).click({timeout:3000});}catch{}
  await browser.close();fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(evidence,null,2),{mode:0o600});
  console.log(JSON.stringify({kind:evidence.kind,status:evidence.status,checks:evidence.checks,audioFrames:evidence.audioFrames,asrTested:false,error:evidence.error,output},null,2));
}

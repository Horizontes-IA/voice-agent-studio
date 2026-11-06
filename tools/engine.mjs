import fs from 'node:fs';
import path from 'node:path';
import {studioRoot,write,patch,replaceOnce} from './shared.mjs';
export function installEngine(out,c){
  write(out,'worker/rules.ts',fs.readFileSync(path.join(studioRoot,'modules/rules.ts'),'utf8'));
  patch(out,'worker/data.ts',s=>'import { candidateStarts } from "./rules";\n'+s);
  patch(out,'worker/booking.ts',s=>{
    s='import business from "../business.config.json";\nimport { candidateStarts,withinSchedule,resourceAllowed,validLocalDate,localDayBounds } from "./rules";\n'+s;
    s=replaceOnce(s,'![1, 2].includes(chair)','!resourceAllowed(business,serviceId,chair)');
    s=s.replaceAll('90 * 86400_000','business.booking.maxAdvanceDays * 86400_000');
    const begin=s.indexOf('  const weekday = Number(formatInTimeZone(start, ZONE, "i")) % 7;'),end=s.indexOf('  const blocked = await db',begin);
    if(begin<0||end<0)throw new Error('Base incompatible: validación de horario');
    s=s.slice(0,begin)+`  if(!withinSchedule(business,providerId,start,s.duration+s.buffer))throw new BusinessError("OUTSIDE_SCHEDULE",400);
  const end=new Date(start.getTime()+s.duration*60000),occupied=new Date(end.getTime()+s.buffer*60000);
`+s.slice(end);
    s=s.replace('!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)','!validLocalDate(date)');
    s=s.replace('const startDay = fromZonedTime(date + "T00:00:00", ZONE);','const [startDay,nextDay] = localDayBounds(business,date);');
    s=s.replace('new Date(startDay.getTime() + 86400_000).toISOString()','nextDay.toISOString()');
    const filterStart=s.indexOf('  const weekday = new Date(date + "T12:00:00Z").getUTCDay();'),loopBody=s.indexOf('      if (start.getTime() < Date.now()) continue;',filterStart);
    if(filterStart<0||loopBody<0)throw new Error('Base incompatible: búsqueda de horarios');
    s=s.slice(0,filterStart)+`  const slots:Slot[]=[];
  for(const p of providers){
    if(p.specialty!==service.specialty||(providerId&&p.id!==providerId))continue;
    for(const start of candidateStarts(business,date,p.id,service.duration+service.buffer)){
`+s.slice(loopBody);
    s=s.replace('for (const chair of [1, 2])','for (const chair of business.resources.map(r=>r.id).filter(id=>resourceAllowed(business,serviceId,id)))');
    s=s.replace('Date.now() < 86400_000','Date.now() < business.booking.cancellationHours*3600000');
    return s;
  });
  patch(out,'worker/index.ts',s=>{
    s='import business from "../business.config.json";\nimport {statusRules} from "./rules";\n'+s;
    s=s.replace('chair: z.number().int().min(1).max(2).optional()','chair: z.number().int().min(1).max(business.resources.length).optional()');
    s=replaceOnce(s,'      date: today(),\n      timezone: ZONE,\n      hours: "Lunes a viernes 09:00–19:00; sábado 09:00–14:00; domingo cerrado",','      ...statusRules(business,today()),');
    s=s.replace('services: (\n        await db.prepare("SELECT * FROM services WHERE enabled=1").all()','currency:business.currency,\n      services: (\n        await db.prepare("SELECT * FROM services WHERE enabled=1").all()');
    s=s.replace('c.req.query("service_id") ?? "valoracion"','c.req.query("service_id") ?? business.services[0].id');
    return s;
  });
  patch(out,'migrations/0001_initial.sql',s=>s.replace('CHECK(chair IN (1,2))',`CHECK(chair BETWEEN 1 AND ${c.resources.length})`));
  patch(out,'src/lib.ts',s=>{
    s='import business from "../business.config.json";\nimport {fromZonedTime} from "date-fns-tz";\n'+s;
    s=s.replace('currency: "MXN"','currency: business.currency');
    s=s.replace('new Date(value.length === 10 ? value + "T12:00:00-06:00" : value)','value.length===10?fromZonedTime(value+"T12:00:00",business.timezone):new Date(value)');
    return s;
  });
  patch(out,'src/main.tsx',s=>'import business from "../business.config.json";\n'+s.replaceAll('Monterrey',c.city).replace('Sillón {a.chair}','{business.resources.find(r=>r.id===a.chair)?.name ?? a.chair}'));
  patch(out,'src/VoiceDialog.tsx',s=>s.replace('Quiero agendar una valoración para mañana.',`{${JSON.stringify('Quiero agendar '+c.services[0].name+' para mañana.')}}`));
  patch(out,'README.md',s=>{
    s=s.replace('Dos puestos compartidos. Domingo cerrado, días laborales 09–19 y sábado 09–14, además del horario de cada profesional.','Recursos, horarios por día (incluidos domingos), turnos partidos, cierres, zona IANA, moneda, horizonte y plazo de cambios configurables en business.config.json.');
    return s.replace('## Tu despliegue','## Despliegue asistido de una instalación nueva\n\nCon Wrangler autenticado (`npx wrangler login`), ejecuta `npm run deploy:guided`. El asistente comprueba nombres libres, crea una D1 propia, aplica migraciones, compila, despliega y sube secretos. Guarda el avance en `.secrets/deployment.json`; repetir el comando conserva los recursos de esta instalación. Si una publicación de ElevenLabs tiene resultado incierto, exige revisar el job antes de volver a escribir.\n\nSin credenciales de ElevenLabs publica el dashboard y puedes conectar la cuenta desde **Agente de voz → Conexiones**. Para publicar también el agente configura ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID en tu entorno privado. `npm run setup` sincroniza secretos privados sin cambiar la contraseña ni firmantes existentes. No pegues claves en un chat ni uses VITE_ para secretos.\n\nEl modo production despliega un candidato bloqueado y requiere completar PRODUCCION.md; no publica ni activa el agente automáticamente.\n\n## Despliegue manual alternativo');
  });
  patch(out,'tests/integration.test.ts',s=>{
    const service=c.services[0],provider=c.providers.find(p=>p.specialty===service.specialty);
    s='import business from "../business.config.json";\nimport {candidateStarts} from "../worker/rules";\nimport {formatInTimeZone} from "date-fns-tz";\n'+s;
    const start=s.indexOf('function futureDay() {'),end=s.indexOf('beforeAll(',start);
    s=s.slice(0,start)+`const service=business.services[0],provider=business.providers.find(p=>p.specialty===service.specialty)!;
function futureDay(){
  const today=formatInTimeZone(new Date(),business.timezone,'yyyy-MM-dd');
  for(let offset=Math.min(25,Math.max(1,Math.floor(business.booking.maxAdvanceDays/2)));offset<business.booking.maxAdvanceDays;offset++){
    const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);const date=d.toISOString().slice(0,10);
    if(candidateStarts(business,date,provider.id,service.duration+service.buffer).some(d=>d.getTime()>Date.now()+(business.booking.cancellationHours+1)*3600000))return date;
  }
  throw new Error('No hay ventana futura para la prueba de cambio/cancelación dentro de la política configurada. Usa una instalación de QA con anticipación suficiente.');
}
const firstTime=()=>formatInTimeZone(candidateStarts(business,futureDay(),provider.id,service.duration+service.buffer)[0],business.timezone,'HH:mm');
`+s.slice(end);
    s=s.replaceAll('provider_id: '+JSON.stringify(c.providers[0].id),'provider_id: provider.id');
    s=s.replace('service_id: '+JSON.stringify(c.services[2]?.id??service.id),'service_id: '+JSON.stringify(c.services.find(x=>x.specialty!==provider.specialty)?.id??'unknown-service'));
    s=s.replace('from_time: "09:00"','from_time: firstTime()').replace('.toBe("09:00")','.toBe(firstTime())');
    const a=s.indexOf('  it("does not offer appointments on Sunday"'),b=s.indexOf('  it("prepares and commits',a);
    if(a<0||b<0)throw new Error('Base incompatible: prueba de horarios');
    s=s.slice(0,a)+`  it("rejects dates outside the configured grid and resource rules",async()=>{
      const r=await request('/appointments/prepare',{action:'create',patient_id:'patient-1',service_id:service.id,provider_id:provider.id,chair:service.resource_ids[0],starts_at:futureDay()+'T12:00:01.000Z'});expect(r.status).toBe(400);
    });
`+s.slice(b);
    return s;
  });
}

import {VERTICAL_IDS} from './verticals.mjs';
import {validateProfile} from './profiles.mjs';
const fail = message => { throw new Error('Configuración inválida: ' + message); };
export function validateConfig(c) {
  if (!c || c.schemaVersion !== 1) fail('schemaVersion debe ser 1');
  if(c.mode!==undefined&&!['demo','production'].includes(c.mode))fail('mode: demo o production');
  if (!VERTICAL_IDS.includes(c.kind)) fail('kind: '+VERTICAL_IDS.join(', '));
  if (typeof c.slug !== 'string' || !/^[a-z][a-z0-9-]{2,45}$/.test(c.slug)) fail('slug debe tener 3–46 caracteres a-z, 0-9 y guion');
  for (const k of ['name','city']) if (typeof c[k] !== 'string' || c[k].length < 2 || c[k].length > 100 || /[\\"'`<>${}\r\n]/.test(c[k])) fail(k + ': usa texto simple sin comillas ni caracteres de código');
  if(typeof c.timezone!=='string'||!c.timezone.trim())fail('timezone es obligatorio');
  try { new Intl.DateTimeFormat('es-MX',{timeZone:c.timezone}).format(); } catch { fail('timezone debe ser una zona IANA válida'); }
  c.currency??='MXN';
  if(!/^[A-Z]{3}$/.test(c.currency)||!Intl.supportedValuesOf('currency').includes(c.currency))fail('currency debe ser una moneda ISO admitida');
  c.resources??=[{id:1,name:'Puesto 1'},{id:2,name:'Puesto 2'}];
  if(!Array.isArray(c.resources)||!c.resources.length||c.resources.length>20||c.resources.some((r,i)=>r.id!==i+1||typeof r.name!=='string'||!r.name.trim()))fail('resources: 1–20 puestos con IDs consecutivos desde 1 y nombre');
  c.openingHours??={'0':[],'1':[['09:00','19:00']],'2':[['09:00','19:00']],'3':[['09:00','19:00']],'4':[['09:00','19:00']],'5':[['09:00','19:00']],'6':[['09:00','14:00']]};
  c.closures??=[];
  c.booking={slotMinutes:15,maxAdvanceDays:90,cancellationHours:24,...c.booking};
  if(![5,10,15,20,30,60].includes(c.booking.slotMinutes)||!Number.isInteger(c.booking.maxAdvanceDays)||c.booking.maxAdvanceDays<1||c.booking.maxAdvanceDays>365||!Number.isFinite(c.booking.cancellationHours)||c.booking.cancellationHours<0||c.booking.cancellationHours>720)fail('booking: intervalo, horizonte o plazo de cambios inválido');
  const minutes=t=>{if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(t))fail('hora HH:mm inválida');return Number(t.slice(0,2))*60+Number(t.slice(3));};
  const schedule=(value,label)=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!/^\d$/.test(k)||Number(k)>6))fail(label+': usa días 0–6');
    for(const ranges of Object.values(value)){
      if(!Array.isArray(ranges))fail(label+': intervalos inválidos');let last=-1;
      for(const range of ranges){if(!Array.isArray(range)||range.length!==2)fail(label+': cada intervalo tiene inicio y fin');const a=minutes(range[0]),b=minutes(range[1]);if(a>=b||a<last||a%c.booking.slotMinutes||b%c.booking.slotMinutes)fail(label+': intervalos superpuestos o fuera de la cuadrícula');last=b;}
    }
  };
  schedule(c.openingHours,'openingHours');
  if(!Array.isArray(c.closures)||c.closures.some(d=>typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))fail('closures: fechas YYYY-MM-DD válidas');
  if (!c.agent || typeof c.agent.name !== 'string' || !c.agent.name.trim() || typeof c.agent.instructions !== 'string'||c.agent.instructions.length<20||c.agent.instructions.length>6000) fail('agent.name e instructions (20–6000 caracteres) son necesarios');
  if(c.agent.name.length>60||/[\\"'`<>${}\r\n]/.test(c.agent.name))fail('agent.name debe ser texto simple');
  validateProfile(c,fail);
  if (!Array.isArray(c.providers) || !c.providers.length || !Array.isArray(c.services) || !c.services.length) fail('faltan profesionales o servicios');
  for (const [key, rows] of [['providers',c.providers],['services',c.services],['knowledge',c.knowledge]]) {
    if (!Array.isArray(rows) || !rows.length) fail(key);
    const ids = new Set();
    for (const row of rows) {
      if (typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,49}$/.test(row.id) || ids.has(row.id)) fail('ID duplicado o inválido en ' + key);
      ids.add(row.id);
    }
  }
  for (const p of c.providers) {
    if (typeof p.name !== 'string' || typeof p.specialty !== 'string' || !p.name || !p.specialty || typeof p.initials !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.color)) fail('profesional incompleto');
    if (!/^[0-6](,[0-6])*$/.test(p.weekdays) || new Set(p.weekdays.split(',')).size !== p.weekdays.split(',').length) fail('días del profesional: 0–6, sin duplicados');
    if (!Number.isInteger(p.start_hour) || !Number.isInteger(p.end_hour) || p.start_hour < 0 || p.end_hour > 24 || p.start_hour >= p.end_hour) fail('horario del profesional inválido');
    p.schedule??=Object.fromEntries(p.weekdays.split(',').map(d=>[d,[[String(p.start_hour).padStart(2,'0')+':00',String(p.end_hour).padStart(2,'0')+':00']]]));
    schedule(p.schedule,'schedule de '+p.id);
  }
  for (const s of c.services) {
    if (typeof s.name!=='string'||!s.name.trim()||s.name.length>150 || typeof s.description !== 'string' || !Number.isInteger(s.duration) || s.duration < 5 || s.duration > 480 || s.duration % 5 || !Number.isInteger(s.buffer) || s.buffer < 0 || s.buffer > 120) fail('nombre, duración, buffer o descripción de servicio');
    if (s.price !== null && (!Number.isFinite(s.price) || s.price < 0)) fail('price debe ser un importe no negativo o null');
    s.resource_ids??=c.resources.map(r=>r.id);
    if(!Array.isArray(s.resource_ids)||!s.resource_ids.length||s.resource_ids.some(id=>!c.resources.some(r=>r.id===id)))fail('servicio sin recurso válido: '+s.id);
    const fits=c.providers.some(p=>p.specialty===s.specialty&&Object.entries(c.openingHours).some(([day,ranges])=>ranges.some(([a,b])=>(p.schedule[day]??[]).some(([x,y])=>Math.min(minutes(b),minutes(y))-Math.max(minutes(a),minutes(x))>=s.duration+s.buffer))));
    if (!fits) fail('servicio sin profesional compatible o sin un intervalo suficiente: ' + s.id);
  }
  for (const d of c.knowledge) if (typeof d.title!=='string'||!d.title||typeof d.category!=='string'||!d.category || typeof d.content !== 'string' || d.content.length < 20) fail('documento de conocimiento incompleto');
  // A business config is shareable data, never a credential container.
  if (/(?:sk_[a-z0-9]{20,}|ELEVENLABS_API_KEY|ADMIN_PASSWORD|TOOLS_SECRET)/i.test(JSON.stringify(c))) fail('retira las credenciales del archivo compartible');
  return c;
}

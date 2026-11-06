import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { args } from './shared.mjs';

// Reporte mensual con conteos. Nunca consulta nombres, teléfonos, resúmenes ni transcripciones.
function utcStart(year,month,timeZone){
  const guess=Date.UTC(year,month-1,1);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'}).formatToParts(guess).map(p=>[p.type,p.value]));
  const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
  return new Date(guess-(local-guess));
}
const sqlDate=d=>d.toISOString().slice(0,19).replace('T',' ');
export function monthBounds(month,timeZone){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month??''))throw new Error('--month debe tener el formato YYYY-MM.');
  const [y,m]=month.split('-').map(Number);
  return [sqlDate(utcStart(y,m,timeZone)),sqlDate(utcStart(m===12?y+1:y,m===12?1:m+1,timeZone))];
}
export function queries(from,to,hasCaptures){
  const range=(column)=>`${column}>='${from}' AND ${column}<'${to}'`;
  return {
    calls:`SELECT started_at,duration,status FROM conversations WHERE is_demo=0 AND ${range('started_at')}`,
    appointments:`SELECT source,status,COUNT(*) n FROM appointments WHERE ${range('created_at')} GROUP BY source,status`,
    requests:`SELECT category,priority,status,COUNT(*) n FROM staff_requests WHERE ${range('created_at')} GROUP BY category,priority,status`,
    waitlist:`SELECT COUNT(*) n FROM waitlist WHERE ${range('created_at')}`,
    ...(hasCaptures?{captures:`SELECT kind,status,COUNT(*) n,AVG(score) score FROM captures WHERE ${range('updated_at')} GROUP BY kind,status`}:{}),
  };
}
function outsideHours(config,row){
  const when=new Date(row.started_at.replace(' ','T')+'Z');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,hourCycle:'h23',weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(when).map(p=>[p.type,p.value]));
  const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),time=parts.hour+':'+parts.minute;
  return !(config.openingHours?.[day]??[]).some(([a,b])=>time>=a&&time<b);
}
export function buildReport({config,month,data,costPerMinute,costCurrency,now=Date.now()}){
  const {calls,appointments,requests,waitlist,captures=[]}=data;
  const seconds=calls.reduce((a,c)=>a+Number(c.duration||0),0),minutes=seconds/60;
  const unsynced=calls.filter(c=>!Number(c.duration)).length,outside=calls.filter(c=>outsideHours(config,c)).length;
  const sum=(rows,test)=>rows.filter(test).reduce((a,r)=>a+Number(r.n),0);
  const n=v=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(v);
  const agent=sum(appointments,a=>a.source==='agent'),agentCancelled=sum(appointments,a=>a.source==='agent'&&a.status==='cancelled');
  const open=sum(requests,r=>r.status!=='resolved'),high=sum(requests,r=>r.priority==='high');
  const categories=Object.entries(requests.reduce((acc,r)=>({...acc,[r.category]:(acc[r.category]??0)+Number(r.n)}),{})).sort((a,b)=>b[1]-a[1]);
  const money=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:costCurrency??config.currency??'USD',currencyDisplay:'code'}).format(v);
  const synced=calls.length-unsynced,partial=Date.parse(monthBounds(month,config.timezone)[1].replace(' ','T')+'Z')>now;
  const notes=[
    ...(config.mode==='production'?[]:['**Instalación en modo demo:** las cifras vienen de pruebas, no son resultados del negocio. No las entregues como tales.']),
    ...(partial?['**Mes en curso:** los datos todavía son parciales.']:[]),
    ...(agent&&!calls.length?['**Revisar:** hay citas del agente sin ninguna conversación en el periodo. Suelen venir de pruebas automáticas.']:[]),
  ];
  return `# Reporte de llamadas · ${config.name} · ${month}

Datos de la base del agente en la zona ${config.timezone}. Solo conteos: sin nombres, teléfonos ni transcripciones.
${notes.length?'\n'+notes.join('\n\n')+'\n':''}
## Uso

| Indicador | Valor |
|---|---|
| Conversaciones | ${n(calls.length)} |
| Minutos | ${n(minutes)} |
| Duración promedio de las sincronizadas | ${synced?n(minutes/synced)+' min':'—'} |
| Fuera del horario del negocio | ${n(outside)} |
| Sin datos sincronizados de ElevenLabs | ${n(unsynced)} |
${unsynced?'\nLas conversaciones sin sincronizar cuentan como cero minutos. Configura el webhook o sincronízalas antes de usar los minutos para facturar.\n':''}
## Acciones guardadas

| Indicador | Valor |
|---|---|
| Citas creadas por el agente | ${n(agent)} |
| De esas, canceladas después | ${n(agentCancelled)} |
| Lista de espera | ${n(waitlist[0]?.n??0)} |
${captures.length?captures.map(c=>`| ${c.kind==='lead'?'Prospectos':'Encuestas'} (${c.status==='new'?'sin revisar':'revisados'}) | ${n(c.n)}${c.score===null||c.score===undefined?'':' · promedio '+n(c.score)+'/10'} |`).join('\n')+'\n':''}
## Solicitudes al equipo

| Indicador | Valor |
|---|---|
| Solicitudes | ${n(sum(requests,()=>true))} |
| Prioridad alta | ${n(high)} |
| Sin resolver | ${n(open)} |
${categories.length?'\nPor motivo: '+categories.map(([k,v])=>k+' ('+n(v)+')').join(', ')+'.\n':''}
## Costo de proveedores

${costPerMinute===undefined?'Sin dato: no se indicó --costo-minuto. Usa la factura de tus proveedores.':`Estimado: ${n(minutes)} min × ${money(costPerMinute)} = ${money(minutes*costPerMinute)}. Compáralo con la factura real.`}

## Lo que este reporte no mide

Ahorro, satisfacción ni calidad de cada respuesta. Para afirmar un ahorro compara contra un periodo equivalente previo. Revisa una muestra autorizada de conversaciones antes de sacar conclusiones.
`;
}
function wrangler(project,slug,remote,command){
  const bin=path.join(project,'node_modules/wrangler/bin/wrangler.js');
  if(!fs.existsSync(bin))throw new Error('Falta node_modules en el proyecto: ejecuta npm ci allí.');
  const output=execFileSync(process.execPath,[bin,'d1','execute',slug,remote?'--remote':'--local','--json','--command',command],{cwd:project,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  return JSON.parse(output)[0].results;
}
export function report({project,month,remote=false,costPerMinute,costCurrency}){
  const config=JSON.parse(fs.readFileSync(path.join(project,'business.config.json'),'utf8'));
  const run=sql=>wrangler(project,config.slug,remote,sql);
  const hasCaptures=run("SELECT name FROM sqlite_master WHERE type='table' AND name='captures'").length>0;
  const [from,to]=monthBounds(month,config.timezone);
  const data=Object.fromEntries(Object.entries(queries(from,to,hasCaptures)).map(([k,sql])=>[k,run(sql)]));
  return buildReport({config,month,data,costPerMinute,costCurrency});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=args(process.argv.slice(2));
    if(!opts.project||!opts.month||opts.help)throw new Error('Usa: node tools/reporte-llamadas.mjs --project /ruta/generada --month 2026-10 [--remote] [--costo-minuto 0.12 --moneda USD] [--out reporte.md]\nSolo hace consultas SELECT. --remote lee la D1 desplegada con tu sesión de Wrangler.');
    let costPerMinute;
    if(opts['costo-minuto']!==undefined){costPerMinute=Number(opts['costo-minuto']);if(!Number.isFinite(costPerMinute)||costPerMinute<0)throw new Error('--costo-minuto debe ser un número no negativo.');}
    const text=report({project:path.resolve(opts.project),month:opts.month,remote:opts.remote===true,costPerMinute,costCurrency:typeof opts.moneda==='string'?opts.moneda:undefined});
    if(opts.out){fs.writeFileSync(path.resolve(opts.out),text);console.log('Reporte: '+path.resolve(opts.out));}else console.log(text);
  }catch(e){console.error(e.message);process.exitCode=1;}
}

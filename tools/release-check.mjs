import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]??process.cwd()),file=path.join(root,'production-acceptance.json');
const required=['staff_identity','customer_verification','booking_concurrency','voice_booking','crm_contact_and_followup','retention_approved','business_protocol','handoff_owner'];
const report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
const missing=required.filter(id=>report.checks?.[id]?.status!=='PASS'||typeof report.checks?.[id]?.evidence!=='string'||report.checks[id].evidence.trim().length<10);
if(!report.approvedBy||!report.approvedAt||!Number.isFinite(Date.parse(report.approvedAt)))missing.push('responsible_approval');
console.log(JSON.stringify({project:root,readyForBusinessAcceptance:missing.length===0,missing,note:'Comprueba la evidencia y configuración de esta instalación. Este control no certifica otros clientes ni activa servicios.'},null,2));
if(missing.length)process.exitCode=1;

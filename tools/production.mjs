import fs from 'node:fs';
import path from 'node:path';
import { studioRoot, patch, write, json, replaceOnce } from './shared.mjs';
export function installProduction(out,c){
  const read=name=>fs.readFileSync(path.join(studioRoot,'production',name),'utf8');
  for(const name of ['access.ts','verify.ts','crm.ts','outbox.ts'])write(out,'worker/production/'+name,read(name));
  write(out,'migrations/0007_production.sql',read('0007_production.sql'));
  write(out,'src/CustomerPortal.tsx',read('CustomerPortal.tsx'));
  write(out,'src/OperationsPanel.tsx',read('OperationsPanel.tsx'));
  write(out,'src/VoiceDialog.tsx',read('StaffVoiceGuide.tsx'));
  patch(out,'worker-configuration.d.ts',s=>s.replace('APP_ENV: "demo";','APP_ENV: string;').replace('CLINIC_TIMEZONE: "America/Monterrey";','CLINIC_TIMEZONE: string;')+`\ninterface Env {ACCESS_TEAM_DOMAIN?:string;ACCESS_AUD?:string;STAFF_ROLES_JSON?:string;BUSINESS_APPROVED?:string;TWILIO_ACCOUNT_SID?:string;TWILIO_AUTH_TOKEN?:string;TWILIO_VERIFY_SERVICE_SID?:string;HUBSPOT_PRIVATE_APP_TOKEN?:string;CRM_SYNC_ENABLED?:string;RETENTION_DAYS?:string;}\n`);
  patch(out,'worker/index.ts',s=>{
    s='import { verifyStaff, permitted } from "./production/access";\nimport { verifyPhone } from "./production/verify";\nimport { enqueueCRM, drainCRM } from "./production/outbox";\n'+s;
    // Keep origin validation in front of all customer and staff writes.
    s=replaceOnce(s,'  const publicRoutes =',`  if(c.env.APP_ENV==='production'){
      if(c.req.path.startsWith('/api/tools/')&&c.env.BUSINESS_APPROVED!=='true')return c.json({error:'BUSINESS_NOT_APPROVED'},503);
      if(c.req.path.startsWith('/api/tools/')||c.req.path.startsWith('/api/webhooks/')||c.req.path.startsWith('/api/portal/')||c.req.path==='/api/health'){await next();return;}
      const staff=await verifyStaff(c.req.header('Cf-Access-Jwt-Assertion'),c.env);
      if(c.req.path==='/api/auth/me'){return c.json({authenticated:!!staff,mode:'production'});}
      if(!staff)return c.json({error:'STAFF_IDENTITY_REQUIRED'},401);
      if(!permitted(staff.role,c.req.method,c.req.path))return c.json({error:'ROLE_NOT_ALLOWED'},403);
      if(c.req.path==='/api/auth/login')return c.json({error:'USE_STAFF_SSO'},403);
      c.set('actor',staff.email);
      await seed(c.env.DB);
      await next();
      if(c.req.method!=='GET')await c.env.DB.prepare('INSERT INTO staff_audit(id,actor,method,path,status) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),staff.email,c.req.method,c.req.path,c.res.status).run();
      return;
    }
    const publicRoutes =`);
    s=replaceOnce(s,'app.post("/api/tools/:name",',read('portal-routes.ts.txt')+'\napp.post("/api/tools/:name",');
    s=s.replaceAll('"staff-admin"','"staff:" + c.get("actor")');
    s=s.replace('environment: "demo",','environment: c.env.APP_ENV,');
    s=s.replace('demo: true,','demo: c.env.APP_ENV !== "production",');
    s=s.replace('method: "admin_selected_synthetic_patient",','method: c.env.APP_ENV === "production" ? "verified_phone" : "admin_selected_synthetic_patient",');
    s=s.replace('mode: "demo",\n      message:','mode: c.env.APP_ENV,\n      message:');
    s=s.replace('"Identidad ficticia elegida por el administrador para esta prueba. No se realizó OTP."','c.env.APP_ENV === "production" ? "Teléfono verificado por el servidor para esta sesión." : "Identidad ficticia elegida por el administrador para esta prueba. No se realizó OTP."');
    // CRM synchronization runs from a durable outbox, independently of the voice tool's response.
    s=replaceOnce(s,'    result = {\n      request_id: id,',`    if(c.env.APP_ENV==='production'&&session.verified&&c.env.CRM_SYNC_ENABLED==='true')await enqueueCRM(db,'followup',id);
    result = {\n      request_id: id,`);
    s=replaceOnce(s,'  const toolTitles:',`  if(c.env.APP_ENV==='production'&&name==='commit_appointment_change'&&c.env.CRM_SYNC_ENABLED==='true')await enqueueCRM(db,'contact',session.patient_id);
  const toolTitles:`);
    s=replaceOnce(s,'    await env.DB.batch([',`    await drainCRM(env);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM customer_sessions WHERE expires_at<?').bind(now()),
      env.DB.prepare('DELETE FROM otp_challenges WHERE expires_at<?').bind(now()),`);
    // Admin-created customers are never silently marked as synthetic in a production installation.
    s=s.replace('"INSERT INTO patients(id,name,phone,email,initials) VALUES(?,?,?,?,?)"','"INSERT INTO patients(id,name,phone,email,initials,is_demo) VALUES(?,?,?,?,?,0)"');
    s=s.replace('      p.phone,','      p.phone.replace(/[ ()-]/g, ""),');
    s=s.replace('.regex(/^\\+?[0-9 ()-]{8,22}$/)','.regex(/^\\+[1-9][0-9]{7,14}$/)');
    s=replaceOnce(s,'    await drainCRM(env);',`    const retention=Number(env.RETENTION_DAYS??30);
    if(Number.isInteger(retention)&&retention>=1&&retention<=365){
      const cutoff=new Date(Date.now()-retention*86400000).toISOString();
      await env.DB.batch([env.DB.prepare("UPDATE conversations SET transcript='[]',summary='' WHERE started_at<?").bind(cutoff),env.DB.prepare('DELETE FROM staff_audit WHERE created_at<?').bind(cutoff.replace('T',' ').slice(0,19))]);
    }
    await drainCRM(env);`);
    s=replaceOnce(s,'app.get("/api/availability",',`app.get('/api/production/status',async c=>c.json({mode:c.env.APP_ENV,identity_configured:!!(c.env.TWILIO_ACCOUNT_SID&&c.env.TWILIO_AUTH_TOKEN&&c.env.TWILIO_VERIFY_SERVICE_SID),staff_configured:!!(c.env.ACCESS_TEAM_DOMAIN&&c.env.ACCESS_AUD&&c.env.STAFF_ROLES_JSON),approved:c.env.BUSINESS_APPROVED==='true',crm_enabled:c.env.CRM_SYNC_ENABLED==='true',crm_configured:!!c.env.HUBSPOT_PRIVATE_APP_TOKEN,outbox:(await c.env.DB.prepare('SELECT id,kind,entity_id,state,attempts,last_error,updated_at FROM integration_outbox ORDER BY rowid DESC LIMIT 50').all()).results}));
app.post('/api/production/crm/run',async c=>{await drainCRM(c.env);return c.json({ok:true});});
app.get("/api/availability",`);
    return s;
  });
  patch(out,'worker/data.ts',s=>{
    const start=s.indexOf('  const names =');const end=s.indexOf('  for (const d of kbSeeds)',start);
    s=s.slice(0,start)+s.slice(end);
    const begin=s.indexOf('  let n=0;'); const finish=s.indexOf('  await db.batch(statements);',begin);
    s=s.slice(0,begin)+s.slice(finish);
    if(c.kind==='garage')s=s.slice(0,s.indexOf('  await db.batch([',s.indexOf('  await db.batch(statements);')))+'}\n';
    return s;
  });
  patch(out,'worker/policy.ts',s=>s
    .replace('Este proyecto está en modo demo: administración eligió una identidad ficticia. No se realizó OTP. No presentes este mecanismo como verificación real. Nunca atiendas personas reales con este modo.','Este proyecto usa verificación de teléfono en el portal. El servidor entrega una sesión después del código aprobado; el modelo no valida códigos ni elige la identidad. Si la verificación no está vigente, no accedas a datos privados.')
    .replace('No hay SMS, email, WhatsApp, telefonía ni transferencia conectados por defecto.','El portal puede solicitar un SMS de verificación si está configurado. La conversación no envía recordatorios ni confirmaciones por SMS. HubSpot sincroniza contactos y solicitudes solo si está habilitado y su resultado se revisa en el panel. No prometas una sincronización terminada sin comprobarla. No hay email, WhatsApp, telefonía ni transferencia conectados.'));
  patch(out,'worker/eleven.ts',s=>{
    s=replaceOnce(s,'  const key = await apiKey(env);',`  if(env.APP_ENV==='production'&&env.BUSINESS_APPROVED!=='true')throw new BusinessError('Aprueba los procesos del negocio antes de publicar.',409);
  const key = await apiKey(env);`);
    return s;
  });
  patch(out,'worker/index.ts',s=>{
    const marker='app.post("/api/agent/publish", async (c) =>\n  c.json(await publish(c.env, new URL(c.req.url).origin)),\n);';
    return replaceOnce(s,marker,`app.post("/api/agent/publish",async c=>{
      const result=await publish(c.env,new URL(c.req.url).origin),settings=await getSettings(c.env.DB);
      await c.env.DB.prepare('INSERT INTO prompt_releases(id,prompt_version,prompt_hash,agent_id) VALUES(?,?,?,?)').bind(crypto.randomUUID(),'1.1.0',await digest(systemPrompt(settings)),settings.remote_agent_id).run();
      return c.json(result);
    });`).replace('import { apiKey, eleven, publish }','import { apiKey, eleven, publish, systemPrompt }');
  });
  patch(out,'src/main.tsx',s=>{
    s='import OperationsPanel from "./OperationsPanel";\nconst CustomerPortal = React.lazy(()=>import("./CustomerPortal"));\n'+s.replace('<App />','{location.pathname === "/patient" ? <React.Suspense fallback={<p>Cargando…</p>}><CustomerPortal /></React.Suspense> : <App />}');
    s=s.replace('"overview" | "agenda"','"operations" | "overview" | "agenda"');
    s=s.replace('const nav: { id: Page; label: string; icon: LucideIcon }[] = [','const nav: { id: Page; label: string; icon: LucideIcon }[] = [\n  { id: "operations", label: "Operación", icon: ShieldCheck },');
    s=s.replace('{page === "overview" && (','{page === "operations" && <OperationsPanel />}\n          {page === "overview" && (');
    s=s.replace(/<div className="demo-note">[\s\S]*?<div className="metrics">/,'<div className="metrics">');
    s=s.replaceAll('Entorno de prueba','Entorno protegido').replaceAll('ficticios','registrados').replaceAll('ficticio','registrado').replaceAll('de demostración','del negocio').replaceAll('de prueba','del negocio');
    s=s.replace(/Esta versión usa pacientes registrados elegidos por\s+administración\. La verificación OTP con pacientes reales\s+requiere conectar SMS y aprobar el flujo\./,'El personal accede con su identidad de Access. Cada cliente verifica su teléfono en el portal antes de consultar sus datos. Revisa el estado de los proveedores en Operación.');
    s=s.replace(/Esta versión usa clientes registrados elegidos por\s+administración\. La verificación OTP con clientes reales\s+requiere conectar SMS y aprobar el flujo\./,'El personal accede con su identidad de Access. Cada cliente verifica su teléfono en el portal antes de consultar sus datos. Revisa el estado de los proveedores en Operación.');
    s=s.replace('"Este entorno usa pacientes registrados. La voz se conecta a ElevenLabs; las acciones se guardan en Cloudflare."','"El portal verifica a cada cliente. El personal accede por Access. Revisa las pruebas y proveedores en Operación."');
    s=s.replace('"Este entorno usa clientes registrados. La voz se conecta a ElevenLabs; las acciones se guardan en Cloudflare."','"El portal verifica a cada cliente. El personal accede por Access. Revisa las pruebas y proveedores en Operación."');
    return s;
  });
  const cfg=JSON.parse(fs.readFileSync(path.join(out,'wrangler.jsonc'),'utf8'));
  cfg.vars={...cfg.vars,APP_ENV:'production',BUSINESS_APPROVED:'false',CRM_SYNC_ENABLED:'false',RETENTION_DAYS:'30'};
  json(out,'wrangler.jsonc',cfg);
  write(out,'PRODUCCION.md',read('README.md'));
  write(out,'README.md',read('PROJECT_README.md').replaceAll('{{BUSINESS_NAME}}',c.name));
  write(out,'scripts/release-check.mjs',fs.readFileSync(path.join(studioRoot,'tools/release-check.mjs'),'utf8'));
  json(out,'production-acceptance.json',{approvedBy:'',approvedAt:'',checks:Object.fromEntries(['staff_identity','customer_verification','booking_concurrency','voice_booking','crm_contact_and_followup','retention_approved','business_protocol','handoff_owner'].map(id=>[id,{status:'NOT_RUN',evidence:''}]))});
  const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));pkg.scripts['production:check']='node scripts/release-check.mjs';json(out,'package.json',pkg);
  json(out,'implementation-report.json',{version:1,business:c.name,stage:'production-candidate-not-validated',mode:'production',implemented:['versioned-policy','cf-access-signed-staff-identity','staff-roles','twilio-phone-verification','customer-scoped-sessions','hubspot-contacts-and-followups','durable-crm-outbox','atomic-d1-booking'],pending:['own-provider-credentials','cf-access-application-and-policy','retention-approval','crm-live-test','otp-live-test','voice-live-test','business-acceptance'],testsExecuted:[],productionApproved:false});
}

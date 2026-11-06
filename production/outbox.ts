import { syncContact, createFollowup } from './crm';
export async function drainCRM(env:Env){
  if(env.CRM_SYNC_ENABLED!=='true'||!env.HUBSPOT_PRIVATE_APP_TOKEN)return;
  const owner=crypto.randomUUID();
  const lock=await env.DB.prepare("INSERT INTO integration_locks(name,owner,expires_at) VALUES('crm',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE expires_at<? RETURNING owner").bind(owner,new Date(Date.now()+600000).toISOString(),new Date().toISOString()).first<{owner:string}>();
  if(lock?.owner!==owner)return;
  try{
  // Reconcile after a process interruption between a successful local commit and enqueue.
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO integration_outbox(id,kind,entity_id,entity_version) SELECT 'contact-'||p.id,'contact',p.id,1 FROM patients p WHERE p.is_demo=0 AND EXISTS(SELECT 1 FROM appointments a WHERE a.patient_id=p.id)"),
    env.DB.prepare("INSERT OR IGNORE INTO integration_outbox(id,kind,entity_id,entity_version) SELECT 'followup-'||r.id,'followup',r.id,1 FROM staff_requests r JOIN patients p ON p.id=r.patient_id WHERE p.is_demo=0")
  ]);
  const rows=(await env.DB.prepare("SELECT * FROM integration_outbox WHERE state='pending' AND next_attempt_at<=datetime('now') ORDER BY rowid LIMIT 10").all<{id:string;kind:string;entity_id:string;entity_version:number;attempts:number}>()).results;
  for(const job of rows){
    const claim=await env.DB.prepare("UPDATE integration_outbox SET state='processing',attempts=attempts+1,updated_at=datetime('now') WHERE id=? AND state='pending'").bind(job.id).run();
    if(!claim.meta.changes)continue;
    try{
      let owner=job.entity_id,reason='';
      if(job.kind==='followup'){
        const r=await env.DB.prepare('SELECT patient_id,reason FROM staff_requests WHERE id=?').bind(job.entity_id).first<{patient_id:string;reason:string}>();
        if(!r)throw new Error('REQUEST_NOT_FOUND');owner=r.patient_id;reason=r.reason;
      }
      const person=await env.DB.prepare('SELECT id,name,phone,email FROM patients WHERE id=? AND is_demo=0').bind(owner).first<{id:string;name:string;phone:string;email:string|null}>();
      if(!person)throw new Error('REAL_CONTACT_REQUIRED');
      const link=await env.DB.prepare("SELECT external_id FROM external_links WHERE kind='contact' AND entity_id=?").bind(owner).first<{external_id:string}>();
      const contactId=await syncContact(env,person,link?.external_id);
      await env.DB.prepare("INSERT INTO external_links(kind,entity_id,external_id) VALUES('contact',?,?) ON CONFLICT(kind,entity_id) DO UPDATE SET external_id=excluded.external_id").bind(owner,contactId).run();
      let remoteId=contactId;
      if(job.kind==='followup')remoteId=await createFollowup(env,{contactId,requestId:job.entity_id,reason});
      await env.DB.batch([
        env.DB.prepare("UPDATE integration_outbox SET state='done',last_error='',updated_at=datetime('now') WHERE id=?").bind(job.id),
        env.DB.prepare('INSERT INTO external_links(kind,entity_id,external_id,version) VALUES(?,?,?,?) ON CONFLICT(kind,entity_id) DO UPDATE SET external_id=excluded.external_id,version=excluded.version').bind(job.kind,job.entity_id,remoteId,job.entity_version)
      ]);
    }catch(e){
      // Any failed write may have succeeded upstream. Preserve the job for operator reconciliation,
      // rather than blindly creating duplicate tasks or contacts after an ambiguous response.
      const code=e instanceof Error?e.message.slice(0,100):'CRM_ERROR';
      await env.DB.prepare("UPDATE integration_outbox SET state='needs_review',last_error=?,updated_at=datetime('now') WHERE id=?").bind(code,job.id).run();
    }
  }
  await env.DB.prepare("UPDATE integration_outbox SET state='needs_review',last_error='PROCESS_INTERRUPTED_RECONCILE_FIRST' WHERE state='processing' AND updated_at<datetime('now','-10 minutes')").run();
  }finally{await env.DB.prepare("DELETE FROM integration_locks WHERE name='crm' AND owner=?").bind(owner).run();}
}
export async function enqueueCRM(db:D1Database,kind:'contact'|'followup',id:string,version=1){
  await db.prepare('INSERT INTO integration_outbox(id,kind,entity_id,entity_version) VALUES(?,?,?,?) ON CONFLICT(kind,entity_id,entity_version) DO NOTHING').bind(crypto.randomUUID(),kind,id,version).run();
}

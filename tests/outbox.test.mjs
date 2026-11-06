import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { stripTypeScriptTypes } from 'node:module';
const url=code=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code)).toString('base64');
const crm=url(fs.readFileSync(new URL('../production/crm.ts',import.meta.url),'utf8'));
const outbox=url(fs.readFileSync(new URL('../production/outbox.ts',import.meta.url),'utf8').replace("from './crm'",'from '+JSON.stringify(crm)));
const {drainCRM}=await import(outbox);
function database(){
  const sql=new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE patients(id TEXT PRIMARY KEY,name TEXT,phone TEXT,email TEXT,is_demo INTEGER);CREATE TABLE appointments(patient_id TEXT);CREATE TABLE staff_requests(id TEXT,patient_id TEXT,reason TEXT);');
  const schema=fs.readFileSync(new URL('../production/0007_production.sql',import.meta.url),'utf8').split('\n').filter(line=>/^CREATE TABLE (integration_outbox|external_links|integration_locks)/.test(line)).join('\n');sql.exec(schema);
  sql.exec("INSERT INTO patients VALUES('p1','Mariana García','+528100000001',NULL,0);INSERT INTO appointments VALUES('p1');INSERT INTO staff_requests VALUES('r1','p1','Solicita revisión de agenda');");
  const db={prepare(query){const stmt=sql.prepare(query);let params=[];return {bind(...p){params=p;return this;},async first(){return stmt.get(...params)??null;},async all(){return {results:stmt.all(...params)};},async run(){return {meta:{changes:Number(stmt.run(...params).changes)}};}};},async batch(stmts){sql.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
  return {sql,env:{DB:db,CRM_SYNC_ENABLED:'true',HUBSPOT_PRIVATE_APP_TOKEN:'test-only'}};
}
test('concurrent CRM drains serialize and create a single contact and task',async()=>{
  const {sql,env}=database();let contacts=0,tasks=0;const original=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{
    await new Promise(r=>setTimeout(r,2));
    if(url.endsWith('/search'))return Response.json({total:0,results:[]});
    if(url.endsWith('/tasks')){tasks++;return Response.json({id:'t1'});}
    if(opts.method==='POST')contacts++;return Response.json({id:'c1'});
  };
  try{await Promise.all([drainCRM(env),drainCRM(env)]);assert.equal(contacts,1);assert.equal(tasks,1);assert.equal(sql.prepare("SELECT COUNT(*) n FROM integration_outbox WHERE state='done'").get().n,2);await drainCRM(env);assert.equal(tasks,1);}finally{globalThis.fetch=original;sql.close();}
});
test('an ambiguous task write enters review and is not resent',async()=>{
  const {sql,env}=database();let tasks=0;const original=globalThis.fetch;
  globalThis.fetch=async(url)=>{if(url.endsWith('/search'))return Response.json({total:1,results:[{id:'c1'}]});if(url.endsWith('/tasks')){tasks++;throw new Error('timeout after provider accepted');}return Response.json({id:'c1'});};
  try{await drainCRM(env);assert.equal(tasks,1);assert.equal(sql.prepare("SELECT state FROM integration_outbox WHERE kind='followup'").get().state,'needs_review');await drainCRM(env);assert.equal(tasks,1);}finally{globalThis.fetch=original;sql.close();}
});

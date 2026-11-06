import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
async function load(name){const code=stripTypeScriptTypes(fs.readFileSync(new URL('../production/'+name,import.meta.url),'utf8'));return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}
const {verifyStaff,permitted}=await load('access.ts'),{verifyPhone}=await load('verify.ts'),{syncContact,createFollowup}=await load('crm.ts');
test('roles limit writes independently of UI',()=>{
  assert.equal(permitted('viewer','POST','/api/appointments/commit'),false);
  assert.equal(permitted('reception','PUT','/api/agent'),false);
  assert.equal(permitted('reception','POST','/api/appointments/commit'),true);
  assert.equal(permitted('admin','POST','/api/agent/publish'),true);
});
test('Cloudflare Access verifies signature, audience, expiry and allowlisted identity',async()=>{
  const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';
  const env={ACCESS_TEAM_DOMAIN:'studio-test.cloudflareaccess.com',ACCESS_AUD:'app-aud',STAFF_ROLES_JSON:JSON.stringify({'admin@example.com':'admin'})};
  const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const token=async overrides=>{const body=enc({alg:'RS256',kid:'test-key'})+'.'+enc({iss:'https://studio-test.cloudflareaccess.com',aud:['app-aud'],exp:Math.floor(Date.now()/1000)+600,email:'admin@example.com',...overrides});return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(body))).toString('base64url');};
  const request=async()=>Response.json({keys:[jwk]});
  assert.deepEqual(await verifyStaff(await token({}),env,request),{email:'admin@example.com',role:'admin'});
  assert.equal(await verifyStaff(await token({aud:['wrong']}),env,request),null);
  assert.equal(await verifyStaff(await token({exp:1}),env,request),null);
  assert.equal(await verifyStaff(await token({email:'outsider@example.com'}),env,request),null);
  const good=await token({});assert.equal(await verifyStaff(good.slice(0,-8)+'AAAAAAAA',env,request),null);
  assert.equal(await verifyStaff(undefined,env,request),null);
});
test('phone verification trusts provider approved, not presence of a code',async()=>{
  const env={TWILIO_ACCOUNT_SID:'account',TWILIO_AUTH_TOKEN:'private-test',TWILIO_VERIFY_SERVICE_SID:'service'};
  assert.equal(await verifyPhone(env,'+528100000001','123456',async()=>Response.json({status:'pending'})),false);
  assert.equal(await verifyPhone(env,'+528100000001','123456',async(url,opts)=>{assert.ok(url.endsWith('/VerificationCheck'));assert.equal(new URLSearchParams(opts.body).get('Code'),'123456');return Response.json({status:'approved'});}),true);
  await assert.rejects(verifyPhone({},'+528100000001'),/NOT_CONFIGURED/);
  await assert.rejects(verifyPhone(env,'123'),/INVALID/);
});
test('CRM existing contact is updated, not duplicated, and multiple matches stop',async()=>{
  const person={name:'Mariana García',phone:'+528100000001',email:null},env={HUBSPOT_PRIVATE_APP_TOKEN:'test-only'};
  const methods=[];
  const id=await syncContact(env,person,undefined,async(url,opts)=>{methods.push(opts.method);return Response.json(url.endsWith('/search')?{total:1,results:[{id:'42'}]}:{id:'42'});});
  assert.equal(id,'42');assert.deepEqual(methods,['POST','PATCH']);
  await assert.rejects(syncContact(env,person,undefined,async()=>Response.json({total:2,results:[{id:'1'},{id:'2'}]})),/MULTIPLE_MATCHES/);
});
test('CRM followup links only the server-provided contact and marks timeout ambiguous',async()=>{
  const env={HUBSPOT_PRIVATE_APP_TOKEN:'test-only'};
  const id=await createFollowup(env,{contactId:'42',requestId:'r1',reason:'Solicita llamada'},async(url,opts)=>{const b=JSON.parse(opts.body);assert.equal(b.associations[0].to.id,'42');assert.equal(b.associations[0].types[0].associationTypeId,204);return Response.json({id:'task1'});});
  assert.equal(id,'task1');
  await assert.rejects(createFollowup(env,{contactId:'42',requestId:'r1',reason:'Solicita llamada'},async()=>{throw new Error('network');}),e=>e.ambiguous===true);
});

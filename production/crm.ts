export class CRMError extends Error { code:string;ambiguous:boolean;constructor(code:string,ambiguous=false){super(code);this.code=code;this.ambiguous=ambiguous;} }
export type CRMEnv={HUBSPOT_PRIVATE_APP_TOKEN?:string};
async function call(env:CRMEnv,route:string,method:string,body:unknown,request:typeof fetch){
  if(!env.HUBSPOT_PRIVATE_APP_TOKEN)throw new CRMError('CRM_NOT_CONFIGURED');
  let r:Response;
  try{r=await request('https://api.hubapi.com'+route,{method,headers:{Authorization:'Bearer '+env.HUBSPOT_PRIVATE_APP_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}
  catch{throw new CRMError('CRM_TRANSPORT_ERROR',method!=='GET'&&route.indexOf('/search')<0);}
  if(!r.ok)throw new CRMError('CRM_HTTP_'+r.status,method==='POST'&&!route.endsWith('/search')&&r.status>=500);
  return r.json() as Promise<any>;
}
export async function syncContact(env:CRMEnv,person:{name:string;phone:string;email:string|null},externalId?:string,request:typeof fetch=fetch){
  const parts=person.name.trim().split(/\s+/),properties={firstname:parts[0],lastname:parts.slice(1).join(' '),phone:person.phone,...(person.email?{email:person.email}:{})};
  let id=externalId;
  if(!id){
    const found=await call(env,'/crm/v3/objects/contacts/search','POST',{filterGroups:[{filters:[{propertyName:'phone',operator:'EQ',value:person.phone}]}],properties:['phone'],limit:2},request);
    if(found.total>1)throw new CRMError('CRM_MULTIPLE_MATCHES');
    id=found.results?.[0]?.id;
  }
  const result=await call(env,'/crm/v3/objects/contacts'+(id?'/'+encodeURIComponent(id):''),id?'PATCH':'POST',{properties},request);
  if(typeof result.id!=='string')throw new CRMError('CRM_INVALID_RESPONSE',!id);
  return result.id as string;
}
export async function createFollowup(env:CRMEnv,input:{contactId:string;requestId:string;reason:string},request:typeof fetch=fetch){
  const result=await call(env,'/crm/v3/objects/tasks','POST',{
    properties:{hs_timestamp:new Date().toISOString(),hs_task_subject:'Seguimiento de recepción · '+input.requestId,hs_task_body:input.reason,hs_task_status:'NOT_STARTED',hs_task_priority:'MEDIUM',hs_task_type:'TODO'},
    associations:[{to:{id:input.contactId},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:204}]}]
  },request);
  if(typeof result.id!=='string')throw new CRMError('CRM_INVALID_RESPONSE',true);
  return result.id as string;
}

type AccessEnv={ACCESS_TEAM_DOMAIN?:string;ACCESS_AUD?:string;STAFF_ROLES_JSON?:string};
const decode=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
let cache:{domain:string;expires:number;keys:(JsonWebKey&{kid:string})[]}|undefined;
export async function verifyStaff(token:string|undefined,env:AccessEnv,request:typeof fetch=fetch){
  if(!token||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))return null;
  try{
    const parts=token.split('.');if(parts.length!==3)return null;
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if(header.alg!=='RS256'||typeof header.kid!=='string')return null;
    const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
    const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    const now=Math.floor(Date.now()/1000);
    if(claims.iss!==issuer||!audiences.includes(env.ACCESS_AUD)||!Number.isFinite(claims.exp)||claims.exp<=now||claims.nbf>now+30||typeof claims.email!=='string')return null;
    if(!cache||cache.domain!==issuer||cache.expires<Date.now()){
      const r=await request(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000)});if(!r.ok)return null;
      cache={domain:issuer,expires:Date.now()+300000,keys:(await r.json() as {keys:(JsonWebKey&{kid:string})[]}).keys};
    }
    let jwk=cache.keys.find(k=>k.kid===header.kid);
    if(!jwk){cache=undefined;return null;}
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
    const roles=JSON.parse(env.STAFF_ROLES_JSON??'{}'),role=roles[claims.email.toLowerCase()];
    return ['admin','reception','viewer'].includes(role)?{email:claims.email.toLowerCase() as string,role:role as string}:null;
  }catch{return null;}
}
export function permitted(role:string,method:string,pathname:string){
  if(role==='admin')return true;
  if(method==='GET')return true;
  if(pathname==='/api/auth/logout')return true;
  if(role==='viewer')return false;
  return role==='reception' && (/^\/api\/appointments\//.test(pathname)||pathname==='/api/patients'||/^\/api\/requests\//.test(pathname)||/^\/api\/work-orders(?:\/|$)/.test(pathname));
}

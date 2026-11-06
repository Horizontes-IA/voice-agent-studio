import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function configureSecrets(root=process.cwd(),environment=process.env){
  const dir=path.join(root,'.secrets'),file=path.join(root,'.dev.vars');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const secrets=fs.existsSync(file)?Object.fromEntries(fs.readFileSync(file,'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');if(i<1)throw new Error('.dev.vars debe usar NOMBRE=valor, sin sintaxis de shell');return[l.slice(0,i),l.slice(i+1)];})):{};
  for(const [key,size,encoding] of [['ADMIN_PASSWORD',18,'base64url'],['SESSION_SECRET',48,'base64url'],['ENCRYPTION_KEY',32,'hex'],['TOOLS_SECRET',48,'base64url']])secrets[key]??=randomBytes(size).toString(encoding);
  for(const key of ['ELEVENLABS_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VERIFY_SERVICE_SID','HUBSPOT_PRIVATE_APP_TOKEN'])if(environment[key])secrets[key]=environment[key];
  for(const [key,value] of Object.entries(secrets))if(/[\r\n]/.test(value))throw new Error('Valor de secreto multilínea no admitido: '+key);
  fs.writeFileSync(file,Object.entries(secrets).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});fs.chmodSync(file,0o600);
  for(const [name,data] of [['worker-secrets.json',JSON.stringify(secrets)],['admin-password.txt',secrets.ADMIN_PASSWORD+'\n']]){fs.writeFileSync(path.join(dir,name),data,{mode:0o600});fs.chmodSync(path.join(dir,name),0o600);}
  return secrets;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){configureSecrets();console.log('Secretos privados sincronizados. No se muestran valores.');}

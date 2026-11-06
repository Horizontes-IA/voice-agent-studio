import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const argv=process.argv.slice(2), root=path.resolve(argv[0]??process.cwd());
const checks=[];
// En la raíz del kit no hay un proyecto generado: comprueba el kit y di qué sigue.
if(fs.existsSync(path.join(root,'tools/create-project.mjs'))&&fs.existsSync(path.join(root,'presets'))){
  const [major,minor]=process.versions.node.split('.').map(Number);
  const presets=fs.readdirSync(path.join(root,'presets')).filter(name=>name.endsWith('.json')).length;
  const skills=fs.readdirSync(path.join(root,'skills'),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name);
  const home=os.homedir();
  const installedIn=[process.env.CLAUDE_CONFIG_DIR||path.join(home,'.claude'),process.env.CODEX_HOME||path.join(home,'.codex')].map(dir=>path.join(dir,'skills')).filter(dir=>skills.length&&skills.every(skill=>fs.existsSync(path.join(dir,skill,'kit-path.txt'))));
  const kitChecks=[{name:'Node.js',ok:major>22||(major===22&&minor>=22),detail:'Requiere Node 22.22 o superior'},{name:'Plantillas',ok:presets>0,detail:presets+' plantillas'},{name:'Skills',ok:skills.length>0,detail:skills.length+' skills'}];
  console.log(JSON.stringify({root,kind:'kit',checkedAt:new Date().toISOString(),checks:kitChecks,skillsInstalledIn:installedIn,next:installedIn.length?'Ejecuta npm run start para crear tu primera demo.':'Ejecuta npm run install-skills para instalar los skills.'},null,2));
  process.exit(kitChecks.every(item=>item.ok)?0:1);
}
const check=(name,ok,detail)=>checks.push({name,ok,detail});
check('Node.js',Number(process.versions.node.split('.')[0])>=22,'Requiere Node 22.22 o superior');
for(const file of ['package.json','wrangler.jsonc','business.config.json']) check(file,fs.existsSync(path.join(root,file)),'Archivo necesario');
if(fs.existsSync(path.join(root,'business.config.json'))) {
  const c=JSON.parse(fs.readFileSync(path.join(root,'business.config.json'),'utf8'));
  let validZone=true;try{new Intl.DateTimeFormat('es',{timeZone:c.timezone}).format();}catch{validZone=false;}
  check('Zona horaria',validZone,c.timezone);
  check('Catálogo',Array.isArray(c.services)&&c.services.length>0,c.services.length+' servicios');
}
check('Dependencias',fs.existsSync(path.join(root,'node_modules')),'Ejecuta npm ci');
check('Secretos locales',fs.existsSync(path.join(root,'.dev.vars')),'Ejecuta npm run setup. No se muestran valores.');
if(fs.existsSync(path.join(root,'wrangler.jsonc'))) {
  const c=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
  const db=c.d1_databases?.[0]?.database_id;
  check('D1 remoto',!!db&&db!=='00000000-0000-0000-0000-000000000000','Pendiente hasta crear tu D1 y sustituir database_id; no impide trabajar en local');
}
console.log(JSON.stringify({root,checkedAt:new Date().toISOString(),checks,networkCalls:0,voiceTested:false},null,2));
const required=checks.filter(c=>c.name!=='D1 remoto');
if(required.some(c=>!c.ok))process.exitCode=1;

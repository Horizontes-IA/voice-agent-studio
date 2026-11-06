import fs from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {args,studioRoot} from './shared.mjs';
import {createProject} from './create-project.mjs';
import {VERTICAL_IDS} from './verticals.mjs';
import {PROFILE_IDS} from './profiles.mjs';

export async function start(options){
  const opts={...options},interactive=!!process.stdin.isTTY&&!opts['non-interactive'];
  const rl=interactive?createInterface({input:process.stdin,output:process.stdout}):null;
  const ask=async(key,label,fallback)=>{if(opts[key]!==undefined)return opts[key];if(!rl)return fallback;return(await rl.question(label+' ['+fallback+']: ')).trim()||fallback;};
  try{
    const preset=await ask('preset','Plantilla: '+VERTICAL_IDS.join(', '),'dental');
    if(!VERTICAL_IDS.includes(preset)&&!opts.config)throw new Error('Plantilla inválida');
    const c=JSON.parse(fs.readFileSync(opts.config?path.resolve(opts.config):path.join(studioRoot,'presets',preset+'.json'),'utf8'));
    c.name=await ask('name','Nombre del negocio',c.name);c.city=await ask('city','Ciudad',c.city);
    c.slug=await ask('slug','Nombre único del Worker (minúsculas y guiones)',c.slug);
    c.timezone=await ask('timezone','Zona IANA',c.timezone);c.currency=await ask('currency','Moneda ISO',c.currency??'MXN');
    const profile=await ask('profile','Tipo de agente: '+PROFILE_IDS.join(', '),c.agent.profile??'recepcion');if(profile!=='recepcion')c.agent.profile=profile;
    c.mode=await ask('mode','Modo: demo o production',c.mode??'demo');
    const destination=await ask('out','Carpeta nueva',path.resolve('..',c.slug));
    const install=await ask('install','Instalar, generar secretos, migrar D1 local y compilar (si/no)','si');
    const out=createProject(c,destination);
    if(install===true||install==='si')for(const argv of [['ci','--no-audit','--no-fund'],['run','setup'],['run','db:local'],['run','build']])execFileSync('npm',argv,{cwd:out,stdio:'inherit'});
    console.log('Proyecto: '+out+'\nConfiguración: business.config.json\nSiguiente: npm run preview en el proyecto. Para publicar: npm run deploy:guided.');
    return out;
  }finally{rl?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const opts=args(process.argv.slice(2));
  if(opts.help)console.log('npm run start -- --preset salon --out ../mi-salon\nOpciones: --config negocio.json --name Nombre --slug nombre-unico --profile '+PROFILE_IDS.join('|')+' --mode demo|production --install si|no --non-interactive');
  else try{await start(opts);}catch(e){console.error(e.message);process.exitCode=1;}
}

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { args, studioRoot, baseRoot, copyBase, write, json, files } from './shared.mjs';
import { createProject } from './create-project.mjs';
const opts=args(process.argv.slice(2));
const destination=path.resolve(opts.out??path.join(studioRoot,'../releases/voice-agent-studio-v1'));
if(fs.existsSync(destination))throw new Error('La carpeta de entrega existe. Usa --out con otra ruta; no se reemplazan entregas anteriores.');
fs.mkdirSync(destination,{recursive:true});
const publicDir=path.join(destination,'youtube-dental'),community=path.join(destination,'voice-agent-studio');
const preset=JSON.parse(fs.readFileSync(path.join(studioRoot,'presets/dental.json'),'utf8'));
createProject(preset,publicDir,{publicDemo:true});
write(publicDir,'LICENSE',`MIT License\n\nCopyright (c) 2026 Horizontes IA\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
fs.mkdirSync(community,{recursive:true});
for(const name of ['package.json','package-lock.json','.github','AGENTS.md','CLAUDE.md','CHANGELOG.md','README.md','USO.md','INICIO.html','VALIDACION.md','tools','presets','modules','prompts','production','evaluations','skills','materials','tests','public','assets']){
  const src=path.join(studioRoot,name);if(!fs.existsSync(src))throw new Error('Falta recurso de entrega: '+name);
  fs.cpSync(src,path.join(community,name),{recursive:true});
}
// Notas internas de lanzamiento: no van en el repositorio público.
fs.rmSync(path.join(community,'materials/launch'),{recursive:true,force:true});
copyBase(path.join(community,'templates/base'));
// Sanitize the base snapshot too: it is a donor, not the existing deployed installation.
const baseCfg=JSON.parse(fs.readFileSync(path.join(publicDir,'wrangler.jsonc'),'utf8'));
json(path.join(community,'templates/base'),'wrangler.jsonc',baseCfg);
write(community,'.gitignore','.DS_Store\nnode_modules/\n.validation/\nreleases/\n.env*\n.dev.vars*\n.secrets/\n');
// Never include the original deployment IDs, cookies, local databases or credentials.
const privateValues=[];
const vars=path.join(baseRoot,'.dev.vars');
if(fs.existsSync(vars))for(const line of fs.readFileSync(vars,'utf8').split('\n')){
  const index=line.indexOf('=');if(index>0){const val=line.slice(index+1).trim();if(val.length>=12)privateValues.push(val);}
}
const originalConfig=path.join(baseRoot,'wrangler.jsonc');
if(fs.existsSync(originalConfig))for(const match of fs.readFileSync(originalConfig,'utf8').matchAll(/"(?:account_id|database_id)"\s*:\s*"([^"]+)"/g)){
  if(!/^0{8}-/.test(match[1]))privateValues.push(match[1]);
}
const forbidden=[/sk_[A-Za-z0-9]{20,}/,/gh[op]_[A-Za-z0-9]{20,}/];
for(const dir of [publicDir,community]){
  const entries=files(dir);for(const file of entries){
    const rel=path.relative(dir,file);if(/(^|\/)(\.secrets|\.wrangler|\.git|node_modules)(\/|$)|(^|\/)\.dev.vars/.test(rel))throw new Error('Archivo privado en entrega: '+rel);
    const data=fs.readFileSync(file,'utf8');
    if(forbidden.some(re=>re.test(data))||privateValues.some(secret=>data.includes(secret)))throw new Error('Dato del despliegue original en '+rel+'; no se creó ZIP.');
  }
  const manifest=Object.fromEntries(entries.map(file=>[path.relative(dir,file),createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  json(dir,'MANIFEST.sha256.json',manifest);
}
for(const name of ['youtube-dental','voice-agent-studio'])execFileSync('/usr/bin/zip',['-qr',name+'.zip',name],{cwd:destination});
console.log(JSON.stringify({destination,public:path.join(destination,'youtube-dental.zip'),community:path.join(destination,'voice-agent-studio.zip'),privateDataScan:'passed',published:false},null,2));

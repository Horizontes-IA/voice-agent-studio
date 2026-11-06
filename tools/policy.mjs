import fs from 'node:fs';
import path from 'node:path';
import { studioRoot } from './shared.mjs';
import { PROFILES,profileOf,applyProfile } from './profiles.mjs';
import { VERTICALS } from './verticals.mjs';
export function compilePolicy(config) {
  let core=fs.readFileSync(path.join(studioRoot,'prompts/core.md'),'utf8');
  const profile=profileOf(config);
  if(profile!=='recepcion')core=applyProfile(core,config);
  // Las plantillas probadas con voz conservan su prompt exacto. Las demás adaptan el acento desde agent.instructions.
  if(!VERTICALS[config.kind].voiceTested)core=core.replace('Atiendes en español mexicano.','Atiendes en español con el tono indicado en el estilo configurado por el negocio.');
  const substitutions={AGENT_NAME:'${s.name}',BUSINESS_NAME:config.name,CITY:config.city,TIMEZONE:config.timezone,STYLE:'${s.instructions}',
    IDENTITY_POLICY:'Este proyecto está en modo demo: administración eligió una identidad ficticia. No se realizó OTP. No presentes este mecanismo como verificación real. Nunca atiendas personas reales con este modo.',
    CAPABILITIES:PROFILES[profile].capabilities??'Agenda y datos en D1; conocimiento publicado en ElevenLabs; solicitudes pendientes en el dashboard. No hay SMS, email, WhatsApp, telefonía ni transferencia conectados por defecto.',
    VERTICAL_POLICY:config.agent.sectorPolicy??fs.readFileSync(path.join(studioRoot,'prompts',config.kind+'.md'),'utf8')};
  for(const [key,value] of Object.entries(substitutions)) core=core.replaceAll('{{'+key+'}}',value);
  // Keep only server-provided Eleven dynamic variables; templates are never executed as JS.
  return 'import type { AgentSettings } from "./data";\nexport const POLICY_VERSION="'+(profile==='recepcion'?'1.1.0':'1.1.0-'+profile)+'";\nexport function buildPolicy(s:AgentSettings){return '+JSON.stringify(core).replaceAll('${s.name}','" + s.name + "').replaceAll('${s.instructions}','" + s.instructions + "')+';}\n';
}

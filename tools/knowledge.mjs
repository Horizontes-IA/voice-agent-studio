import {PROFILES,profileOf} from './profiles.mjs';
export function managedKnowledge(c){
  const note=PROFILES[profileOf(c)].knowledgeNote;
  const days=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const schedule=s=>days.map((name,day)=>name+': '+((s[day]??[]).map(r=>r.join('–')).join(', ')||'cerrado')).join('; ');
  const content={
    'kb-business':`# ${c.name}\nUbicación: ${c.city}. Zona horaria: ${c.timezone}.\n${c.mode==='production'?'El personal se identifica con Access y los clientes verifican su teléfono en el portal.':'Demostración ficticia: '+(c.kind==='garage'?'personas, precios y órdenes sintéticos':'personas y precios sintéticos')+'. La identidad la elige administración; no equivale a verificación real.'}\nNo inventes dirección, teléfono, mensajes enviados ni disponibilidad.\nHorario: ${schedule(c.openingHours)}. Cierres específicos: ${c.closures.join(', ')||'ninguno configurado'}. La agenda determina cada opción disponible.`,
    'kb-services':c.services.map(s=>`- ${s.name} [${s.id}]: ${s.description}. Duración ${s.duration} min + ${s.buffer} min de preparación. Recursos compatibles: ${s.resource_ids.join(', ')}.`).join('\n')+`\nConsulta get_service_catalog para precios vigentes en ${c.currency}; null requiere valoración.`,
    'kb-team':c.providers.map(p=>`${p.name} [${p.id}]: especialidad ${p.specialty}; ${schedule(p.schedule)}.`).join('\n')+'\nNo deduzcas disponibilidad de estos horarios: usa search_availability.',
    'kb-policies':`Toda reserva, cambio o cancelación necesita resumen y aceptación explícita antes del commit. Cambios y cancelaciones automáticos hasta ${c.booking.cancellationHours} horas antes; después, revisión humana. Reservas con horizonte de ${c.booking.maxAdvanceDays} días. Recursos: ${c.resources.map(r=>r.id+' '+r.name).join(', ')}. Cada cita usa un profesional y un recurso. No hay cobros ni penalizaciones automáticas. Solicitudes humanas quedan pendientes y no son transferencia de llamada.`,
  };
  if(note)content['kb-policies']=note+'\n'+content['kb-policies'];
  return c.knowledge.map(d=>content[d.id]?{...d,content:content[d.id]}:d);
}

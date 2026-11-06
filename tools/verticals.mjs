// Un sector declara solo su vocabulario, icono y estado de prueba. Su proceso vive en presets/ y prompts/.
// voiceTested: la plantilla pasó pruebas con ElevenLabs real (ver VALIDACION.md). No lo marques sin evidencia.
// clinic y patients conservan las palabras clínica y paciente. health exige derivar urgencias y no diagnosticar.
export const VERTICALS={
  dental:{label:'Dental',icon:'Tooth',voiceTested:true,process:'Agenda por profesional, especialidad y puesto'},
  salon:{label:'Estética',icon:'Sparkles',voiceTested:true,process:'Paquete de 75 min + 15 de preparación en una sola cita'},
  garage:{label:'Taller',icon:'Settings2',voiceTested:true,process:'Órdenes con estado, nota pública y control de propietario'},
  veterinaria:{label:'Veterinaria',icon:'PawPrint',voiceTested:false,clinic:true,health:true,process:'Consultas por especialidad y urgencias fuera del agente'},
  fisioterapia:{label:'Fisioterapia',icon:'HeartPulse',voiceTested:false,clinic:true,patients:true,health:true,process:'Valoración antes del tratamiento, sin indicaciones clínicas'},
  inmobiliaria:{label:'Inmobiliaria',icon:'Building2',voiceTested:false,process:'Visitas de 60 min con 30 de traslado'},
  despacho:{label:'Despacho',icon:'Scale',voiceTested:false,process:'Consultas por área, sin asesoría por voz'},
  barberia:{label:'Barbería',icon:'Scissors',voiceTested:false,process:'Citas cortas con barbero y silla'},
  academia:{label:'Academia',icon:'GraduationCap',voiceTested:false,people:['alumnos','Alumnos','alumno','Alumno'],process:'Asesorías, clases muestra y examen de nivel'},
  nutricion:{label:'Nutrición',icon:'Apple',voiceTested:false,clinic:true,patients:true,health:true,process:'Primera consulta y seguimiento, sin dietas por voz'},
  psicologia:{label:'Psicología',icon:'Brain',voiceTested:false,clinic:true,patients:true,health:true,process:'Sesiones sin pedir el motivo; una crisis no se resuelve con cita'},
  pediatria:{label:'Pediatría',icon:'Baby',voiceTested:false,clinic:true,patients:true,health:true,process:'Agenda con el tutor; urgencias y dosis fuera del agente'},
  laboratorio:{label:'Laboratorio',icon:'FlaskConical',voiceTested:false,patients:true,health:true,process:'Tomas por cubículo y curva de 165 min; no interpreta resultados'},
  optica:{label:'Óptica',icon:'Glasses',voiceTested:false,health:true,process:'Examen, lentes de contacto y entrega con recursos distintos'},
  spa:{label:'Spa',icon:'Flower2',voiceTested:false,process:'Terapeuta y cabina; embarazo o lesión pasan a revisión humana'},
  gimnasio:{label:'Gimnasio',icon:'Dumbbell',voiceTested:false,people:['socios','Socios','socio','Socio'],process:'Valoración y entrenamiento personal; clases con cupo fuera del agente'},
  motos:{label:'Taller de motos',icon:'Bike',voiceTested:false,process:'Agenda de llegada por bahía, sin órdenes conectadas'},
  seguros:{label:'Seguros',icon:'Umbrella',voiceTested:false,process:'Asesorías por ramo, sin primas ni coberturas por voz'},
  contabilidad:{label:'Contabilidad',icon:'Calculator',voiceTested:false,process:'Consultas por área; no calcula impuestos ni recibe claves'},
  manejo:{label:'Escuela de manejo',icon:'Car',voiceTested:false,people:['alumnos','Alumnos','alumno','Alumno'],process:'Clases con instructor y auto; no garantiza la licencia'},
  eventos:{label:'Salón de eventos',icon:'PartyPopper',voiceTested:false,process:'Visitas y degustaciones; una visita no aparta la fecha'},
};
export const VERTICAL_IDS=Object.keys(VERTICALS);
const DEFAULT_PEOPLE=['clientes','Clientes','cliente','Cliente'];
export function vocabulary(c){
  if(c.kind==='dental')return [];
  const v=VERTICALS[c.kind],p=v.people??DEFAULT_PEOPLE;
  // Solo en plantillas sin voz probada, para que las probadas conserven su código generado.
  const untested=v.voiceTested?[]:[
    ...(v.clinic?[]:[['En clínica','En atención'],['consulta_clinica','consulta'],['datos clínicos','datos sensibles']]),
    ...(v.health?[]:[['El agente no diagnostica, no receta y verifica permisos','El agente no decide por el equipo y verifica permisos']]),
  ];
  return [...untested,['Clínica Sonrisa Norte',c.name],['Sonrisa Norte',c.name],['Clínica Monterrey',c.name],['Clinic OS','Voice OS'],
    ...(v.clinic?[]:[['clínica','operación'],['Clínica','Negocio'],['CLÍNICA','NEGOCIO']]),
    ...(v.patients?[]:[['pacientes',p[0]],['Pacientes',p[1]],['paciente',p[2]],['Paciente',p[3]],['PACIENTE',p[2].toUpperCase()]]),
    ['odontólogo','profesional'],['odontología','atención'],['odontoncista','especialista'],['sillón','puesto'],['Monterrey',c.city]];
}

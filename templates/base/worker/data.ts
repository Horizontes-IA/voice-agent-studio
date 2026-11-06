import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
export const ZONE = "America/Monterrey";
export const now = () => new Date().toISOString();
export const today = () => formatInTimeZone(new Date(), ZONE, "yyyy-MM-dd");
export interface Service {
  id: string;
  name: string;
  duration: number;
  buffer: number;
  price: number | null;
  specialty: string;
  enabled: number;
  description: string;
}
export interface Provider {
  id: string;
  name: string;
  specialty: string;
  initials: string;
  color: string;
  weekdays: string;
  start_hour: number;
  end_hour: number;
}
export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  initials: string;
  is_demo: number;
  created_at: string;
}
export interface Appointment {
  id: string;
  patient_id: string;
  provider_id: string;
  service_id: string;
  chair: number;
  starts_at: string;
  ends_at: string;
  occupied_until: string;
  status: string;
  version: number;
  source: string;
  notes: string;
  patient_name?: string;
  service_name?: string;
  provider_name?: string;
  color?: string;
  initials?: string;
  price?: number;
}
export interface Knowledge {
  id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  published_version: number;
  remote_id: string | null;
  updated_at: string;
}
export interface AgentSettings {
  name: string;
  first_message: string;
  instructions: string;
  voice_id: string;
  llm: string;
  active: boolean;
  speed: number;
  max_duration: number;
  version: number;
  published_version: number;
  remote_agent_id: string;
  last_published_at: string | null;
}
export const defaultAgent: AgentSettings = {
  name: "Marco",
  first_message:
    "Hola, soy Marco, el asistente virtual de Clínica Sonrisa Norte. ¿Quieres agendar una cita o necesitas información?",
  instructions:
    "Habla con calidez, claridad y frases breves. Haz una pregunta a la vez. Confirma nombres, fechas y horarios antes de realizar cambios. Si no tienes información suficiente, consulta a recepción.",
  voice_id: "",
  llm: "gemini-2.5-flash",
  active: true,
  speed: 1,
  max_duration: 600,
  version: 1,
  published_version: 0,
  remote_agent_id: "",
  last_published_at: null,
};
export async function getSettings(db: D1Database): Promise<AgentSettings> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key='agent'")
    .first<{ value: string }>();
  return row ? { ...defaultAgent, ...JSON.parse(row.value) } : defaultAgent;
}
export async function putSettings(db: D1Database, value: AgentSettings) {
  await db
    .prepare(
      "INSERT INTO settings(key,value) VALUES('agent',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')",
    )
    .bind(JSON.stringify(value))
    .run();
}
export async function activity(
  db: D1Database,
  type: string,
  title: string,
  detail = "",
  source = "staff",
) {
  await db
    .prepare(
      "INSERT INTO activities(id,type,title,detail,source) VALUES(?,?,?,?,?)",
    )
    .bind(crypto.randomUUID(), type, title, detail, source)
    .run();
}
export const appointmentQuery = `SELECT a.*,p.name patient_name,p.initials,s.name service_name,s.price,pr.name provider_name,pr.color FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN services s ON s.id=a.service_id JOIN providers pr ON pr.id=a.provider_id`;
export const kbSeeds = [
  {
    id: "kb-clinic",
    title: "Conoce la clínica",
    category: "Clínica",
    content:
      "# Clínica Sonrisa Norte\nClínica ficticia para demostración, situada en Monterrey, Nuevo León, México. No tiene dirección física ni teléfono reales. Nunca inventes una dirección.\nHorario general: lunes a viernes de 9:00 a 19:00; sábado de 9:00 a 14:00; domingo cerrado. Zona horaria: America/Monterrey. Moneda: MXN. Consulta get_clinic_status para cierres excepcionales.\nContamos con dos sillones y atención de odontología general y ortodoncia. La recepción puede revisar solicitudes desde su panel. Esta demo solo utiliza pacientes ficticios.",
  },
  {
    id: "kb-services",
    title: "Servicios y valoraciones",
    category: "Servicios",
    content:
      "# Servicios\nOfrecemos valoración inicial, solicitud de limpieza de rutina y valoración de ortodoncia. Cada visita está sujeta a la evaluación del profesional. Consulta get_service_catalog para duración, precios vigentes y compatibilidad.\nLos tratamientos como endodoncia, implantes, cirugía, extracciones y rehabilitación requieren valoración previa y planificación profesional. No los reserves como tratamientos directamente. No deduzcas un tratamiento por los síntomas. Los controles de ortodoncia requieren autorización del equipo y se canalizan a recepción en esta demo.",
  },
  {
    id: "kb-team",
    title: "Equipo y especialidades",
    category: "Clínica",
    content:
      "# Equipo ficticio\nDra. Ana Torres: odontología general, lunes a viernes. Dr. Luis Medina: odontología general, martes a sábado. Dra. Paula Ríos: ortodoncia, martes y jueves de 14:00 a 19:00.\nLa disponibilidad exacta siempre se consulta mediante search_availability. No uses estos horarios generales para afirmar que existe una cita libre.",
  },
  {
    id: "kb-policies",
    title: "Reservas, cambios y cancelaciones",
    category: "Políticas",
    content:
      "# Políticas de demostración\nLas reservas necesitan confirmación explícita del paciente. Los cambios y cancelaciones automáticos se permiten hasta 24 horas antes. Después, recepción debe revisar la solicitud.\nSolicitamos llegar 10 minutos antes; la tolerancia propuesta es de 10 minutos. Recepción revisa retrasos mayores.\nAntes de consultar o modificar citas, valida la sesión del paciente. Para menores, tutores o citas de otras personas, canaliza a recepción. No cobres ni apliques penalizaciones. Si no hay disponibilidad, ofrece lista de espera sin prometer una cita.",
  },
  {
    id: "kb-prices",
    title: "Precios orientativos y pagos",
    category: "Administración",
    content:
      "# Precios y pagos\nTodos los precios son ficticios para la demostración. Consulta get_service_catalog antes de mencionar un importe. Una cantidad marcada como desde es orientativa, no un presupuesto final.\nLos presupuestos de tratamientos se dan después de valoración. No prometas cobertura de seguros, promociones ni financiamiento. Para pagos, facturas y seguros, crea una solicitud de recepción. No solicites números de tarjeta.",
  },
  {
    id: "kb-first",
    title: "Primera visita",
    category: "Pacientes",
    content:
      "# Primera visita\nRecoge nombre completo y un contacto. Explica que una valoración permite al odontólogo conocer el motivo de consulta y determinar los siguientes pasos. No promete completar un tratamiento durante esa cita.\nPide llegar 10 minutos antes. No recabes expediente clínico completo, fotografías, radiografías ni datos de pago por voz. Las indicaciones específicas deben venir del profesional.",
  },
  {
    id: "kb-escalation",
    title: "Atención del equipo y límites",
    category: "Protocolos",
    content:
      "# Escalamiento\nEste asistente es administrativo: no diagnostica, receta ni recomienda dosis. Las dudas clínicas, complicaciones, quejas de cobro, menores y problemas de verificación se canalizan a recepción.\nAnte una posible emergencia, interrumpe la reserva ordinaria e indica buscar atención de emergencia local; no demores esta indicación solicitando identidad. Esta demo no es un servicio de atención de emergencias y el protocolo de una clínica real debe ser aprobado por su responsable clínico.\nEn navegador solo podemos registrar una solicitud: no afirmes que una llamada fue transferida ni prometas atención inmediata. Si create_staff_request falla, reconoce que no quedó registrada.",
  },
  {
    id: "kb-faq",
    title: "Preguntas frecuentes",
    category: "Pacientes",
    content:
      "# Preguntas frecuentes\n¿Puedo escoger odontólogo? Sí, según el servicio y la disponibilidad consultada en el sistema.\n¿Atienden sábados? El horario general es de 9:00 a 14:00; consulta el estado de la clínica para excepciones.\n¿Pueden decirme qué tratamiento necesito? El odontólogo lo determina en una valoración.\n¿Puedo reservar para mi hijo? Recepción debe validar al tutor y gestionar la cita.\n¿No hay horarios? Puedes ampliar tu búsqueda o pedir entrar en lista de espera.\n¿Puedo hablar con alguien? El asistente puede registrar una solicitud para recepción; no hay transferencia de voz en vivo en esta demo web.",
  },
];
export async function seed(db: D1Database) {
  const count = await db
    .prepare("SELECT COUNT(*) n FROM providers")
    .first<{ n: number }>();
  if (count?.n) return;
  const statements: D1PreparedStatement[] = [];
  const providers = [
    ["ana", "Dra. Ana Torres", "general", "AT", "#288f77", "1,2,3,4,5", 9, 19],
    ["luis", "Dr. Luis Medina", "general", "LM", "#5b83b8", "2,3,4,5,6", 9, 19],
    ["paula", "Dra. Paula Ríos", "ortodoncia", "PR", "#ad87bc", "2,4", 14, 19],
  ];
  for (const p of providers)
    statements.push(
      db
        .prepare(
          "INSERT INTO providers(id,name,specialty,initials,color,weekdays,start_hour,end_hour) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(...p),
    );
  const services = [
    [
      "valoracion",
      "Valoración inicial",
      30,
      10,
      600,
      "Una primera evaluación con nuestro equipo.",
      "general",
    ],
    [
      "limpieza",
      "Limpieza de rutina",
      45,
      10,
      900,
      "Solicitud de limpieza sujeta a valoración.",
      "general",
    ],
    [
      "ortodoncia",
      "Valoración de ortodoncia",
      45,
      10,
      700,
      "Primera valoración con nuestra ortodoncista.",
      "ortodoncia",
    ],
  ];
  for (const s of services)
    statements.push(
      db
        .prepare(
          "INSERT INTO services(id,name,duration,buffer,price,description,specialty) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(...s),
    );
  const names = [
    "Mariana García",
    "Carlos Hernández",
    "Valeria López",
    "Diego Martínez",
    "Sofía Rodríguez",
    "Andrés Pérez",
    "Camila González",
    "Sebastián Ramírez",
    "Regina Torres",
    "Emiliano Flores",
    "Ximena Sánchez",
    "Mateo Rivera",
    "Lucía Gómez",
    "Daniel Ortiz",
    "Renata Cruz",
    "Santiago Reyes",
    "Ana Morales",
    "Pablo Mendoza",
    "Isabella Castro",
    "Alejandro Vargas",
  ];
  names.forEach((name, i) =>
    statements.push(
      db
        .prepare(
          "INSERT INTO patients(id,name,phone,email,initials) VALUES(?,?,?,?,?)",
        )
        .bind(
          "patient-" + (i + 1),
          name,
          "+52810000" + String(i + 1).padStart(4, "0"),
          "paciente" + (i + 1) + "@example.com",
          name
            .split(" ")
            .map((n) => n[0])
            .join(""),
        ),
    ),
  );
  for (const d of kbSeeds) {
    statements.push(
      db
        .prepare(
          "INSERT INTO knowledge_documents(id,title,category,content) VALUES(?,?,?,?)",
        )
        .bind(d.id, d.title, d.category, d.content),
    );
    statements.push(
      db
        .prepare(
          "INSERT INTO knowledge_revisions(id,document_id,version,content) VALUES(?,?,1,?)",
        )
        .bind(crypto.randomUUID(), d.id, d.content),
    );
  }
  statements.push(
    db
      .prepare("INSERT INTO settings(key,value) VALUES('agent',?)")
      .bind(JSON.stringify(defaultAgent)),
  );
  let n = 0;
  for (let day = 0; day < 14; day++) {
    const date = new Date(today() + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + day);
    const dateStr = date.toISOString().slice(0, 10);
    const dow = date.getUTCDay();
    if (dow === 0) continue;
    for (let slot = 0; slot < 4; slot++) {
      const provider =
        dow === 1
          ? "ana"
          : dow === 6
            ? "luis"
            : slot % 2 === 0
              ? "ana"
              : "luis";
      const hour = dow === 6 ? 9 + slot : 9 + slot * 2;
      const service = slot % 2 === 0 ? "valoracion" : "limpieza";
      const minutes = service === "valoracion" ? 30 : 45;
      const start = fromZonedTime(
        dateStr + "T" + String(hour).padStart(2, "0") + ":00:00",
        ZONE,
      );
      const end = new Date(start.getTime() + minutes * 60_000);
      const occupied = new Date(end.getTime() + 600_000);
      statements.push(
        db
          .prepare(
            "INSERT INTO appointments(id,patient_id,provider_id,service_id,chair,starts_at,ends_at,occupied_until,status,source) VALUES(?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            "seed-appointment-" + n,
            "patient-" + ((n % 20) + 1),
            provider,
            service,
            (slot % 2) + 1,
            start.toISOString(),
            end.toISOString(),
            occupied.toISOString(),
            n % 3 === 0 ? "confirmed" : "booked",
            "demo",
          ),
      );
      n++;
    }
  }
  statements.push(
    db
      .prepare(
        "INSERT INTO activities(id,type,title,detail,source) VALUES(?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        "system",
        "Tu clínica está lista",
        "Se cargaron 20 pacientes y una agenda de demostración.",
        "demo",
      ),
  );
  await db.batch(statements);
}

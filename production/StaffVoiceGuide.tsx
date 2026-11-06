import { Modal } from './ui';
export default function StaffVoiceGuide({close}:{close:()=>void;data?:unknown;refresh?:unknown;notify?:unknown}){
  return <Modal title="Probar el portal de clientes" onClose={close}><div style={{display:'grid',gap:18,padding:12}}><p>En esta instalación cada persona verifica su teléfono antes de conversar. El personal no selecciona una identidad ajena desde el dashboard.</p><a className="button primary" href="/patient" target="_blank" rel="noreferrer">Abrir portal de clientes</a><p>Usa un teléfono autorizado para la prueba. El envío del código y la voz consumen las cuentas de los proveedores configurados.</p></div></Modal>;
}

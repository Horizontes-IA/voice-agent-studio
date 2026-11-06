import { useEffect, useState } from 'react';
import { api, post } from './lib';
type Order={id:string;customer_name:string;vehicle:string;status:string;public_note:string;promised_at:string|null;version:number};
const labels:Record<string,string>={received:'Recibido',inspection:'En revisión',awaiting_approval:'Pendiente de autorización',in_progress:'En trabajo',ready:'Listo para recoger',delivered:'Entregado'};
function OrderCard({order,onSave}:{order:Order;onSave:(o:Order)=>Promise<void>}){
  const [status,setStatus]=useState(order.status),[note,setNote]=useState(order.public_note),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <article style={{padding:24,border:'1px solid #dce5e0',borderRadius:16,background:'white',display:'grid',gap:12}}>
    <div><small>{order.id} · {order.customer_name}</small><h2>{order.vehicle}</h2></div>
    <label>Estado<select aria-label={'Estado '+order.id} value={status} onChange={e=>setStatus(e.target.value)}>{Object.entries(labels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Nota que puede leer el agente<textarea aria-label={'Nota '+order.id} value={note} maxLength={500} onChange={e=>setNote(e.target.value)}/></label>
    <small>{order.promised_at ? 'Entrega indicada por el equipo: '+order.promised_at : 'Sin fecha de entrega confirmada.'}</small>
    {error && <p role="alert">{error}</p>}
    <button className="button primary" disabled={busy||note.trim().length<3} onClick={async()=>{setBusy(true);setError('');try{await onSave({...order,status,public_note:note});}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');}finally{setBusy(false);}}}>{busy?'Guardando…':'Guardar orden'}</button>
  </article>;
}
export default function StudioOrders(){
  const [orders,setOrders]=useState<Order[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [people,setPeople]=useState<{id:string;name:string}[]>([]),[show,setShow]=useState(false),[owner,setOwner]=useState(''),[vehicle,setVehicle]=useState(''),[note,setNote]=useState(''),[saving,setSaving]=useState(false);
  async function load(){const [d,p]=await Promise.all([api<{orders:Order[]}>('/work-orders'),api<{patients:{id:string;name:string}[]}>('/dashboard')]);setOrders(d.orders);setPeople(p.patients);}
  useEffect(()=>{load().catch(e=>setError(String(e))).finally(()=>setLoading(false));},[]);
  return <section><h1>Órdenes de trabajo</h1><p>El agente consulta únicamente las órdenes del cliente seleccionado. Las actualizaciones se realizan desde este panel.</p><button className="button primary" style={{marginTop:16}} onClick={()=>setShow(!show)}>Nueva orden</button>{show&&<form style={{display:'grid',gap:12,padding:20,marginTop:16,background:'white',borderRadius:16}} onSubmit={e=>{e.preventDefault();setSaving(true);setError('');void post('/work-orders',{patient_id:owner,vehicle,public_note:note}).then(async()=>{await load();setShow(false);setVehicle('');setNote('');}).catch(e=>setError(String(e))).finally(()=>setSaving(false));}}><label>Cliente<select required value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Selecciona un cliente</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Vehículo<input required minLength={3} maxLength={120} value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label><label>Nota pública<textarea required minLength={3} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="button primary" disabled={saving}>{saving?'Guardando…':'Registrar orden'}</button></form>}{error&&<p role="alert">{error}</p>}{loading&&<p>Cargando órdenes…</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:20,marginTop:24}}>{orders.map(order=><OrderCard key={order.id+'-'+order.version} order={order} onSave={async o=>{await post('/work-orders/'+encodeURIComponent(o.id),{status:o.status,public_note:o.public_note,version:o.version});await load();}}/>)}</div>
  </section>;
}

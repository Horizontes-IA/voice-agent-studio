import { useEffect, useState } from 'react';
import { api, post } from './lib';
import { PROFILE } from '../worker/profile';
type Capture={id:string;customer_name:string;answers:Record<string,string|number>;summary:string;score:number|null;status:string;updated_at:string};
const intro:Record<string,string>={lead:'Lo que el agente registró de cada conversación. Revisa y da seguimiento desde aquí.',survey:'Las respuestas que el agente recogió después de cada visita.'};
export default function StudioCaptures(){
  const form=PROFILE.capture!;
  const [rows,setRows]=useState<Capture[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  async function load(){setRows((await api<{captures:Capture[]}>('/captures')).captures);}
  useEffect(()=>{load().catch(e=>setError(String(e))).finally(()=>setLoading(false));},[]);
  const scored=rows.filter(r=>r.score!==null);
  const average=scored.length?(scored.reduce((sum,r)=>sum+(r.score??0),0)/scored.length).toFixed(1):null;
  return <section>
    <h1>{form.title}</h1>
    <p>{intro[form.kind]}</p>
    <p><strong>{rows.length}</strong> registros · <strong>{rows.filter(r=>r.status==='new').length}</strong> sin revisar{average&&<> · promedio <strong>{average}/10</strong></>}</p>
    {error&&<p role="alert">{error}</p>}
    {loading&&<p>Cargando…</p>}
    {!loading&&!rows.length&&!error&&<p>Todavía no hay registros. Aparecerán cuando el agente guarde una conversación.</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:20,marginTop:24}}>
      {rows.map(row=><article key={row.id} style={{padding:24,border:'1px solid #dce5e0',borderRadius:16,background:'white',display:'grid',gap:12}}>
        <div><small>{row.status==='new'?'Sin revisar':'Revisado'}</small><h2>{row.customer_name}</h2></div>
        <p>{row.summary}</p>
        <dl style={{display:'grid',gap:8,margin:0}}>{form.fields.filter(f=>row.answers[f.id]!==undefined).map(f=><div key={f.id}><dt><small>{f.label}</small></dt><dd style={{margin:0}}>{row.answers[f.id]==='no_respondio'?'No respondió':String(row.answers[f.id])}</dd></div>)}</dl>
        {row.status==='new'&&<button className="button primary" onClick={async()=>{setError('');try{await post('/captures/'+encodeURIComponent(row.id)+'/review',{});await load();}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');}}}>Marcar como revisado</button>}
      </article>)}
    </div>
  </section>;
}

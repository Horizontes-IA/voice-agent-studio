import { useState, useRef, useEffect } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { post } from './lib';
import business from '../business.config.json';
function Portal(){
  const [phone,setPhone]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[consent,setConsent]=useState(false),[challenge,setChallenge]=useState(''),[verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[messages,setMessages]=useState<string[]>([]);
  const session=useRef('');
  const finish=async()=>{if(session.current){const id=session.current;session.current='';await post('/portal/voice/'+id+'/end').catch(()=>{});}};
  const conversation=useConversation({onMessage:m=>setMessages(v=>[...v,(m.source==='ai'?'Asistente: ':'Tú: ')+m.message]),onConnect:({conversationId})=>{if(session.current)void post('/portal/voice/'+session.current+'/attach',{conversation_id:conversationId}).catch(()=>setError('El historial está pendiente de vincular. Las acciones se conservan en la agenda.'));},onDisconnect:()=>{void finish();},onError:()=>{setError('La conversación se interrumpió. Revisa el resultado antes de repetir una reserva.');void finish();}});
  useEffect(()=>()=>{void conversation.endSession();void finish();},[]);
  async function act(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar');}finally{setBusy(false);}}
  return <main style={{maxWidth:620,margin:'6vh auto',padding:28,background:'white',borderRadius:24,display:'grid',gap:18}}>
    <small>{business.name} · Asistente virtual</small><h1>Hablemos de tu próxima visita</h1><p>Verifica tu teléfono antes de consultar o modificar información. Si necesitas ayuda de una persona, utiliza el canal oficial del negocio.</p>
    {!verified?<form style={{display:'grid',gap:14}} onSubmit={e=>{e.preventDefault();void act(async()=>{if(!challenge){const r=await post<{challenge_id:string}>('/portal/start',{phone,consent});setChallenge(r.challenge_id);}else{await post('/portal/check',{challenge_id:challenge,code,name});setVerified(true);}});}}>
      <label>Tu nombre<input required autoComplete="name" value={name} minLength={3} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
      <label>Teléfono con código de país<input required autoComplete="tel" type="tel" placeholder="+52…" disabled={!!challenge} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      {!challenge?<label style={{display:'flex',gap:10}}><input style={{width:18}} type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>Acepto recibir un código de verificación por SMS para esta solicitud.</label>:<label>Código recibido<input required inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={10} onChange={e=>setCode(e.target.value)}/></label>}
      <button className="button primary" disabled={busy}>{busy?'Procesando…':challenge?'Verificar código':'Solicitar código'}</button>
      {challenge&&<button type="button" className="button" disabled={busy} onClick={()=>{setChallenge('');setCode('');}}>Cambiar teléfono</button>}
    </form>:<><p>Teléfono verificado para esta sesión. Permite el micrófono para conversar.</p><button className="button primary" disabled={busy||conversation.status==='connecting'} onClick={()=>void act(async()=>{if(conversation.status==='connected'){await conversation.endSession();await finish();return;}const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());const r=await post<{signed_url:string;session_id:string;dynamic_variables:Record<string,string>}>('/portal/voice');session.current=r.session_id;setMessages([]);await conversation.startSession({signedUrl:r.signed_url,connectionType:'websocket',dynamicVariables:r.dynamic_variables});})}>{conversation.status==='connected'?'Terminar conversación':'Hablar con el asistente'}</button><button className="button" onClick={()=>void act(async()=>{await conversation.endSession();await finish();await post('/portal/logout');setVerified(false);setChallenge('');setCode('');setMessages([]);})}>Cerrar sesión</button></>}
    {error&&<p role="alert">{error}</p>}<div aria-live="polite" style={{display:'grid',gap:10}}>{messages.map((message,i)=><p key={i}>{message}</p>)}</div>
  </main>;
}
export default function CustomerPortal(){return <ConversationProvider><Portal/></ConversationProvider>;}

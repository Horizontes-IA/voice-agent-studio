export type VerifyEnv={TWILIO_ACCOUNT_SID?:string;TWILIO_AUTH_TOKEN?:string;TWILIO_VERIFY_SERVICE_SID?:string};
export async function verifyPhone(env:VerifyEnv,phone:string,code?:string,request:typeof fetch=fetch){
  if(!env.TWILIO_ACCOUNT_SID||!env.TWILIO_AUTH_TOKEN||!env.TWILIO_VERIFY_SERVICE_SID)throw new Error('IDENTITY_PROVIDER_NOT_CONFIGURED');
  if(!/^\+[1-9][0-9]{7,14}$/.test(phone)|| (code!==undefined&&!/^[0-9]{4,10}$/.test(code)))throw new Error('INVALID_VERIFICATION_INPUT');
  const body=new URLSearchParams({To:phone,...(code!==undefined?{Code:code}:{Channel:'sms',Locale:'es'})});
  const r=await request('https://verify.twilio.com/v2/Services/'+encodeURIComponent(env.TWILIO_VERIFY_SERVICE_SID)+'/'+(code!==undefined?'VerificationCheck':'Verifications'),{
    method:'POST',headers:{Authorization:'Basic '+btoa(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN),'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error('VERIFICATION_NOT_COMPLETED');
  const data=await r.json() as {status:string};
  return code!==undefined?data.status==='approved':data.status==='pending';
}

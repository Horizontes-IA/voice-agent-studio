import {formatInTimeZone, fromZonedTime} from 'date-fns-tz';
export type Schedule=Partial<Record<string,string[][]>>;
export type Rules={timezone:string;currency:string;resources:{id:number;name:string}[];openingHours:Schedule;closures:string[];booking:{slotMinutes:number;maxAdvanceDays:number;cancellationHours:number};providers:{id:string;schedule:Schedule}[];services:{id:string;resource_ids:number[]}[]};
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
export function nextDate(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export function validLocalDate(date:string){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;}
export function localDayBounds(c:Rules,date:string){return [fromZonedTime(date+'T00:00:00',c.timezone),fromZonedTime(nextDate(date)+'T00:00:00',c.timezone)] as const;}
export function windows(c:Rules,date:string,providerId:string){
  if(c.closures.includes(date))return [];
  const day=String(new Date(date+'T12:00:00Z').getUTCDay()),provider=c.providers.find(p=>p.id===providerId);
  if(!provider)return [];
  const result:[number,number][]=[];
  for(const [a,b] of c.openingHours[day]??[])for(const [x,y] of provider.schedule[day]??[]){const start=Math.max(minutes(a),minutes(x)),end=Math.min(minutes(b),minutes(y));if(start<end)result.push([start,end]);}
  return result;
}
export function resourceAllowed(c:Rules,serviceId:string,resourceId:number){return c.resources.some(r=>r.id===resourceId)&&!!c.services.find(s=>s.id===serviceId)?.resource_ids.includes(resourceId);}
export function withinSchedule(c:Rules,providerId:string,start:Date,totalMinutes:number){
  const localDate=formatInTimeZone(start,c.timezone,'yyyy-MM-dd'),at=Number(formatInTimeZone(start,c.timezone,'H'))*60+Number(formatInTimeZone(start,c.timezone,'m'));
  if(at%c.booking.slotMinutes||start.getUTCSeconds()||start.getUTCMilliseconds())return false;
  const until=new Date(start.getTime()+totalMinutes*60000),endDate=formatInTimeZone(until,c.timezone,'yyyy-MM-dd'),finish=Number(formatInTimeZone(until,c.timezone,'H'))*60+Number(formatInTimeZone(until,c.timezone,'m'));
  return windows(c,localDate,providerId).some(([a,b])=>at>=a&&(endDate===localDate?finish<=b&&finish>at:b===1440&&endDate===nextDate(localDate)&&finish===0));
}
export function candidateStarts(c:Rules,date:string,providerId:string,totalMinutes:number){
  const values:Date[]=[];
  for(const [a,b] of windows(c,date,providerId))for(let m=a;m+totalMinutes<=b;m+=c.booking.slotMinutes){
    const expected=date+'T'+String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')+':00',start=fromZonedTime(expected,c.timezone);
    // Reject nonexistent wall-clock times during a daylight-saving transition.
    if(formatInTimeZone(start,c.timezone,"yyyy-MM-dd'T'HH:mm:ss")===expected&&withinSchedule(c,providerId,start,totalMinutes))values.push(start);
  }
  return values;
}
export function statusRules(c:Rules,date:string){return {date,timezone:c.timezone,currency:c.currency,opening_hours:c.openingHours,closed:c.closures.includes(date),resources:c.resources,booking:c.booking};}

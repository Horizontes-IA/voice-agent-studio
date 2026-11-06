import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import {validateConfig} from '../tools/config.mjs';
const require=createRequire(import.meta.url);
let source=stripTypeScriptTypes(fs.readFileSync(new URL('../modules/rules.ts',import.meta.url),'utf8')).replace("from 'date-fns-tz'",'from '+JSON.stringify(pathToFileURL(require.resolve('date-fns-tz')).href));
const rules=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function config(){const c=JSON.parse(fs.readFileSync(new URL('../presets/salon.json',import.meta.url),'utf8'));c.timezone='Europe/Copenhagen';c.currency='DKK';c.resources=[{id:1,name:'Cabina A'},{id:2,name:'Cabina B'},{id:3,name:'Cabina C'}];c.openingHours={'0':[['08:00','13:00']],'1':[['07:00','12:00'],['14:00','22:00']],'2':[['07:00','22:00']]};c.providers[0].schedule={'0':[['08:00','12:00']],'1':[['08:00','11:00'],['15:00','21:00']],'2':[['07:00','22:00']]};c.providers[1].schedule={'1':[['08:00','19:00']]};c.providers[2].schedule={'2':[['14:00','19:00']]};return validateConfig(c);}
test('custom timezone, currency, three resources and Sunday opening are supported',()=>{
  const c=config();assert.equal(c.currency,'DKK');assert.equal(rules.resourceAllowed(c,'corte',3),true);
  const starts=rules.candidateStarts(c,'2026-10-25','lia',55);assert.ok(starts.length);assert.equal(starts[0].toISOString(),'2026-10-25T07:00:00.000Z');
});
test('split shifts intersect with the professional schedule and buffer',()=>{
  const c=config();assert.deepEqual(rules.windows(c,'2026-10-19','lia'),[[480,660],[900,1260]]);
  assert.equal(rules.withinSchedule(c,'lia',new Date('2026-10-19T08:30:00Z'),90),false);
  assert.equal(rules.withinSchedule(c,'lia',new Date('2026-10-19T13:00:00Z'),90),true);
});
test('closure and service-specific resources override general availability',()=>{
  const c=config();c.closures=['2026-10-19'];c.services[0].resource_ids=[3];
  assert.deepEqual(rules.candidateStarts(c,'2026-10-19','lia',30),[]);assert.equal(rules.resourceAllowed(c,'corte',1),false);
});
test('day bounds preserve 23 and 25 hour daylight saving dates',()=>{
  const c=config();let [a,b]=rules.localDayBounds(c,'2027-03-28');assert.equal((b-a)/3600000,23);
  [a,b]=rules.localDayBounds(c,'2026-10-25');assert.equal((b-a)/3600000,25);
  c.openingHours={'0':[['01:00','05:00']]};c.providers[0].schedule={'0':[['01:00','05:00']]};
  const starts=rules.candidateStarts(c,'2027-03-28','lia',30);assert.ok(starts.every(d=>new Intl.DateTimeFormat('en-GB',{timeZone:c.timezone,hour:'2-digit',hour12:false}).format(d)!=='02'));
});
test('invalid dates, overlapping intervals, fake timezones and unreachable services fail early',()=>{
  assert.equal(rules.validLocalDate('2026-02-30'),false);
  const c=config();c.timezone='America/Guadalajara';assert.throws(()=>validateConfig(c),/IANA/);
  const d=config();d.openingHours={'1':[['08:00','12:00'],['11:00','14:00']]};assert.throws(()=>validateConfig(d),/superpuestos/);
  const e=config();e.services[2].duration=480;assert.throws(()=>validateConfig(e),/sin profesional/);
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args } from './shared.mjs';

// Misma fórmula que materials/business/valoracion.html. Sin valores por defecto: cada cifra la da el dueño.
const NUMBERS=['llamadas_mes','perdidas_pct','conversion_pct','valor_cita','margen_pct'];
const TEXTS=['negocio','moneda','fuente'];
const PERCENTS=['perdidas_pct','conversion_pct','margen_pct'];
const percent=(name,value)=>{
  if(value>100)throw new Error(name+' debe estar entre 0 y 100.');
  if(value>0&&value<1)throw new Error(name+' parece una fracción: escribe 30 para 30%. Si de verdad es menos de 1%, redondea a 1.');
};
export function computeValuation(input){
  const missing=[...NUMBERS.filter(k=>typeof input?.[k]!=='number'||!Number.isFinite(input[k])||input[k]<0),...TEXTS.filter(k=>typeof input?.[k]!=='string'||!input[k].trim())];
  if(missing.length)throw new Error('Faltan datos o no son válidos: '+missing.join(', ')+'. Pregúntalos al dueño o mídelos; no los estimes tú.');
  for(const k of PERCENTS)percent(k,input[k]);
  if(!input.llamadas_mes)throw new Error('llamadas_mes debe ser mayor que cero. Si el dueño no lo sabe, mide una semana.');
  if(!input.valor_cita||!input.margen_pct)throw new Error('valor_cita y margen_pct deben ser mayores que cero: sin ellos no se puede calcular cuántas citas pagan el agente.');
  // El precio es opcional la primera vez: la cotización usa el volumen de esta valoración.
  const priced=input.mensualidad!==undefined||input.implementacion!==undefined;
  if(priced)for(const k of ['mensualidad','implementacion'])if(typeof input[k]!=='number'||!Number.isFinite(input[k])||input[k]<0)throw new Error(k+': falta. Usa las dos cifras de la cotización, en '+input.moneda+'.');
  if(priced&&!input.mensualidad)throw new Error('mensualidad debe ser mayor que cero. Si aún no cotizas, quita mensualidad e implementacion.');
  if(input.recuperable_pct?.length&&!priced)throw new Error('recuperable_pct necesita mensualidad e implementacion.');
  const llamadasPerdidas=input.llamadas_mes*input.perdidas_pct/100,citasPerdidas=llamadasPerdidas*input.conversion_pct/100;
  const margenPorCita=input.valor_cita*input.margen_pct/100,citasParaCubrir=priced?Math.ceil(input.mensualidad/margenPorCita):null;
  const escenarios=(input.recuperable_pct??[]).map(pct=>{
    if(typeof pct!=='number'||pct<0)throw new Error('recuperable_pct: lista de porcentajes entre 0 y 100.');
    percent('recuperable_pct',pct);
    const citas=citasPerdidas*pct/100,margen=citas*margenPorCita,neto=margen-input.mensualidad;
    return {pct,citas,margen,neto,roi:neto/input.mensualidad,mesesRecuperacion:neto>0?input.implementacion/neto:null};
  });
  return {priced,llamadasPerdidas,citasPerdidas,ingresoPerdido:citasPerdidas*input.valor_cita,margenPerdido:citasPerdidas*margenPorCita,margenPorCita,citasParaCubrir,partePerdidas:priced&&citasPerdidas?citasParaCubrir/citasPerdidas:null,escenarios};
}
export function valuationMarkdown(input){
  const r=computeValuation(input),m=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:input.moneda,currencyDisplay:'code',maximumFractionDigits:0}).format(v),n=v=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(v);
  return `# Valoración antes de vender · ${input.negocio}

Origen de las cifras: ${input.fuente}

## Lo que dijo el negocio

| Dato | Valor |
|---|---|
| Llamadas al mes | ${n(input.llamadas_mes)} |
| Llamadas que no se contestan | ${n(input.perdidas_pct)}% |
| Llamadas contestadas que terminan en cita | ${n(input.conversion_pct)}% |
| Valor de una cita | ${m(input.valor_cita)} |
| Margen bruto de una cita | ${n(input.margen_pct)}% |

## Lo que representan las llamadas perdidas

- Llamadas perdidas al mes: ${n(r.llamadasPerdidas)}.
- Citas que podrían representar: ${n(r.citasPerdidas)}.
- Ingreso que representan: ${m(r.ingresoPerdido)} al mes. Margen: ${m(r.margenPerdido)}.

Es un techo, no lo que se va a recuperar: incluye a quien vuelve a llamar, a quien no quería una cita y citas para las que quizá no hay cupo.

${r.priced?`## Cuántas citas pagan el agente

Con una mensualidad de ${m(input.mensualidad)}, hacen falta **${r.citasParaCubrir} ${r.citasParaCubrir===1?'cita recuperada':'citas recuperadas'} al mes** para cubrirla.${r.partePerdidas===null?'':' Equivale al '+n(r.partePerdidas*100)+'% de las citas perdidas estimadas.'}`:'## Falta la cotización\n\nCalcula la mensualidad y la implementación, agrégalas a este archivo en la misma moneda y vuelve a ejecutar el comando para ver cuántas citas pagan el agente.'}
${r.escenarios.length?`
## Escenarios

El porcentaje recuperable es un supuesto, no una medición: nadie lo sabe hasta correr un piloto.

| Citas perdidas que se recuperan | Citas al mes | Margen recuperado | Neto al mes | ROI mensual | Meses para recuperar la implementación |
|---|---|---|---|---|---|
${r.escenarios.map(e=>`| ${n(e.pct)}% | ${n(e.citas)} | ${m(e.margen)} | ${m(e.neto)} | ${e.roi===null?'—':n(e.roi*100)+'%'} | ${e.mesesRecuperacion===null?'No se recupera':n(e.mesesRecuperacion)} |`).join('\n')}
`:''}
## Cómo leer esto

Es una estimación con las cifras de arriba. No es una promesa de ingresos ni de ahorro: no todas las llamadas perdidas son clientes nuevos y no toda persona quiere hablar con un agente. Valídalo con un piloto y compara contra el mismo periodo.
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=args(process.argv.slice(2));
    if(!opts.input||opts.help)throw new Error('Usa: node tools/valorar.mjs --input valoracion.json [--out valoracion.md]\nCampos: '+[...TEXTS,...NUMBERS].join(', ')+'. Opcionales: mensualidad, implementacion, recuperable_pct');
    const text=valuationMarkdown(JSON.parse(fs.readFileSync(path.resolve(opts.input),'utf8')));
    if(opts.out){fs.writeFileSync(path.resolve(opts.out),text);console.log('Valoración: '+path.resolve(opts.out));}else console.log(text);
  }catch(e){console.error(e.message);process.exitCode=1;}
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args } from './shared.mjs';

// Misma fórmula que materials/business/calculadora.html. Una prueba comprueba que coinciden.
const NUMBERS=['conversaciones','minutos_por_conversacion','costo_voz_minuto','costo_modelo_minuto','costo_telefonia_minuto','fijos','variables','horas_operacion','costo_hora','contingencia_pct','margen_pct','implementacion'];
const TEXTS=['cliente','moneda','fuente_costos'];
export function computeQuote(input){
  const missing=[...NUMBERS.filter(k=>typeof input?.[k]!=='number'||!Number.isFinite(input[k])||input[k]<0),...TEXTS.filter(k=>typeof input?.[k]!=='string'||!input[k].trim())];
  if(missing.length)throw new Error('Faltan datos o no son válidos: '+missing.join(', ')+'. Pídelos al usuario; no los supongas.');
  if(input.margen_pct>95)throw new Error('margen_pct debe estar entre 0 y 95.');
  const minutos=input.conversaciones*input.minutos_por_conversacion,costoMinuto=input.costo_voz_minuto+input.costo_modelo_minuto+input.costo_telefonia_minuto;
  const lineas={voz:minutos*input.costo_voz_minuto,modelo:minutos*input.costo_modelo_minuto,telefonia:minutos*input.costo_telefonia_minuto,fijos:input.fijos,variables:input.variables,operacion:input.horas_operacion*input.costo_hora};
  const subtotal=Object.values(lineas).reduce((a,b)=>a+b,0),contingencia=subtotal*input.contingencia_pct/100,costo=subtotal+contingencia;
  const factor=1-input.margen_pct/100,mensualidad=costo/factor;
  return {minutos,costoMinuto,lineas,subtotal,contingencia,costo,mensualidad,margen:mensualidad-costo,minutoExcedente:costoMinuto*(1+input.contingencia_pct/100)/factor,costoPorConversacion:input.conversaciones?costo/input.conversaciones:null,implementacion:input.implementacion};
}
export function quoteMarkdown(input){
  const r=computeQuote(input),m=v=>new Intl.NumberFormat('es-MX',{style:'currency',currency:input.moneda,currencyDisplay:'code'}).format(v),l=r.lineas;
  return `# Cotización de agente de voz · ${input.cliente}

## Para el cliente

| Concepto | Importe |
|---|---|
| Implementación, pago único | ${m(r.implementacion)} |
| Mensualidad | ${m(r.mensualidad)} |
| Minutos incluidos al mes | ${new Intl.NumberFormat('es-MX').format(r.minutos)} |
| Minuto adicional | ${m(r.minutoExcedente)} |

Calculado para ${new Intl.NumberFormat('es-MX').format(input.conversaciones)} conversaciones de ${input.minutos_por_conversacion} minutos en promedio. No incluye impuestos. Si el volumen real cambia, la mensualidad se revisa.

## Interno: no compartir con el cliente

Origen de las tarifas: ${input.fuente_costos}

| Costo mensual | Cálculo | Importe |
|---|---|---|
| Voz | ${r.minutos} min × ${m(input.costo_voz_minuto)} | ${m(l.voz)} |
| Modelo | ${r.minutos} min × ${m(input.costo_modelo_minuto)} | ${m(l.modelo)} |
| Telefonía | ${r.minutos} min × ${m(input.costo_telefonia_minuto)} | ${m(l.telefonia)} |
| Fijos | Infraestructura, CRM y otros | ${m(l.fijos)} |
| Variables | Verificación, mensajes y otros | ${m(l.variables)} |
| Operación | ${input.horas_operacion} h × ${m(input.costo_hora)} | ${m(l.operacion)} |
| Contingencia | ${input.contingencia_pct}% | ${m(r.contingencia)} |
| **Costo total** | | **${m(r.costo)}** |

- Costo de proveedores por minuto: ${m(r.costoMinuto)}.
- Margen bruto objetivo: ${input.margen_pct}%, equivalente a ${m(r.margen)} al mes.
${r.costoPorConversacion===null?'- Sin conversaciones: los costos fijos y de operación siguen existiendo.':'- Costo por conversación: '+m(r.costoPorConversacion)+'.'}

Comprueba las tarifas de cada proveedor antes de enviar. Esta cifra es una estimación con los datos capturados, no una tarifa oficial de ningún proveedor.
`;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=args(process.argv.slice(2));
    if(!opts.input||opts.help)throw new Error('Usa: node tools/cotizar.mjs --input cotizacion.json [--out cotizacion.md]\nCampos: '+[...TEXTS,...NUMBERS].join(', '));
    const text=quoteMarkdown(JSON.parse(fs.readFileSync(path.resolve(opts.input),'utf8')));
    if(opts.out){fs.writeFileSync(path.resolve(opts.out),text);console.log('Cotización: '+path.resolve(opts.out));}else console.log(text);
  }catch(e){console.error(e.message);process.exitCode=1;}
}

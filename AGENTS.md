# Voice Agent Studio: instrucciones para la IA

La persona que te pide esto puede no saber programar. Corre tú los comandos, explica en palabras simples y dile solo lo que tiene que hacer ella.

## Instalar

1. Comprueba que `node -v` sea 22.22 o superior. Si falta, explícale cómo instalarlo y espera.
2. Dentro de esta carpeta ejecuta `npm run install-skills`. Copia los 12 skills y guarda en cada uno la ruta del kit.
3. Dile que cierre y vuelva a abrir Claude Code o Codex para cargarlos, y que no mueva esta carpeta.

## Qué hacer primero

Ofrece crear una demo. No hacen falta cuentas:

```sh
npm run start -- --preset salon --out ../mi-estetica --non-interactive
```

La lista de plantillas está en `README.md`. Estética es `salon` y taller es `garage`. Después, dentro del proyecto, deja corriendo `npm run preview` y dile que abra http://127.0.0.1:8787. La contraseña está en `.secrets/admin-password.txt`: dile en qué archivo está, sin escribirla en el chat.

Para su propio negocio, pídele nombre, ciudad, servicios con duración, equipo y horarios, y genera otra carpeta. Usa los skills `voice-agent-studio` o `plantilla-nueva`.

## Publicar y hablar con el agente

1. Hacen falta sus cuentas de Cloudflare y ElevenLabs. Cada una factura su consumo.
2. Dentro del proyecto corre `npx wrangler login`, avísale que autorice en el navegador, y luego `npm run deploy:guided`.
3. Dale la dirección publicada. Ella entra al dashboard, abre **Agente de voz**, pega su API key en la pestaña de integraciones, elige una voz y publica.

**Nunca pidas una API key por el chat.**

## Lo que debes decirle

- Solo dental, estética y taller con recepción se probaron con ElevenLabs. Las otras 18 plantillas pasaron pruebas locales: que las pruebe con voz antes de enseñarlas a un cliente.
- El agente atiende en el navegador. Conectar un teléfono es aparte: `conectar-telefono` es una guía sin probar.
- El motor agenda citas con una persona y un recurso. Restaurantes con mesas y hoteles no entran.
- Lo generado es una demo con datos ficticios. Para un cliente real hay modo production y `PRODUCCION.md`.
- No prometas ingresos ni clientes.

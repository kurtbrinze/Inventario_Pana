# Lector de fotos (Cloudflare Worker)

La app no habla con la API de Anthropic directamente: manda la foto a un worker tuyo, y ese
worker guarda la llave. **La llave nunca llega al navegador ni queda en la tablet.**

```
tablet / laptop  ──foto──>  tu worker  ──foto + llave──>  API de Anthropic
                 <─números──            <─números──
```

El plan gratuito de Cloudflare da 100,000 peticiones al día. Una toma de inventario es una
petición, así que el worker no te va a costar nada. Lo que sí se cobra es el consumo de la API
de Anthropic, por tu cuenta aparte.

---

## 1. Crear la llave de la API

En <https://console.anthropic.com> → **API Keys** → **Create Key**. Cópiala; solo se muestra
una vez. Necesitas saldo en la cuenta para que funcione.

## 2. Desplegar el worker

Con Node instalado, desde la carpeta `worker/` del repositorio:

```bash
npx wrangler login       # abre el navegador para entrar a tu cuenta de Cloudflare
npx wrangler deploy
```

Al terminar imprime la dirección, algo como:

```
https://inventario-pana-ocr.TU-CUENTA.workers.dev
```

Guárdala, la vas a pegar en la app.

## 3. Cargar la llave como secret

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Pega la llave cuando la pida. Queda cifrada del lado de Cloudflare: no aparece en el
repositorio, ni en `wrangler.toml`, ni en el navegador.

## 4. Conectar la app

Abre la app, pestaña **Foto → Excel**, despliega **Ajustes del lector** y pega la dirección del
paso 2. Se guarda en ese dispositivo; hay que hacerlo una vez por tablet o computadora.

Para comprobar que quedó bien, abre la dirección del worker en el navegador: debe responder

```json
{"ok":true,"servicio":"inventario-pana-ocr","modelo":"claude-opus-5"}
```

---

## Ajustes en `wrangler.toml`

| Variable | Para qué |
|---|---|
| `ALLOWED_ORIGINS` | Qué sitios pueden usar tu worker. Ya trae `https://kurtbrinze.github.io`. Separa varios con coma. Si lo dejas vacío, cualquiera que sepa la dirección puede gastar tu saldo. |
| `MODEL` | Modelo de visión. `claude-opus-5` es el más preciso con letra manuscrita. `claude-sonnet-5-5` cuesta menos. |

Después de cambiar algo, vuelve a correr `npx wrangler deploy`.

## Si quieres probar en tu computadora antes de publicar

```bash
npx wrangler dev
```

Levanta el worker en `http://localhost:8787`. Agrega `http://localhost:8765` (o el puerto donde
sirvas la app) a `ALLOWED_ORIGINS` mientras pruebas.

---

## Qué hace el worker

- Recibe la foto en base64 y la manda a la API con instrucciones estrictas: copiar **solo la
  columna TOTAL**, ignorar DETALLE/CONTEO, no sumar ni corregir nada, y marcar como dudosa
  cualquier clave que no se distinga.
- Devuelve las claves exactamente en el orden de la hoja de papel. Si el modelo inventa una
  clave que no existe, el worker la descarta y la reporta aparte.
- Rechaza llamadas de orígenes no autorizados y traduce los errores de la API a un mensaje en
  español que la app muestra tal cual.

## Errores comunes

| Lo que ves | Qué pasó |
|---|---|
| `Origen no autorizado` | Falta tu dominio en `ALLOWED_ORIGINS`. |
| `Falta el secret ANTHROPIC_API_KEY` | No corriste el paso 3. |
| `La API respondió 400: credit balance too low` | Sin saldo en la cuenta de Anthropic. |
| `El modelo no devolvió JSON válido` | Foto muy borrosa o cortada. Repite la foto con la hoja completa y plana. |
| `Failed to fetch` en la app | La dirección del lector está mal escrita, o el worker no está desplegado. |

## Lo que cuesta

Cada lectura manda una foto reducida a 2000 px. Con `claude-opus-5` ronda los centavos de dólar
por toma de inventario. Si lo vas a correr varias veces al día y quieres bajar el gasto, cambia
`MODEL` a `claude-sonnet-5-5` y compara unos días contra la hoja antes de dejarlo fijo.

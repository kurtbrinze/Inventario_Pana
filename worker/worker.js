/**
 * Worker que lee la foto del inventario y devuelve CLAVE → TOTAL.
 *
 * La llave de Anthropic vive aquí, como secret de Cloudflare, y nunca llega al
 * navegador. La app solo manda la imagen y recibe los números.
 *
 * Despliegue y pruebas: ver WORKER.md
 */

const PAN_BLANCO = [
  '12BLL', '10FP8', '10HD7', '5HC1', '5HD2', '10HD6', '5HD8', '5HE8', '5HG7', '5HM4',
  '10HM5', '10HR3', '20MA1', 'MA3', '16PA1', '6PC4', '15PL1', 'PL1U', '15PL1U', '8PL1',
  'PL1T', '10PM3', 'S11T', 'S11', 'S16', 'S19', 'S25', 'S26', 'S32', '12WY1',
  '12WYK', 'SE2', '5ST2', '12WYK+P', '12PB2', '6HD12', '10WY1M', '10WY1G', 'IN16', 'CZ3',
  'CZ5', '10CZ4',
];

const PASTEL = [
  'almohada', 'brazo', 'bola berlin', 'bombom', 'borracho', 'relampago', 'corbata',
  'cartucho', 'casita', 'cuadro', 'dona', 'empanada', 'gaznate', 'marquesote', 'milhoja',
  'pañuelo', 'parrilla', 'pio', 'pie', 'tartaleta', 'MG1', 'MGN', 'MG4', '6CG2N', '6CG2V',
  '6CHO', '6QU1', '12QU1', '10CH2', 'EN1', 'ES1', 'ES2', 'PS4', '5CHD', '10CHD', 'EN4',
  '10EN4', 'ME4', 'MR1', '10MR1', 'MASC', 'MA5M', 'SE5', 'RY5', 'RY1',
];

const SYSTEM = `Eres un transcriptor de hojas de inventario de panadería. Tu única tarea es copiar números manuscritos con exactitud literal. Un número mal copiado hace que la panadería produzca de más o de menos, así que ante la duda marcas la clave como dudosa en lugar de adivinar.`;

function userPrompt() {
  return `Esta foto es una hoja "STOCK DE PRODUCTO TERMINADO" con dos tablas lado a lado.

IZQUIERDA (PAN BLANCO), filas en este orden exacto:
${PAN_BLANCO.join(', ')}

DERECHA (PASTEL Y MASAS DULCES), filas en este orden exacto:
${PASTEL.join(', ')}

Cada tabla tiene tres columnas: CLAVE (impresa), DETALLE / CONTEO (sumas a mano) y TOTAL.

Reglas, en orden de importancia:

1. Copia ÚNICAMENTE la columna TOTAL, la de más a la derecha de cada tabla. IGNORA por completo la columna DETALLE / CONTEO: sus sumas no van al resultado.
2. Si la celda TOTAL de una clave está vacía, su valor es null. No la rellenes con el detalle ni con el total de otra fila, aunque el detalle tenga un número.
3. La letra se escribe un poco más abajo de la línea impresa. Asigna cada TOTAL a la clave cuya fila lo contiene, siguiendo el orden de arriba hacia abajo. Verifica que no se te corra una fila: cuenta las filas desde la primera clave.
4. Un número tachado no cuenta; usa el que lo corrige, y si no hay corrección pon null.
5. No calcules nada. No sumes, no multipliques, no corrijas lo que parezca inconsistente. Copia lo escrito.
6. Si un dígito no se distingue con seguridad, pon tu mejor lectura y agrega la clave a "dudosas".

Lee también la fecha escrita arriba a la derecha junto a "FECHA:" y devuélvela como AAAA-MM-DD. Está en formato DD/MM/AA.

Responde SOLO con un objeto JSON, sin texto antes ni después, con esta forma:

{"fecha":"AAAA-MM-DD","pan_blanco":{"CLAVE":numero_o_null},"pastel":{"CLAVE":numero_o_null},"dudosas":["CLAVE"]}

Incluye TODAS las claves de ambas listas, en el mismo orden, aunque su valor sea null.`;
}

function corsHeaders(origin, allowed) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Saca el objeto JSON de la respuesta aunque venga envuelto en ``` o en texto. */
function parseModelJson(text) {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fence && fence[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const a = c.indexOf('{');
    const b = c.lastIndexOf('}');
    if (a < 0 || b <= a) continue;
    try {
      return JSON.parse(c.slice(a, b + 1));
    } catch (_) { /* sigue con el siguiente candidato */ }
  }
  return null;
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[\s,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Deja exactamente las claves de la plantilla, en su orden, con número o null. */
function normalize(section, claves) {
  const src = section && typeof section === 'object' ? section : {};
  const lower = new Map(Object.keys(src).map((k) => [k.trim().toUpperCase(), src[k]]));
  const out = {};
  for (const c of claves) out[c] = toNumber(lower.get(c.toUpperCase()));
  const extras = [...lower.keys()].filter((k) => !claves.some((c) => c.toUpperCase() === k));
  return { out, extras };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') {
      return json({ ok: true, servicio: 'inventario-pana-ocr', modelo: env.MODEL || 'claude-opus-5' }, 200, cors);
    }
    if (request.method !== 'POST') return json({ error: 'Usa POST.' }, 405, cors);
    if (allowed.length && !allowed.includes(origin)) {
      return json({ error: `Origen no autorizado: ${origin || '(ninguno)'}. Agrégalo a ALLOWED_ORIGINS.` }, 403, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Falta el secret ANTHROPIC_API_KEY en el worker.' }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: 'El cuerpo debe ser JSON.' }, 400, cors);
    }

    const image = String(body.image_base64 || '').replace(/^data:[^,]+,/, '');
    const mediaType = String(body.media_type || 'image/jpeg');
    if (!image) return json({ error: 'Falta image_base64.' }, 400, cors);
    if (image.length > 7_000_000) {
      return json({ error: 'La imagen pesa demasiado. La app debe reducirla antes de enviarla.' }, 413, cors);
    }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
      return json({ error: `Tipo de imagen no admitido: ${mediaType}` }, 400, cors);
    }

    let upstream;
    try {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: env.MODEL || 'claude-opus-5',
          max_tokens: 4096,
          temperature: 0,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: userPrompt() },
            ],
          }],
        }),
      });
    } catch (err) {
      return json({ error: 'No se pudo contactar a la API: ' + err.message }, 502, cors);
    }

    const raw = await upstream.text();
    if (!upstream.ok) {
      let detalle = raw.slice(0, 400);
      try { detalle = JSON.parse(raw).error?.message || detalle; } catch (_) { /* texto plano */ }
      return json({ error: `La API respondió ${upstream.status}: ${detalle}` }, 502, cors);
    }

    let payload;
    try { payload = JSON.parse(raw); } catch (_) {
      return json({ error: 'La API devolvió una respuesta ilegible.' }, 502, cors);
    }

    const text = (payload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const data = parseModelJson(text);
    if (!data) {
      return json({ error: 'El modelo no devolvió JSON válido.', crudo: text.slice(0, 800) }, 502, cors);
    }

    const pb = normalize(data.pan_blanco, PAN_BLANCO);
    const pd = normalize(data.pastel, PASTEL);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(data.fecha || '')) ? data.fecha : null;

    return json({
      fecha,
      pan_blanco: pb.out,
      pastel: pd.out,
      dudosas: Array.isArray(data.dudosas) ? data.dudosas.map(String) : [],
      fuera_de_plantilla: [...pb.extras, ...pd.extras],
      modelo: payload.model || env.MODEL,
      uso: payload.usage || null,
    }, 200, cors);
  },
};

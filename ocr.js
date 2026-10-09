/* Sección "Leer foto": toma la imagen, la manda al worker y arma el Excel
   del inventario con el mismo formato del archivo que ya se usa.
   Solo se escribe la columna TOTAL; DETALLE/CONTEO se descarta. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const PAN_BLANCO = ['12BLL','10FP8','10HD7','5HC1','5HD2','10HD6','5HD8','5HE8','5HG7','5HM4',
    '10HM5','10HR3','20MA1','MA3','16PA1','6PC4','15PL1','PL1U','15PL1U','8PL1','PL1T','10PM3',
    'S11T','S11','S16','S19','S25','S26','S32','12WY1','12WYK','SE2','5ST2','12WYK+P','12PB2',
    '6HD12','10WY1M','10WY1G','IN16','CZ3','CZ5','10CZ4'];
  const PASTEL = ['almohada','brazo','bola berlin','bombom','borracho','relampago','corbata',
    'cartucho','casita','cuadro','dona','empanada','gaznate','marquesote','milhoja','pañuelo',
    'parrilla','pio','pie','tartaleta','MG1','MGN','MG4','6CG2N','6CG2V','6CHO','6QU1','12QU1',
    '10CH2','EN1','ES1','ES2','PS4','5CHD','10CHD','EN4','10EN4','ME4','MR1','10MR1','MASC',
    'MA5M','SE5','RY5','RY1'];
  const HOJAS = [
    { nombre: 'PAN BLANCO', claves: PAN_BLANCO, key: 'pan_blanco' },
    { nombre: 'PASTEL Y MASAS DULCES', claves: PASTEL, key: 'pastel' },
  ];

  const st = { file: null, dataUrl: null, b64: null, mime: null, fecha: null,
    vals: { pan_blanco: {}, pastel: {} }, dudosas: new Set(), leido: false, blob: null };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(/[\s,]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };
  const fmt = (n) => (n == null ? '' : Number(n).toLocaleString('es-GT'));

  // ---------- ajustes ----------
  const cfgGet = (k, d = '') => { try { return localStorage.getItem('inventario_ia_' + k) ?? d; } catch (_) { return d; } };
  const cfgSet = (k, v) => { try { localStorage.setItem('inventario_ia_' + k, v); } catch (_) {} };
  const modo = () => cfgGet('modo', '');
  const MODELO_DEF = 'claude-opus-5';

  // ---------- instrucciones para el lector ----------
  const SYSTEM = 'Eres un transcriptor de hojas de inventario de panadería. Tu única tarea es copiar números manuscritos con exactitud literal. Un número mal copiado hace que la panadería produzca de más o de menos, así que ante la duda marcas la clave como dudosa en lugar de adivinar.';

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

  /* Saca el objeto JSON aunque venga envuelto en ``` o con texto alrededor. */
  function parseJson(texto) {
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
    for (const c of [fence && fence[1], texto]) {
      if (!c) continue;
      const a = c.indexOf('{'), b = c.lastIndexOf('}');
      if (a < 0 || b <= a) continue;
      try { return JSON.parse(c.slice(a, b + 1)); } catch (_) {}
    }
    return null;
  }

  // ---------- imagen ----------
  /* Reduce la foto antes de enviarla: la letra sigue legible y el envío no se cae
     en una conexión de tablet. */
  function reducir(file, maxLado = 2000, calidad = 0.85) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const esc2 = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.round(img.width * esc2), h = Math.round(img.height * esc2);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL('image/jpeg', calidad);
        resolve({ dataUrl, b64: dataUrl.split(',')[1], mime: 'image/jpeg', w, h });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')); };
      img.src = url;
    });
  }

  // ---------- generación del .xlsx ----------
  const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const WBRELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const WB = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="PAN BLANCO" sheetId="1" r:id="rId1"/><sheet name="PASTEL Y MASAS DULCES" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;

  /* Estilos copiados del archivo que ya usan: título 1F4E78, encabezado blanco
     sobre 2F5496, línea fina por fila y fila de total gris con doble raya. */
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="14"/><color rgb="FF1F4E78"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font><font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F5496"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD6DCE4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="double"><color rgb="FF8EA9DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf><xf numFmtId="3" fontId="3" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  function hojaXml(titulo, claves, valores) {
    const first = 4, last = first + claves.length - 1, totalRow = last + 1;
    const filas = [];
    filas.push(`<row r="1" spans="1:2" ht="20" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>${esc(titulo)}</t></is></c><c r="B1" s="1"/></row>`);
    filas.push(`<row r="3" spans="1:2"><c r="A3" s="2" t="inlineStr"><is><t>CLAVE</t></is></c><c r="B3" s="2" t="inlineStr"><is><t>TOTAL</t></is></c></row>`);
    claves.forEach((clave, i) => {
      const r = first + i;
      const v = valores[clave];
      const celdaB = v == null ? `<c r="B${r}" s="4"/>` : `<c r="B${r}" s="4"><v>${v}</v></c>`;
      filas.push(`<row r="${r}" spans="1:2"><c r="A${r}" s="3" t="inlineStr"><is><t>${esc(clave)}</t></is></c>${celdaB}</row>`);
    });
    filas.push(`<row r="${totalRow}" spans="1:2"><c r="A${totalRow}" s="5" t="inlineStr"><is><t>TOTAL GENERAL</t></is></c><c r="B${totalRow}" s="6"><f>SUM(B${first}:B${last})</f></c></row>`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${totalRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="B4" sqref="B4"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="25" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/></cols><sheetData>${filas.join('')}</sheetData><mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
  }

  function ddmmaaaa(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  async function construirXlsx() {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CT);
    zip.folder('_rels').file('.rels', RELS);
    const xl = zip.folder('xl');
    xl.file('workbook.xml', WB);
    xl.file('styles.xml', STYLES);
    xl.folder('_rels').file('workbook.xml.rels', WBRELS);
    const ws = xl.folder('worksheets');
    HOJAS.forEach((h, i) => {
      const titulo = `INVENTARIO - ${h.nombre} (${ddmmaaaa(st.fecha)})`;
      ws.file(`sheet${i + 1}.xml`, hojaXml(titulo, h.claves, st.vals[h.key]));
    });
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: MIME });
  }

  const nombreArchivo = () => (st.fecha ? st.fecha.replace(/-/g, '_') : 'SIN_FECHA') + '_Inventario.xlsx';

  // ---------- interfaz ----------
  function pintarFoto() {
    const box = $('#fotoPrev');
    $('#verFoto').hidden = !st.dataUrl;
    if (!st.dataUrl) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<img src="${st.dataUrl}" alt="Foto del inventario">`;
    $('#fotoFullImg').src = st.dataUrl;
  }

  /* Visor a tamaño completo: sirve para cotejar un número sin perder la tabla. */
  function verFoto(on) {
    const v = $('#fotoFull');
    v.classList.toggle('show', on);
    document.body.style.overflow = on ? 'hidden' : '';
    if (on) v.scrollTop = 0;
  }

  function pintar() {
    $('#leerBtn').disabled = !st.b64;
    $('#ocrRev').hidden = !st.leido;
    $('#guardarOcr').disabled = !st.leido;
    $('#pasarBtn').hidden = !st.leido;
    if (!st.leido) return;

    const malos = [];
    let totalGeneral = 0, conDato = 0;
    const tablas = HOJAS.map((h) => {
      let suma = 0, n = 0;
      const filas = h.claves.map((clave) => {
        const v = st.vals[h.key][clave];
        const bad = Number.isNaN(v);
        if (bad) malos.push(clave);
        if (!bad && v != null) { suma += v; n++; }
        const dud = st.dudosas.has(clave);
        const val = bad ? st.vals[h.key][clave + '__raw'] ?? '' : (v == null ? '' : v);
        return `<tr${dud ? ' class="dud"' : ''}><td class="k">${esc(clave)}${dud ? '<span class="pill">revisar</span>' : ''}</td>`
          + `<td class="v"><input class="ocrIn${bad ? ' bad' : ''}" inputmode="decimal" enterkeyhint="next" data-h="${h.key}" data-c="${esc(clave)}" value="${esc(val)}" aria-label="TOTAL de ${esc(clave)}"></td></tr>`;
      }).join('');
      suma = Math.round(suma); totalGeneral += suma; conDato += n;
      return `<div class="half"><h3>${esc(h.nombre)}<span>${n} con dato · ${fmt(suma)}</span></h3>`
        + `<div class="tablebox"><table><tbody>${filas}</tbody></table></div></div>`;
    }).join('');

    $('#ocrTablas').innerHTML = tablas;
    $('#ocrSum').innerHTML =
      `<span class="stat"><b>${conDato}</b>claves con dato</span>`
      + `<span class="stat"><b>${fmt(totalGeneral)}</b>unidades en total</span>`
      + (st.dudosas.size ? `<span class="stat warn"><b>${st.dudosas.size}</b>por revisar</span>` : '')
      + (malos.length ? `<span class="stat warn"><b>${malos.length}</b>no son número</span>` : '');

    const avisos = [];
    avisos.push(`<div class="notice"><h3>Revisa contra la foto antes de guardar</h3>Un número mal leído se convierte en producción de más o de menos. Las filas marcadas <b>revisar</b> son las que el lector no vio con claridad.</div>`);
    if (st.dudosas.size) {
      avisos.push(`<div class="notice"><h3>Claves marcadas por el lector</h3><ul>${[...st.dudosas].map((c) => `<li><b>${esc(c)}</b></li>`).join('')}</ul></div>`);
    }
    if (malos.length) {
      avisos.push(`<div class="notice err"><h3>Hay valores que no son número</h3>Corrige ${malos.map((c) => `<b>${esc(c)}</b>`).join(', ')} antes de guardar.</div>`);
    }
    $('#ocrAvisos').innerHTML = avisos.join('');
    $('#fechaIn').value = st.fecha || '';
    $('#nombreOut').textContent = nombreArchivo();
  }

  // ---------- acciones ----------
  async function elegir(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { window.appSay('Eso no es una imagen.', 'err'); return; }
    window.appBusy(true, 'Preparando la foto…');
    try {
      const r = await reducir(file);
      st.file = file; st.dataUrl = r.dataUrl; st.b64 = r.b64; st.mime = r.mime;
      st.leido = false; st.blob = null;
      pintarFoto(); pintar();
      window.appSay(`Foto lista (${r.w}×${r.h}). Toca "Leer la foto".`);
    } catch (err) {
      window.appSay(err.message, 'err');
    } finally { window.appBusy(false); }
  }

  /* Modo servidor: la llave vive en el servidor, la app solo manda la foto. */
  async function viaServidor() {
    const url = cfgGet('url').trim();
    if (!url) throw new Error('Falta la dirección del lector. Ábrela en Ajustes.');
    const res = await fetch(url.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: st.b64, media_type: st.mime }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `El lector respondió ${res.status}.`);
    return data;
  }

  /* Modo llave: la app llama a la API directamente con la llave de este dispositivo. */
  async function viaLlave() {
    const key = cfgGet('key').trim();
    if (!key) throw new Error('Falta la llave. Pégala en Ajustes.');
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfgGet('modelo', MODELO_DEF),
          max_tokens: 4096,
          system: SYSTEM,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: st.mime, data: st.b64 } },
              { type: 'text', text: userPrompt() },
            ],
          }],
        }),
      });
    } catch (err) {
      throw new Error('No se pudo contactar a la API desde el navegador. Revisa la señal; si el problema sigue, usa el modo servidor. (' + err.message + ')');
    }
    const crudo = await res.text();
    if (!res.ok) {
      let detalle = crudo.slice(0, 300);
      try { detalle = JSON.parse(crudo).error?.message || detalle; } catch (_) {}
      if (res.status === 401) detalle = 'La llave no es válida o fue revocada.';
      if (res.status === 429) detalle = 'Demasiadas peticiones o sin saldo. Revisa tu cuenta.';
      throw new Error(`La API respondió ${res.status}: ${detalle}`);
    }
    const payload = JSON.parse(crudo);
    const texto = (payload.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const data = parseJson(texto);
    if (!data) throw new Error('El lector no devolvió datos legibles. Repite la foto con la hoja completa y plana.');
    return data;
  }

  async function leer() {
    if (!st.b64) return;
    if (!modo()) { window.appSay('Primero configura el lector en Ajustes.', 'err'); $('#ocrCfg').open = true; return; }
    window.appBusy(true, 'Leyendo la foto…');
    try {
      const data = modo() === 'llave' ? await viaLlave() : await viaServidor();
      st.fecha = (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) ? data.fecha : null;
      st.dudosas = new Set((data.dudosas || []).map(String));
      HOJAS.forEach((h) => {
        const src = data[h.key] || {};
        const dst = {};
        h.claves.forEach((c) => { const n = num(src[c]); dst[c] = n; });
        st.vals[h.key] = dst;
      });
      st.leido = true; st.blob = null;
      pintar();
      window.appSay(st.fecha ? `Listo. Fecha leída: ${ddmmaaaa(st.fecha)}.` : 'Listo, pero no se leyó la fecha. Escríbela abajo.');
      if (!st.fecha) $('#fechaIn').focus();
    } catch (err) {
      window.appSay('No se pudo leer: ' + err.message, 'err');
    } finally { window.appBusy(false); }
  }

  function hayMalos() {
    return HOJAS.some((h) => h.claves.some((c) => Number.isNaN(st.vals[h.key][c])));
  }

  async function obtenerBlob() {
    if (!st.blob) st.blob = await construirXlsx();
    return st.blob;
  }

  async function guardar() {
    if (document.activeElement && document.activeElement.matches('input.ocrIn')) document.activeElement.blur();
    if (hayMalos()) { window.appSay('Corrige los valores que no son número.', 'err'); return; }
    if (!st.fecha) { window.appSay('Falta la fecha del inventario.', 'err'); $('#fechaIn').focus(); return; }
    const nombre = nombreArchivo();
    let handle = null;
    if (window.showSaveFilePicker) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: nombre, types: [{ description: 'Libro de Excel', accept: { [MIME]: ['.xlsx'] } }] });
      } catch (err) { if (err.name === 'AbortError') return; handle = null; }
    }
    window.appBusy(true, 'Armando el Excel…');
    try {
      const blob = await obtenerBlob();
      if (handle) {
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        window.appSay(`Guardado ${nombre}.`);
      } else {
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = u; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 15000);
        window.appSay(`Descargado ${nombre}. Búscalo en Descargas.`);
      }
    } catch (err) {
      window.appSay('No se pudo guardar: ' + err.message, 'err');
    } finally { window.appBusy(false); }
  }

  async function pasarAlPaso2() {
    if (hayMalos()) { window.appSay('Corrige los valores que no son número.', 'err'); return; }
    if (!st.fecha) { window.appSay('Falta la fecha del inventario.', 'err'); $('#fechaIn').focus(); return; }
    window.appBusy(true, 'Pasando los datos…');
    try {
      const blob = await obtenerBlob();
      const file = new File([blob], nombreArchivo(), { type: MIME });
      await window.appCargarInventario(file);
      window.appTab('excel');
      window.appSay('Datos cargados. Ahora elige Calculo_Produccion_IA.xlsx.');
    } catch (err) {
      window.appSay('No se pudo pasar: ' + err.message, 'err');
    } finally { window.appBusy(false); }
  }

  // ---------- eventos ----------
  function pintarCfg() {
    const m = modo();
    $('#modoLlave').checked = m === 'llave';
    $('#modoServidor').checked = m === 'servidor';
    $('#camposLlave').hidden = m !== 'llave';
    $('#camposServidor').hidden = m !== 'servidor';
    $('#cfgEstado').textContent = m === 'llave'
      ? (cfgGet('key') ? 'Listo: llave guardada en este dispositivo.' : 'Falta pegar la llave.')
      : m === 'servidor'
        ? (cfgGet('url') ? 'Listo: usando ' + cfgGet('url') : 'Falta la dirección del lector.')
        : 'Sin configurar.';
  }

  /* Si la app se sirve desde un sitio que ya trae el lector incluido
     (por ejemplo un despliegue en Vercel), lo usa sin pedir nada. */
  async function autodetectar() {
    if (modo()) return;
    try {
      const r = await fetch('./api/extract', { method: 'GET' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.ok) {
        const u = new URL('./api/extract', location.href).href;
        cfgSet('modo', 'servidor'); cfgSet('url', u);
        $('#urlIn').value = u;
        pintarCfg();
        window.appSay('Lector detectado en este mismo sitio. No hay nada que configurar.');
      }
    } catch (_) { /* no hay lector aquí, se queda sin configurar */ }
  }

  function init() {
    $('#urlIn').value = cfgGet('url');
    $('#keyIn').value = cfgGet('key');
    $('#modeloIn').value = cfgGet('modelo', MODELO_DEF);
    pintarCfg();
    if (!modo()) $('#ocrCfg').open = true;

    $('#modoLlave').addEventListener('change', () => { cfgSet('modo', 'llave'); pintarCfg(); });
    $('#modoServidor').addEventListener('change', () => { cfgSet('modo', 'servidor'); pintarCfg(); });
    $('#urlIn').addEventListener('change', (e) => { cfgSet('url', e.target.value.trim()); pintarCfg(); window.appSay('Dirección guardada en este dispositivo.'); });
    $('#keyIn').addEventListener('change', (e) => { cfgSet('key', e.target.value.trim()); pintarCfg(); window.appSay('Llave guardada en este dispositivo.'); });
    $('#modeloIn').addEventListener('change', (e) => { cfgSet('modelo', e.target.value.trim() || MODELO_DEF); });
    $('#borrarKey').addEventListener('click', () => {
      cfgSet('key', ''); $('#keyIn').value = ''; pintarCfg(); window.appSay('Llave borrada de este dispositivo.');
    });
    autodetectar();

    $('#camBtn').onclick = () => $('#camIn').click();
    $('#galBtn').onclick = () => $('#galIn').click();
    for (const id of ['#camIn', '#galIn']) {
      $(id).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; elegir(f); };
    }
    const drop = $('#fotoSlot');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('drag');
      const f = [...e.dataTransfer.files].find((x) => /^image\//.test(x.type));
      if (f) elegir(f); else window.appSay('Arrastra una imagen.', 'err');
    });

    $('#verFoto').onclick = () => verFoto(true);
    $('#cerrarFoto').onclick = () => verFoto(false);
    $('#fotoFull').addEventListener('click', (e) => { if (e.target.id === 'fotoFull') verFoto(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') verFoto(false); });
    $('#fotoPrev').addEventListener('click', () => { if (st.dataUrl) verFoto(true); });

    $('#leerBtn').onclick = leer;
    $('#guardarOcr').onclick = guardar;
    $('#pasarBtn').onclick = pasarAlPaso2;
    $('#fechaIn').addEventListener('change', (e) => {
      st.fecha = /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : null;
      st.blob = null; $('#nombreOut').textContent = nombreArchivo();
    });
    $('#ocrTablas').addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('input.ocrIn')) return;
      const h = t.dataset.h, c = t.dataset.c, raw = t.value.trim();
      const n = num(raw);
      st.vals[h][c] = n;
      st.vals[h][c + '__raw'] = raw;
      st.blob = null;
      pintar();
    });
    $('#ocrTablas').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !e.target.matches('input.ocrIn')) return;
      e.preventDefault();
      const ins = [...document.querySelectorAll('input.ocrIn')];
      const next = ins[ins.indexOf(e.target) + 1];
      if (next) next.focus(); else e.target.blur();
    });
    pintar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

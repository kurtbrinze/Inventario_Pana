# Inventario a Cálculo de Producción

App web con dos pasos:

1. **Foto → Excel.** Lee la foto de la hoja "STOCK DE PRODUCTO TERMINADO" y arma el Excel del
   día (`AAAA_MM_DD_Inventario.xlsx`) con las pestañas PAN BLANCO y PASTEL Y MASAS DULCES.
2. **Excel → Cálculo.** Pasa ese Excel a la columna **IA** de la tabla `Toma_Inv` del libro
   `Calculo_Produccion_IA.xlsx`.

Los archivos de Excel se procesan en el dispositivo y nunca se suben a ningún lado. Lo único
que sale es la foto, y solo hacia el lector que tú conectes (ver [LECTOR.md](LECTOR.md)).

## Paso 1: foto → Excel

Toca **Tomar foto** o **Elegir imagen**, luego **Leer la foto**. La app muestra cada clave con
su TOTAL, editable, y marca en rojo las que el lector no vio con claridad. El botón **Ver foto**
abre la imagen a pantalla completa para cotejar sin perder la tabla.

Solo se lee la columna **TOTAL**. La columna DETALLE/CONTEO se ignora por completo.

Revisa siempre antes de guardar: un número mal leído se convierte en producción de más o de
menos. De ahí se puede **Guardar Excel** o pasar los datos directo al paso 2.

La primera vez hay que conectar el lector en **Ajustes del lector**: o pegas tu llave de la API
en el dispositivo (2 minutos, sin instalar nada), o apuntas a un servidor propio. Los dos
caminos están en [LECTOR.md](LECTOR.md).

## Paso 2: Excel → Cálculo

1. Elegir los dos archivos (el inventario del día y `Calculo_Produccion_IA.xlsx`). La app
   reconoce sola cuál es cuál.
2. Revisar la tabla: valor por pestaña, IA actual e IA nuevo, editable.
3. Guardar. En laptop se abre el diálogo para reemplazar el archivo; en tablet cae en Descargas.

Reglas que aplica:

- Clave repetida en las dos pestañas con el mismo número: se toma una sola vez.
- Números distintos entre pestañas: la app pide elegir antes de guardar.
- Clave sin dato: vacía la celda IA (se puede desactivar con la casilla de abajo).
- Celda IA con fórmula: no se toca.

Solo se modifica la hoja `TOMA_INVENTARIO`; tablas dinámicas, segmentaciones y formatos del
libro quedan intactos.

## Publicar en GitHub Pages

Subir el contenido de esta carpeta al repositorio y, en **Settings → Pages**, poner Source =
*Deploy from a branch*, Branch = `main`, carpeta `/ (root)`.

Las carpetas `api/` y `worker/` no estorban en Pages; solo se usan si montas el lector en un
servidor (ver [LECTOR.md](LECTOR.md)).

## Instalar en la tablet o el teléfono

La app trae un botón **Instalar app** arriba a la derecha. Si el navegador lo permite, abre el
instalador del sistema; si no, muestra los pasos para ese dispositivo. El botón desaparece solo
cuando la app ya está instalada.

## Estilo

La app usa el estilo Rinze Studio: tema oscuro sobre `#0A0E17`, superficies `#121824` y
`#1E293B`, acentos verde neón `#00FF88` y cian `#00D2FE` con degradado, íconos delineados de
24 px con trazo de 2 px, y el logo de nodos con el wordmark "Rinze STUDIO".

## Empezar de nuevo

El botón de arriba descarta la foto y los archivos cargados y deja la app limpia. Los ajustes
del lector (modo, llave o dirección) se conservan.

## Versión

Arriba a la derecha se ve la versión actual (`V.2`). Al publicar un cambio hay que subirla en
**dos lugares**, que deben coincidir:

1. `index.html` → `const APP_VERSION = 'V.2';`
2. `sw.js` → `const CACHE = 'inventario-ia-V.2';`

El número de `sw.js` es el que obliga a los dispositivos ya instalados a tomar la versión nueva.
Si no cambia, la tablet sigue abriendo la copia guardada aunque el archivo nuevo esté publicado.
El de `index.html` es el que se ve en pantalla, y sirve para confirmar de un vistazo qué versión
está corriendo cada equipo.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | La app completa, con JSZip incluido |
| `manifest.webmanifest` | Nombre, colores e íconos para instalarla |
| `sw.js` | Guarda la app para uso sin señal |
| `icon-192.png`, `icon-512.png`, `icon-maskable.png` | Íconos de la app (logo Rinze) |
| `ocr.js` | Fuente de la sección de foto (va embebida en `index.html`) |
| `api/extract.js` | El lector, para desplegar en Vercel sin terminal |
| `vercel.json` | Ajustes del despliegue en Vercel |
| `worker/worker.js` | El mismo lector, versión Cloudflare Workers |
| `LECTOR.md` | Cómo conectar el lector (los dos caminos) |
| `WORKER.md` | Camino de Cloudflare, para quien use terminal |
| `.nojekyll` | Evita el procesamiento Jekyll de GitHub Pages |

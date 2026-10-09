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

## Instalar en la tablet Android

Abrir la dirección en Chrome, menú de tres puntos, **Instalar aplicación** o **Agregar a
pantalla de inicio**. Queda con ícono propio, a pantalla completa y funciona sin señal, salvo
la lectura de fotos, que sí necesita internet.

## Actualizar la app

Reemplazar `index.html` y **subir el número de versión en `sw.js`** (`inventario-ia-v2` →
`v3`). Sin ese cambio, los dispositivos que ya la instalaron seguirán abriendo la versión
guardada.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | La app completa, con JSZip incluido |
| `manifest.webmanifest` | Nombre, colores e íconos para instalarla |
| `sw.js` | Guarda la app para uso sin señal |
| `icon-192.png`, `icon-512.png` | Íconos de la app |
| `ocr.js` | Fuente de la sección de foto (va embebida en `index.html`) |
| `api/extract.js` | El lector, para desplegar en Vercel sin terminal |
| `vercel.json` | Ajustes del despliegue en Vercel |
| `worker/worker.js` | El mismo lector, versión Cloudflare Workers |
| `LECTOR.md` | Cómo conectar el lector (los dos caminos) |
| `WORKER.md` | Camino de Cloudflare, para quien use terminal |
| `.nojekyll` | Evita el procesamiento Jekyll de GitHub Pages |

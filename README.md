# Inventario a Cálculo de Producción

App web con dos pasos:

1. **Foto → Excel.** Lee la foto de la hoja "STOCK DE PRODUCTO TERMINADO" y arma el Excel del
   día (`AAAA_MM_DD_Inventario.xlsx`) con las pestañas PAN BLANCO y PASTEL Y MASAS DULCES.
2. **Excel → Cálculo.** Pasa ese Excel a la columna **IA** de la tabla `Toma_Inv` del libro
   `Calculo_Produccion_IA.xlsx`.

Los archivos de Excel se procesan en el dispositivo y nunca se suben a ningún lado. Lo único
que sale es la foto, y solo hacia tu propio worker (ver [WORKER.md](WORKER.md)).

## Paso 1: foto → Excel

Toca **Tomar foto** o **Elegir imagen**, luego **Leer la foto**. La app muestra cada clave con
su TOTAL, editable, y marca en rojo las que el lector no vio con claridad. El botón **Ver foto**
abre la imagen a pantalla completa para cotejar sin perder la tabla.

Solo se lee la columna **TOTAL**. La columna DETALLE/CONTEO se ignora por completo.

Revisa siempre antes de guardar: un número mal leído se convierte en producción de más o de
menos. De ahí se puede **Guardar Excel** o pasar los datos directo al paso 2.

Necesita la dirección de tu lector, que se configura una vez por dispositivo en **Ajustes del
lector**. Los pasos para montarlo están en [WORKER.md](WORKER.md).

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

La carpeta `worker/` no estorba en Pages, pero tampoco se publica desde ahí: se despliega
aparte con `wrangler` (ver [WORKER.md](WORKER.md)).

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
| `worker/worker.js` | El lector: guarda la llave y llama a la API |
| `worker/wrangler.toml` | Ajustes del worker |
| `WORKER.md` | Cómo desplegar el lector |
| `.nojekyll` | Evita el procesamiento Jekyll de GitHub Pages |

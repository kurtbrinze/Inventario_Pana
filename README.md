# Inventario a Cálculo de Producción

App web que pasa el inventario diario de panadería a la columna **IA** de la tabla `Toma_Inv`
del libro `Calculo_Produccion_IA.xlsx`.

Todo el procesamiento ocurre en el dispositivo: los archivos de Excel nunca se suben a ningún
servidor. El repositorio solo publica el código de la app.

## Cómo se usa

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

1. En GitHub: **New repository**, nombre `inventario-a-calculo`, visibilidad **Public**
   (Pages gratis solo funciona en repos públicos), sin marcar "Add a README".
2. **Add file → Upload files** y subir todo el contenido de esta carpeta:
   `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `README.md`.
   Luego **Commit changes**.
3. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*,
   Branch = `main`, carpeta `/ (root)`. **Save**.
4. En un minuto queda en `https://TU-USUARIO.github.io/inventario-a-calculo/`.

Desde la línea de comandos sería:

```bash
git init -b main
git add .
git commit -m "App de inventario a Toma_Inv"
git remote add origin https://github.com/TU-USUARIO/inventario-a-calculo.git
git push -u origin main
```

## Instalar en la tablet Android

Abrir la dirección en Chrome, menú de tres puntos, **Instalar aplicación** o **Agregar a
pantalla de inicio**. Queda con ícono propio, a pantalla completa y funciona sin señal, porque
`sw.js` guarda la app en el dispositivo. En laptop, Chrome y Edge muestran el ícono de instalar
en la barra de direcciones.

## Actualizar la app

Reemplazar `index.html` y **subir el número de versión en `sw.js`** (`const CACHE =
'inventario-ia-v1'` → `v2`). Sin ese cambio, los dispositivos que ya la instalaron seguirán
abriendo la versión guardada.

## Versión Android

Para empaquetarla como app instalable de Android (APK/AAB) ver [ANDROID.md](ANDROID.md).
Los archivos `android/twa-manifest.json` y `.github/workflows/android-apk.yml` ya están listos.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | La app completa, con JSZip incluido; no necesita internet |
| `manifest.webmanifest` | Nombre, colores e íconos para instalarla |
| `sw.js` | Guarda la app para uso sin señal; red primero, caché si no hay |
| `icon-192.png`, `icon-512.png` | Íconos de la app |
| `.nojekyll` | Opcional: evita el procesamiento Jekyll de GitHub Pages |

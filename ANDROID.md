# Versión Android (app instalable)

La app publicada en <https://kurtbrinze.github.io/Inventario_Pana/> se empaqueta como app de
Android usando **TWA** (Trusted Web Activity): el APK es una envoltura que abre ese sitio a
pantalla completa, con el motor de Chrome. No hay que reescribir nada, y cuando actualices el
sitio la app se actualiza sola, sin reinstalar.

Hay dos caminos. El primero es el rápido; el segundo deja el empaquetado dentro del repositorio.

---

## Camino 1: PWABuilder (15 minutos, sin instalar nada)

1. Entra a <https://www.pwabuilder.com> y pega `https://kurtbrinze.github.io/Inventario_Pana/`.
2. **Package for stores → Android**. Usa estos valores:
   - Package ID: `io.github.kurtbrinze.inventariopana`
   - App name: `Inventario a Cálculo de Producción`
   - Short name: `Inventario IA`
   - Start URL: `/Inventario_Pana/`
3. Descarga el zip. Adentro vienen `app-release-signed.apk`, el `.aab` para Play Store,
   la llave de firma (`signing.keystore` con sus contraseñas en `signing-key-info.txt`) y el
   archivo `assetlinks.json`.
4. **Guarda esa llave y sus contraseñas en un lugar seguro.** Sin ella no puedes publicar
   actualizaciones de la misma app.
5. Publica el `assetlinks.json` como se explica abajo.
6. Pasa el APK a la tablet e instálalo.

---

## Camino 2: desde este repositorio con GitHub Actions

Ya vienen incluidos `android/twa-manifest.json` y el flujo
`.github/workflows/android-apk.yml`, que compila en los servidores de GitHub.

### Una sola vez: crear la llave de firma

En tu laptop (con Java instalado):

```bash
keytool -genkeypair -v -keystore android.keystore -alias inventario \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarda el archivo y las contraseñas. Luego conviértelo a texto:

```bash
base64 -w0 android.keystore > android.keystore.b64     # Linux
certutil -encode android.keystore android.keystore.b64 # Windows
```

### Una sola vez: cargar los secrets

En el repositorio, **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Contenido |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | El contenido del archivo `.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | La contraseña del keystore |
| `ANDROID_KEY_PASSWORD` | La contraseña del alias `inventario` |

### Cada vez que quieras un instalador

**Actions → Construir app Android → Run workflow**. Si es una versión nueva, escribe el
`versionName` (ej. `1.0.1`) y sube el `versionCode` en uno. Al terminar, descarga el artefacto
`inventario-ia-android`: trae el APK, el AAB y el `assetlinks.json`. En el registro del paso
"Mostrar la huella SHA-256" aparece la huella que necesitas abajo.

---

## Publicar assetlinks.json (importante)

Sin este archivo la app funciona, pero muestra la barra de dirección de Chrome arriba. Con él,
abre limpia, a pantalla completa.

El archivo debe quedar en la **raíz del dominio**, no dentro de este repositorio:

```
https://kurtbrinze.github.io/.well-known/assetlinks.json
```

Como `kurtbrinze.github.io` es tu sitio de usuario, ese archivo se sirve desde un repositorio
llamado exactamente **`kurtbrinze.github.io`**. Si no existe, créalo y dentro pon:

- `.well-known/assetlinks.json` con el contenido de `android/assetlinks.plantilla.json`,
  reemplazando `PEGA_AQUI_LA_HUELLA_SHA256` por la huella SHA-256 de tu llave
  (formato `AA:BB:CC:...`).
- Un archivo vacío llamado `.nojekyll` en la raíz. Sin él, GitHub Pages ignora las carpetas que
  empiezan con punto y el archivo no se publica.

Activa Pages en ese repositorio igual que en este. Para comprobarlo, abre la dirección en el
navegador: debe mostrar el JSON. Después de instalar la app, desinstálala y vuelve a
instalarla para que Android revalide.

---

## Instalar en la tablet

1. Pasa el `app-release-signed.apk` a la tablet (cable, Drive o correo).
2. Ábrelo desde el explorador de archivos. Android pedirá permitir **instalar apps de fuentes
   desconocidas** para esa aplicación; acéptalo.
3. Queda con su ícono, a pantalla completa.

Para instalación masiva o sin sideload, sube el `.aab` a Google Play y usa una **prueba interna**
o **Play Console → distribución privada**.

---

## Cómo se comporta la app

- Elegir archivos y guardar el Excel funcionan igual que en Chrome: el libro guardado cae en
  **Descargas**.
- Sin señal sigue abriendo, porque el service worker guarda la app en el dispositivo. La
  primera apertura sí necesita internet.
- Al actualizar el sitio (`index.html` + subir la versión en `sw.js`) la app toma los cambios
  sola. Solo hay que generar un APK nuevo si cambias nombre, ícono o el paquete.
- Los archivos de Excel nunca salen de la tablet.

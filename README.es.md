# 🎥 Camera Director — plugin para Slopsmith

> 🇪🇸 Español · [🇬🇧 English](./README.md)

Un panel de control flotante y **bilingüe (EN/ES)** que te deja dirigir la cámara
del **3D Highway** en tiempo real — **Órbita, Paneo, Zoom, Inclinación y
Altura** — y **guardar, exportar e importar** tus vistas favoritas como archivos
JSON que se pueden compartir.

Está hecho como una **capa de overlay** limpia sobre el canvas del highway. Se
comunica con el renderer a través de un único objeto puente compartido
(`window.__h3dCamCtl`) y nunca toca las tripas del renderer, así que **no genera
fugas de memoria** y se puede actualizar o quitar de forma independiente.

https://github.com/user-attachments/assets/ba1dbb92-be79-4a7b-9ecb-d4304089d3aa

## Funciones

- **Controles de cámara en vivo** — Altura, Zoom, Órbita (yaw), Inclinación
  (pitch), Pan X / Pan Y.
- **Arrastrá para orbitar** — con la cámara libre activada, arrastrá sobre el
  highway para orbitar e inclinar.
- **Presets con nombre** — guardá cualquier vista y volvé a cargarla después con
  una transición animada suave (usa **GSAP** si está disponible; si no, un tween
  interno).
- **Compartí tus vistas** — exportá una sola vista o toda tu colección a un
  archivo `.json`, e importá los que te pasen otros.
- **Interfaz bilingüe** — cambiá inglés ⇄ español al vuelo; todos los textos
  viven en diccionarios de idioma, nada está hardcodeado.
- Tema minimalista **gótico-chic** de alto contraste.
- **Persistente** — tu cámara en vivo y tus presets sobreviven a los reinicios
  de la app vía `localStorage`.

## Requisitos

- Slopsmith con la visualización **3D Highway** (`highway_3d`) activa.
- El **puente de cámara** aplicado a `highway_3d`. El `highway_3d` que viene de
  fábrica con Slopsmith Desktop (hasta la **0.2.9** inclusive) **no** lee el
  puente `window.__h3dCamCtl` todavía, así que sin él el panel abre pero la
  cámara no se mueve. Este repo incluye el renderer parcheado y un instalador de
  un clic en [`bridge/`](./bridge/) — mirá
  [Instalar el puente](#instalar-el-puente-obligatorio) más abajo.

## Instalación (desde GitHub)

Tanto la app de escritorio como la web descubren plugins desde tu carpeta local
de plugins. Cloná este repo adentro:

| Plataforma | Carpeta de plugins |
|------------|--------------------|
| Windows    | `%APPDATA%\slopsmith-desktop\plugins\` |
| macOS      | `~/Library/Application Support/slopsmith-desktop/plugins/` |
| Linux      | `~/.config/slopsmith-desktop/plugins/` |

```bash
# Windows (PowerShell)
git clone https://github.com/nimuart/cameradirector_feedback `
  "$env:APPDATA\slopsmith-desktop\plugins\camera_director"

# macOS / Linux
git clone https://github.com/nimuart/cameradirector_feedback \
  ~/.config/slopsmith-desktop/plugins/camera_director   # ajustá la ruta según la tabla
```

Después **reiniciá Slopsmith**. El nombre de la carpeta no importa, pero el `id`
del manifiesto (`camera_director`) sí — mantenelo único.

> Clonar con git (en vez de bajar el ZIP) además permite que el Plugin Manager
> integrado de Slopsmith actualice el plugin con un clic.

## Instalar el puente (obligatorio)

El plugin le habla al highway a través de `window.__h3dCamCtl`, pero el
`highway_3d` que trae Slopsmith Desktop **0.2.9 y anteriores todavía no lo
lee**. La carpeta [`bridge/`](./bridge/) incluye un `highway_3d/screen.js`
parcheado (hecho sobre el bundle 0.2.9) más scripts de instalación y
restauración:

**Windows (instalación por defecto en `C:\Program Files\Slopsmith`):**

1. Cerrá Slopsmith.
2. Ejecutá `bridge/install_modded_screen.bat` (pide permisos de
   administrador). Hace backup del renderer original como `screen.js.bak` y
   copia el parcheado.
3. Abrí Slopsmith — Camera Director ya mueve la cámara.

Para deshacerlo, ejecutá `bridge/restore_original_screen.bat`, que
restaura el backup.

**Manual / macOS / Linux:** con Slopsmith cerrado, hacé backup y reemplazá
`<recursos de la app>/slopsmith/plugins/highway_3d/screen.js` por
`bridge/screen.js`.

> ⚠️ **Las actualizaciones de la app pisan el puente.** Al actualizar Slopsmith
> Desktop se reemplaza el `highway_3d` bundleado, así que volvé a correr el
> instalador después de cada actualización. El archivo parcheado corresponde a
> **Slopsmith Desktop 0.2.9** — en otras versiones, mejor esperar un parche que
> corresponda antes que copiar este. La solución de fondo es que el soporte de
> `__h3dCamCtl` se integre upstream en el `highway_3d` de Slopsmith — el cambio
> exacto (~30 líneas) está documentado en [DEVELOPERS.md](./DEVELOPERS.md) (en
> inglés, pensado para los mantenedores).

## Uso

1. Abrí una canción y asegurate de que la visualización sea **3D Highway**.
2. Hacé clic en el **chip 🎥** (arriba a la derecha) o apretá la tecla **`` ` ``**.
3. Activá **Cámara libre** para tomar el control del encuadre.
4. Movés los sliders — o arrastrás el highway directamente — hasta que quede hermoso.
5. **Guardar vista**, le ponés un nombre, y aparece en la lista de Presets.
6. **Exportar** para compartir el `.json`; los demás lo **Importan** y obtienen la vista exacta.

Apagá **Cámara libre** cuando quieras para devolverle el control a la cámara
automática de Slopsmith.

## Formato de archivo compartible

Las exportaciones usan un sobre chico y compatible hacia adelante:

```json
{
  "kind": "slopsmith.camera-director.preset",
  "version": 1,
  "preset": {
    "name": "Frente de escenario",
    "cam": { "heightMul": 1.2, "distMul": 0.9, "yaw": -0.3, "pitch": 14, "panX": 0, "panY": -8 },
    "savedAt": "2026-06-09T16:00:00.000Z"
  }
}
```

Una exportación de toda la colección reemplaza `preset` por un array `presets`.
Las importaciones validan el marcador `kind` antes de aplicar, así que se pueden
intercambiar archivos con seguridad.

## Estructura del proyecto

```
camera_director/
├── plugin.json            # manifiesto de Slopsmith (id, script, styles)
├── screen.js              # runtime: puente + UI overlay + i18n + persistencia
├── assets/
│   ├── plugin.css         # tema gótico-chic (se sirve como stylesheet del plugin)
│   └── locales/           # diccionarios servidos en runtime (en.json, es.json)
├── bridge/
│   ├── screen.js                          # renderer highway_3d parcheado (lee el puente)
│   ├── install_modded_screen.bat       # Windows: aplica el puente (hace backup)
│   └── restore_original_screen.bat   # Windows: restaura el renderer original
├── src/
│   └── locales/           # fuente canónica de los diccionarios (editá acá)
├── scripts/
│   └── sync-assets.mjs    # copia src/locales -> assets/locales
├── package.json
├── README.md / README.es.md
├── INSTALL.md / INSTALACION.md
├── DEVELOPERS.md          # cómo hacer el puente nativo en highway_3d
```

> **Para editar traducciones:** cambiá `src/locales/*.json` y después corré
> `npm run build` para sincronizarlos a `assets/locales/` (el único lugar desde
> donde el runtime puede servirlos).

## Cómo funciona el puente

El renderer (`highway_3d`) lee este objeto en cada frame dentro de `camUpdate()`:

```js
window.__h3dCamCtl = {
  enabled,     // interruptor maestro (false → el renderer encuadra solo)
  heightMul,   // multiplicador de altura
  distMul,     // multiplicador de dolly / zoom
  yaw,         // órbita alrededor del objetivo (radianes)
  pitch,       // offset de inclinación (unidades del highway)
  panX, panY   // paneo del objetivo (unidades del highway)
};
```

Camera Director simplemente escribe en él. Ese contrato de un solo objeto es toda
la superficie de integración — sin globales más allá de `window.__h3dCamCtl` (el
puente) y `window.__camDir` (el handle de teardown idempotente de este plugin).

## Licencia

AGPL-3.0-only, igual que Slopsmith.

# 🎥 Camera Director — plugin para Slopsmith · **v0.1**

> 🇪🇸 Español · [🇬🇧 English](./README.md)


https://github.com/user-attachments/assets/11dd4b15-f3b8-43aa-9ed8-d5b3c8d39d22


Panel flotante para controlar la cámara del **3D Highway** en tiempo real:
órbita, paneo, zoom, inclinación, altura — con **cámaras por jugador en
split-screen**, **biblioteca de presets** e interfaz bilingüe EN/ES.

## Instalación

1. Copiá esta carpeta en la carpeta de plugins de Slopsmith:
   - Windows: `%APPDATA%\slopsmith-desktop\plugins\camera_director`
   - macOS: `~/Library/Application Support/slopsmith-desktop/plugins/camera_director`
   - Linux: `~/.config/slopsmith-desktop/plugins/camera_director`
2. **Solo Slopsmith 0.2.x:** corré `bridge/install_modded_screen.bat` (Windows,
   con la app cerrada). En 0.3+ no hace falta.
3. Reiniciá Slopsmith, abrí una canción con el **3D Highway** y tocá el chip 🎥
   (o apretá `` ` ``).

## Uso

Activá **Cámara libre** y arrastrá sobre el highway: **arrastrar** = órbita ·
**Shift** = paneo · **Ctrl** = zoom · **Alt** = altura · **rueda** = zoom. Tocá
cualquier valor para escribirlo. Guardá/cargá/descargá/importá **presets** de
cámara. En split-screen, las pestañas **Jugador 1/2** controlan la cámara de
cada panel por separado.

## Novedades

### v0.1
- **Arquitectura separada en cerebro + UI** — `camera-controller.js` (el cerebro:
  cámara, presets, persistencia, lógica de split; expone `window.__camDir`) y
  `assets/ui-panel.js` (toda la UI). La UI se puede actualizar sin tocar el
  cerebro. (El archivo de entrada se renombró desde `screen.js` para no chocar
  con el `highway_3d/screen.js` de Slopsmith.)
- **Cámaras por jugador en split-screen** — cada panel tiene su propia cámara
  (`window.__h3dCamCtlPanels`); las pestañas de jugador aparecen solo en split, y
  arrastrar un panel controla a ese jugador. (Requiere el parche del renderer en
  `DEVELOPERS.md`.)
- **Navegación estilo Blender** — modificadores Shift/Ctrl/Alt + zoom con rueda.
- **Biblioteca de presets** — crear (con nombre), cargar (o doble clic), guardar,
  descargar e importar; los nombres llevan el color del jugador.
- **Valores editables** — tocá un número para escribir el valor/ángulo exacto.
- **Chip arrastrable** — ponelo donde quieras; recuerda la posición.
- **Tema metálico** — panel y botones de metal cepillado, color solo en el borde.


## Licencia

AGPL-3.0-only, igual que Slopsmith.

# 🎥 Camera Director — plugin para Slopsmith · **v0.1**

> 🇪🇸 Español · [🇬🇧 English](./README.md)

https://github.com/user-attachments/assets/11dd4b15-f3b8-43aa-9ed8-d5b3c8d39d22

Panel flotante para controlar la cámara del **3D Highway** en tiempo real —
órbita, paneo, zoom, inclinación, altura — con **biblioteca de presets** e
interfaz bilingüe EN/ES.

## Instalación

1. Copiá esta carpeta en la carpeta de plugins de Slopsmith:
   - Windows: `%APPDATA%\slopsmith-desktop\plugins\camera_director`
   - macOS: `~/Library/Application Support/slopsmith-desktop/plugins/camera_director`
   - Linux: `~/.config/slopsmith-desktop/plugins/camera_director`
2. **El puente (Slopsmith 0.2.x):** la cámara no se mueve hasta aplicar el
   puente — corré `bridge/install_modded_screen.bat` (Windows, con la app
   cerrada). **A partir de Slopsmith 0.3 este paso no hará falta** (el puente
   viene incluido); por ahora es obligatorio.
3. Reiniciá Slopsmith, abrí una canción con el **3D Highway** y tocá el chip 🎥
   (o apretá `` ` ``).

## Uso

Activá **Cámara libre** y arrastrá sobre el highway — **arrastrar** = órbita ·
**Shift** = paneo · **Ctrl** = zoom · **Alt** = altura · **rueda** = zoom. Tocá
cualquier valor para escribirlo exacto. Guardá / cargá / descargá / importá
**presets** de cámara.

## Novedades

### v0.1
- Control de cámara en tiempo real: órbita, paneo, zoom, inclinación, altura.
- **Navegación en espacio 3D** — modificadores Shift / Ctrl / Alt + zoom con rueda.
- **Biblioteca de presets** — crear (con nombre), cargar (o doble clic), guardar,
  descargar e importar.
- **Valores editables** — tocá un número para escribir el valor/ángulo exacto.
- **Chip arrastrable** — ponelo donde quieras; recuerda la posición.
- **Tema metálico**, bilingüe EN/ES.
- 🚧 **Próximamente:** cámaras independientes por jugador en split-screen.

## Licencia

AGPL-3.0-only, igual que Slopsmith.

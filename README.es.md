# 🎥 Camera Director — plugin para Slopsmith · **v3.4**

> 🇪🇸 Español · [🇬🇧 English](./README.md)

https://github.com/user-attachments/assets/11dd4b15-f3b8-43aa-9ed8-d5b3c8d39d22

Panel flotante para controlar la cámara del **3D Highway** en tiempo real —
órbita, paneo, zoom, inclinación, altura — para los highways de guitarra, batería
**y** piano/teclado, con **biblioteca de perfiles con nombre** e interfaz bilingüe
EN/ES. En **split-screen** cada panel tiene su propia cámara, y podés controlar
los paneles **desprendidos** (en otro monitor) desde la ventana principal.

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
cualquier valor para escribirlo exacto. Guardá cualquier cámara como **perfil con
nombre** y aplicalo en cualquier panel.

### Split-screen

Al dividir el reproductor, la fila de paneles arriba de Camera Director lista cada
panel por **nombre** (nombrá los paneles en la barra de Split Screen). Tocá un
panel para apuntarlo; el panel que estás editando queda resaltado y el panel
enfocado queda subrayado. Las ediciones aplican solo a ese panel.

- **Menú de perfiles** — aplicá un perfil con nombre al panel seleccionado.
- **Vincular paneles** — replicá una cámara en todos los paneles (ajustás una vez,
  aplica a todos).
- **Aplicar a todos** — copia puntual de la cámara actual al resto.

### Paneles desprendidos (multi-monitor)

Desprendé un panel a su propia ventana y **igual aparece en la fila de paneles**
(en itálica con un `⤢`) — seleccionalo para controlar la cámara de esa ventana
desde la principal, en vivo. También podés arrastrar directamente sobre el canvas
de la ventana desprendida (activá su **Cámara libre** desde la ventana principal
primero). Todo se guarda en la configuración local.

## Novedades

### v3.x — Split-screen y multi-ventana
- **Cámaras por panel** en split-screen para los highways de guitarra, batería y
  teclado — cada panel renderiza su propia cámara.
- **Biblioteca de perfiles con nombre** — guardá una cámara como perfil y aplicalo
  en cualquier panel; seguimiento de asignación por panel (muestra *Custom* tras un
  ajuste manual).
- **Selector de paneles** — una tira desplazable con los **nombres**; la edición
  sigue al panel enfocado. **Vincular** / **Aplicar a todos** para configuraciones
  parejas.
- **Controlá paneles desprendidos desde la ventana principal**, y **arrastrá
  directamente** sobre el canvas de la ventana desprendida.

### v0.1
- Control de cámara en tiempo real: órbita, paneo, zoom, inclinación, altura.
- **Navegación en espacio 3D** — modificadores Shift / Ctrl / Alt + zoom con rueda.
- **Biblioteca de presets** — crear (con nombre), cargar (o doble clic), guardar,
  descargar e importar.
- **Valores editables** — tocá un número para escribir el valor/ángulo exacto.
- **Chip arrastrable** — ponelo donde quieras; recuerda la posición.
- **Tema metálico**, bilingüe EN/ES.

## Licencia

AGPL-3.0-only, igual que Slopsmith.

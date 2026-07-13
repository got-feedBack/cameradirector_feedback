/* ============================================================================
 *  Camera Director — UI LAYER  (assets/ui-panel.js)
 *  ----------------------------------------------------------------------------
 *  ALL the panel UI lives here. It is loaded by the brain (screen.js) and talks
 *  to it ONLY through `window.__camDir`. You can iterate this file (and
 *  plugin.css) freely without touching the brain.
 *
 *  Responsibilities: launcher button (mounted into the player's Visualisation &
 *  Quality toolbar, next to the viz picker, shown only for 3D highways), panel
 *  DOM, player tabs (only in splitscreen), sliders + editable values, master
 *  toggle, preset library, reset, i18n, hotkey, open/close animation. No camera
 *  math, no persistence of camera state — that's the brain.
 * ==========================================================================*/
(function () {
  'use strict';

  const API = window.__camDir;
  if (!API) { console.warn('[camera_director] brain not ready; UI aborted'); return; }

  // Tear down a previous UI instance (idempotent across re-injection).
  if (window.__camDirUI && typeof window.__camDirUI.destroy === 'function') {
    try { window.__camDirUI.destroy(); } catch (e) { /* ignore */ }
  }

  const PLUGIN_ID = 'camera_director';
  const ASSET_BASE = `/api/plugins/${PLUGIN_ID}/assets`;
  const LS_LANG = 'camera_director.lang';
  const AXES = API.AXES;

  // ── i18n ────────────────────────────────────────────────────────────────────
  const FALLBACK_I18N = {
    en: {
      title: 'Camera Director', launch: 'Camera', open: 'Open', master: 'Free camera', on: 'ON', off: 'OFF',
      heightMul: 'Height', distMul: 'Zoom', yaw: 'Orbit', pitch: 'Tilt',
      panX: 'Pan X', panY: 'Pan Y', reset: 'Reset', close: 'Close',
      presets: 'Presets', create: 'Create preset', save: 'Save preset', load: 'Load',
      del: 'Delete', export: 'Export', download: 'Download', import: 'Import preset',
      savePrompt: 'Name this preset:', noPresets: 'No presets yet.',
      importErr: 'Invalid camera file.', editValue: 'Edit value',
      dragHint: 'Drag = orbit · Shift = pan · Ctrl = zoom · Alt = height · wheel = zoom · ` toggles',
      language: 'Language', player: 'Player',
    },
    es: {
      title: 'Director de Cámara', launch: 'Cámara', open: 'Abrir', master: 'Cámara libre', on: 'SÍ', off: 'NO',
      heightMul: 'Altura', distMul: 'Zoom', yaw: 'Órbita', pitch: 'Inclinación',
      panX: 'Pan X', panY: 'Pan Y', reset: 'Restablecer', close: 'Cerrar',
      presets: 'Presets', create: 'Crear preset', save: 'Guardar preset', load: 'Cargar',
      del: 'Borrar', export: 'Exportar', download: 'Descargar', import: 'Importar preset',
      savePrompt: 'Nombrá este preset:', noPresets: 'Todavía no hay presets.',
      importErr: 'Archivo de cámara inválido.', editValue: 'Editar valor',
      dragHint: 'Arrastrar = órbita · Shift = paneo · Ctrl = zoom · Alt = altura · rueda = zoom · ` muestra/oculta',
      language: 'Idioma', player: 'Jugador',
    },
  };
  const i18n = JSON.parse(JSON.stringify(FALLBACK_I18N));
  let lang = (localStorage.getItem(LS_LANG) || (navigator.language || 'en').slice(0, 2));
  if (!i18n[lang]) lang = 'en';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || FALLBACK_I18N.en[key] || key;
  async function loadLocales() {
    await Promise.all(['en', 'es'].map(async (code) => {
      try {
        const r = await fetch(`${ASSET_BASE}/locales/${code}.json`, { cache: 'no-cache' });
        if (r.ok) Object.assign(i18n[code], await r.json());
      } catch (e) { /* keep fallback */ }
    }));
  }

  // ── Icons ───────────────────────────────────────────────────────────────────
  const ICONS = {
    heightMul: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    distMul: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
    yaw: '<path d="M12 5a7 7 0 1 1-6.9 8M12 5V2M12 5l3 2"/>',
    pitch: '<path d="M3 12h18M12 3a9 9 0 0 1 0 18M12 3a9 9 0 0 0 0 18"/>',
    panX: '<path d="M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
    panY: '<path d="M12 2v20M8 6l4-4 4 4M8 18l4 4 4-4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    camera: '<path d="M3 7h4l2-2h6l2 2h4v12H3zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>',
    save: '<path d="M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7"/>',
    import: '<path d="M12 3v12M8 11l4 4 4-4M4 21h16"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    download: '<path d="M12 4v10M8 10l4 4 4-4M5 19h14"/>',
  };
  const svg = (name, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  // ── DOM scaffolding ───────────────────────────────────────────────────────────
  const L = [];
  const on = (el, ev, fn, opts) => { el.addEventListener(ev, fn, opts); L.push([el, ev, fn, opts]); };
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  function mkBtn(icon, text, fn, primary) {
    const b = el('button', 'camdir-btn' + (primary ? ' camdir-btn--primary' : ''));
    b.innerHTML = svg(icon, 14) + `<span>${text}</span>`;
    on(b, 'click', fn);
    return b;
  }

  const root = el('div'); root.id = 'camdir-root';
  const panel = el('div', 'camdir-panel'); panel.id = 'camdir-panel'; panel.hidden = true;
  root.appendChild(panel);

  // Launcher lives as its OWN ROW inside the Visualisation & Quality popover
  // (#v3-rail-pop-viz) — not a floating chip and not crammed next to the viz
  // dropdown. It mirrors the native `.v3-pop-row` pattern (a `.v3-pop-label` on
  // the left + a `.v3-pop-btn` control on the right) used by the Visualization /
  // Quality / Min res / Scoreboard rows, so it looks built-in.
  const launchRow = el('div', 'v3-pop-row');
  launchRow.id = 'camdir-launch-row';
  const launchLabel = el('span', 'v3-pop-label');
  launchLabel.textContent = t('launch');
  const launchBtn = el('button', 'v3-pop-btn');
  launchBtn.id = 'camdir-launch';
  launchBtn.type = 'button';
  launchBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;';
  launchBtn.innerHTML = svg('camera', 14) + `<span>${t('open')}</span>`;
  launchBtn.title = t('title');
  launchRow.append(launchLabel, launchBtn);

  const importPicker = el('input');
  importPicker.type = 'file'; importPicker.accept = 'application/json,.json'; importPicker.style.display = 'none';
  on(importPicker, 'change', async () => {
    const f = importPicker.files && importPicker.files[0];
    importPicker.value = '';
    if (!f) return;
    const ok = await API.importFromFile(f);
    if (!ok) window.alert(t('importErr'));
    else { renderPresets(); syncSliders(); }
  });

  const sliders = {};
  const valLabels = {};

  // ── Panel build ───────────────────────────────────────────────────────────────
  // ── Detachable pane ─────────────────────────────────────────────────────────
  //
  // Register THIS panel as a pane and it can be popped out into its own window and
  // left there — across song switches, on a second monitor, minimized to the tray.
  // No longer an overlay you keep dismissing to see the highway.
  //
  // The host MOVES this element into the pane window. Not a copy of it, not a
  // reimplementation — this node, listeners and closures intact. So everything
  // comes along: the tabs, the sliders, the preset library, the import/export, the
  // language toggle, our CSS. It still talks to the brain in the main window, and
  // the brain still owns the clamps, the store and the bridge globals. Nothing in
  // this plugin needs to know it moved.
  //
  // buildPanel() clears and rebuilds the panel on every 'mode' change, which takes
  // the chip with it — so re-attach each time. attachChip() allows one live
  // attachment per pane, hence the detach first; it then reconciles against the
  // pane's real state, so a panel rebuilt while popped out stays correctly hidden
  // with its stub in place.
  const PANE_ID = 'camera_director';
  let paneChipDetach = null;
  let paneRegistered = false;

  function attachPaneChip(tools) {
    const panes = window.feedBack && window.feedBack.panes;
    // No panes API (an older host) — no chip, and the panel behaves as it always has.
    if (!panes || typeof panes.register !== 'function') return;

    if (!paneRegistered) {
      // attachPaneChip() is called from buildPanel(). A throw here would abort the
      // whole panel build — the pane is a nice-to-have, the panel is the plugin.
      // So: contain it, and flag only on success, so a later rebuild can retry.
      try {
        panes.register({
          id: PANE_ID,
          title: 'Camera Director',
          icon: '🎥',
          // Resolved when the pane opens, not now — `panel` is a stable node, but
          // asking for it late is what lets a plugin rebuild or lazily create it.
          element: () => panel,
          width: 300,
          height: 520,
        });
        paneRegistered = true;
      } catch (e) {
        console.warn('[camera_director] pane registration failed; panel still works', e);
        return;   // no registration → nothing to attach a chip to
      }
    }

    if (paneChipDetach) { try { paneChipDetach(); } catch (e) { /* already gone */ } paneChipDetach = null; }
    try { paneChipDetach = panes.attachChip(panel, PANE_ID, { header: tools }); }
    catch (e) { console.warn('[camera_director] pop-out chip unavailable', e); }
  }

  function buildPanel() {
    panel.innerHTML = '';
    root.style.setProperty('--cd-accent', API.getColor());

    // Panel selector — ONLY in splitscreen. A horizontally-scrollable strip of
    // the panels' NAMES (not fixed A–D) so it scales to many panels (incl.
    // popped-out ones once cross-window aggregation lands). The focused panel is
    // underlined; the edited panel is highlighted.
    const slots = API.getSlots();
    if (slots.length > 1) {
      const tabs = el('div', 'camdir-tabs');
      tabs.style.cssText = 'display:flex;gap:4px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:3px;scrollbar-width:thin;';
      const editKey = API.getEditingKey();
      slots.forEach((s) => {
        const tab = el('button', 'camdir-tab' + (s.key === editKey ? ' is-active' : ''));
        // Remote = a popped-out panel living in another window (steered from here).
        tab.textContent = s.remote ? (s.label + ' ⤢') : s.label;
        tab.title = s.remote
          ? (s.label + ' — ' + ((lang === 'es') ? 'panel emergente (steer desde aquí)' : 'popped-out panel'))
          : (s.label + (s.focused ? ' — ' + ((lang === 'es') ? 'enfocado' : 'focused') : ''));
        tab.style.setProperty('--tab', s.color);
        tab.style.cssText += 'white-space:nowrap;flex:0 0 auto;max-width:130px;overflow:hidden;text-overflow:ellipsis;';
        if (s.remote) { tab.style.fontStyle = 'italic'; tab.style.borderStyle = 'dashed'; }
        // Focus marker (which panel the player is currently driving) — distinct
        // from the edit selection so both are visible at once.
        if (s.focused) tab.style.boxShadow = 'inset 0 -2px 0 0 ' + s.color;
        on(tab, 'click', () => API.setEditingKey(s.key));
        tabs.appendChild(tab);
      });
      panel.appendChild(tabs);
    }

    // Header.
    const head = el('div', 'camdir-head');
    const title = el('div', 'camdir-title');
    title.innerHTML = svg('camera', 18) + `<span>${t('title')}</span>`;
    const tools = el('div', 'camdir-tools');
    const langBtn = el('button', 'camdir-lang'); langBtn.textContent = lang.toUpperCase(); langBtn.title = t('language');
    on(langBtn, 'click', () => setLang(lang === 'en' ? 'es' : 'en'));
    const closeBtn = el('button', 'camdir-icon-btn'); closeBtn.innerHTML = svg('close', 16); closeBtn.title = t('close');
    on(closeBtn, 'click', togglePanel);
    tools.append(langBtn, closeBtn);
    head.append(title, tools);
    panel.appendChild(head);
    // The host's pop-out chip goes in the header's tool cluster. Clicking it moves
    // the axis controls into their own window and hides this panel, leaving the
    // host's "bring it back" stub in its place — so the panel stops being an
    // overlay you have to keep dismissing to see the highway. The host owns the
    // chip, the hiding and the stub; we only say where the chip lives.
    // buildPanel() re-runs on every 'mode' change, so this must be idempotent —
    // attachChip() refuses a second attach for the same pane, and the host's own
    // open/closed reconciliation re-hides the panel if the pane is already out.
    attachPaneChip(tools);

    // Master switch.
    const masterRow = el('label', 'camdir-master');
    const masterChk = el('input'); masterChk.type = 'checkbox'; masterChk.checked = API.isEnabled();
    on(masterChk, 'change', () => { API.setEnabled(masterChk.checked); refreshMaster(); });
    const masterTxt = el('span', 'camdir-master-txt'); masterTxt.textContent = t('master');
    const masterState = el('span', 'camdir-master-state');
    masterRow.append(masterChk, masterTxt, masterState);
    panel.appendChild(masterRow);
    panel._masterState = masterState;

    // Splitscreen "across the board" controls: Link-all mirrors one camera to
    // every panel (edit once, applies to all); Apply-to-all is a one-shot copy.
    if (slots.length > 1) {
      const linkRow = el('label', 'camdir-master');
      const linkChk = el('input'); linkChk.type = 'checkbox'; linkChk.checked = API.isLinkAll();
      on(linkChk, 'change', () => { API.setLinkAll(linkChk.checked); refreshMaster(); syncSliders(); });
      const linkTxt = el('span', 'camdir-master-txt');
      linkTxt.textContent = (lang === 'es') ? 'Vincular paneles' : 'Link all panels';
      linkRow.append(linkChk, linkTxt);
      panel.appendChild(linkRow);

      const applyRow = el('div', 'camdir-presets-top');
      const applyBtn = mkBtn('save', (lang === 'es') ? 'Aplicar a todos' : 'Apply to all',
        () => { API.applyToAll(); syncSliders(); }, false);
      applyBtn.title = (lang === 'es')
        ? 'Copiar esta cámara a todos los paneles' : 'Copy this camera to every panel';
      applyRow.append(applyBtn);
      panel.appendChild(applyRow);
    }

    // Profile picker for the SELECTED panel: choose a saved profile to apply it
    // here. Shows "Custom" after a manual tweak. This is the explicit "pick a
    // saved profile → apply to this panel" control (the list below also applies
    // on click, and "Apply to all" pushes the current one to every panel).
    {
      const row = el('div', 'camdir-assign-row');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:6px 2px;';
      const lbl = el('span'); lbl.style.cssText = 'font-size:12px;opacity:.7;';
      lbl.textContent = (lang === 'es') ? 'Perfil:' : 'Profile:';
      const sel = el('select', 'camdir-assign-sel');
      sel.style.cssText = 'flex:1;background:#1a1f2b;color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 6px;font-size:12px;';
      const cur = (API.getAssignment && API.getAssignment()) || '';
      const optC = el('option'); optC.value = '';
      optC.textContent = (lang === 'es') ? '— Personalizado —' : '— Custom —';
      sel.appendChild(optC);
      for (const p of API.listPresets()) {
        const o = el('option'); o.value = p.name; o.textContent = p.name;
        if (p.name === cur) o.selected = true;
        sel.appendChild(o);
      }
      if (!cur) optC.selected = true;
      on(sel, 'change', () => {
        const name = sel.value;
        if (!name) return;                       // "Custom" is informational — no-op
        const p = API.listPresets().find((x) => x.name === name);
        if (p) { API.applyPreset(p); syncSliders(); }
      });
      row.append(lbl, sel);
      panel.appendChild(row);
    }

    // Axis sliders.
    const grid = el('div', 'camdir-grid');
    for (const [key, min, max, step] of AXES) {
      const row = el('div', 'camdir-row');
      const label = el('div', 'camdir-label');
      label.innerHTML = svg(key, 15) + `<span>${t(key)}</span>`;
      const val = el('span', 'camdir-val'); val.title = t('editValue');
      on(val, 'click', () => openValueEditor(key));
      label.appendChild(val);

      const slider = el('input', 'camdir-slider');
      slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step;
      slider.value = API.getAxis(key);
      on(slider, 'input', () => { API.setAxis(key, parseFloat(slider.value)); val.textContent = API.fmtAxis(key, API.getAxis(key)); });

      row.append(label, slider);
      grid.appendChild(row);
      sliders[key] = slider; valLabels[key] = val;
      val.textContent = API.fmtAxis(key, API.getAxis(key));
    }
    panel.appendChild(grid);

    // Presets — Create (centered) + Import, then the list.
    const presetHead = el('div', 'camdir-section-title'); presetHead.textContent = t('presets');
    panel.appendChild(presetHead);
    const createRow = el('div', 'camdir-presets-top');
    const createBtn = mkBtn('save', t('create'), () => askName('', (n) => { API.savePreset(n); renderPresets(); }), true);
    createBtn.classList.add('camdir-create');
    createRow.append(createBtn);
    panel.appendChild(createRow);
    const importRow = el('div', 'camdir-presets-import');
    const importBtn = el('button', 'camdir-import-link');
    importBtn.innerHTML = svg('import', 13) + `<span>${t('import')}</span>`;
    on(importBtn, 'click', () => importPicker.click());
    importRow.append(importBtn);
    panel.appendChild(importRow);

    const list = el('div', 'camdir-presets'); list.id = 'camdir-preset-list';
    panel.appendChild(list); panel._presetList = list;

    const hint = el('div', 'camdir-hint'); hint.textContent = t('dragHint');
    panel.appendChild(hint);

    const resetLink = el('button', 'camdir-reset-link'); resetLink.textContent = t('reset');
    on(resetLink, 'click', () => API.resetCamera());
    panel.appendChild(resetLink);

    refreshMaster();
    renderPresets();
  }

  function refreshMaster() {
    const enabled = API.isEnabled();
    panel.classList.toggle('camdir-armed', enabled);
    const row = panel.querySelector('.camdir-master');
    if (row) row.classList.toggle('is-on', enabled);
    if (panel._masterState) panel._masterState.textContent = enabled ? t('on') : t('off');
  }

  function syncSliders() {
    for (const [key] of AXES) {
      if (sliders[key]) sliders[key].value = API.getAxis(key);
      if (valLabels[key]) valLabels[key].textContent = API.fmtAxis(key, API.getAxis(key));
    }
    const m = panel.querySelector('.camdir-master input');
    if (m) m.checked = API.isEnabled();
    refreshMaster();
  }

  function renderPresets() {
    const list = panel._presetList;
    if (!list) return;
    const arr = API.listPresets();
    const assignedName = (API.getAssignment && API.getAssignment()) || null;
    list.innerHTML = '';
    if (!arr.length) {
      const empty = el('div', 'camdir-empty'); empty.textContent = t('noPresets');
      list.appendChild(empty); return;
    }
    for (const p of arr) {
      const item = el('div', 'camdir-preset');
      on(item, 'dblclick', () => { API.applyPreset(p); syncSliders(); });
      const nm = el('div', 'camdir-preset-name'); nm.textContent = p.name; nm.title = t('load');
      const col = p.color || API.getColor();
      nm.style.background = `color-mix(in srgb, ${col} 32%, transparent)`;
      nm.style.boxShadow = `inset 0 0 0 1px color-mix(in srgb, ${col} 55%, transparent)`;

      const acts = el('div', 'camdir-preset-acts');
      const play = el('button', 'camdir-icon-btn camdir-act-play');
      play.innerHTML = svg('play', 14); play.title = t('load');
      on(play, 'click', () => { API.applyPreset(p); syncSliders(); });
      const dl = el('button', 'camdir-icon-btn'); dl.innerHTML = svg('download', 15); dl.title = t('download');
      on(dl, 'click', () => API.exportPreset(p));
      const del = el('button', 'camdir-icon-btn camdir-danger'); del.innerHTML = svg('close', 14); del.title = t('del');
      on(del, 'click', () => API.deletePreset(p.name));
      acts.append(play, dl, del);

      // Highlight the profile the current panel is on, tinted in its own color.
      if (assignedName && p.name === assignedName) {
        item.style.outline = `2px solid ${col}`;
        item.style.outlineOffset = '-2px';
        item.title = (lang === 'es') ? 'Perfil activo en este panel' : 'Active profile on this panel';
      }

      // Inverted order ONLY here (the preset row renders under a reversed rule):
      // appending acts-then-name yields name-left / icons-right visually.
      item.append(acts, nm);
      list.appendChild(item);
    }
  }

  // ── Editable value popover ──────────────────────────────────────────────────
  let _pop = null;
  // Unbind for the popover's outside-click listener. closePop() owns it, so EVERY
  // way a popover can close — Enter, Escape, the ✓ button, an outside click, or
  // teardown — takes the listener with it. Leaving it to the outside-click path
  // alone leaked one listener per popover the user dismissed with the keyboard.
  let _popDismiss = null;

  function closePop() {
    if (_popDismiss) { try { _popDismiss(); } catch (e) { /* window may be gone */ } _popDismiss = null; }
    if (_pop) { _pop.remove(); _pop = null; }
  }

  // ── Follow the panel across documents ───────────────────────────────────────
  //
  // The panel is a detachable pane: the host may have MOVED it into a pop-out
  // window's document. This code still runs in the main window, so `document` and
  // `window` here are the MAIN ones — and the panel is no longer in them.
  //
  // A popover appended to document.body would therefore open in a window the user
  // is not even looking at, and a dismiss listener on `window` would never see the
  // clicks they actually make. Anchor both to whichever document the panel is in.
  function panelDoc() { return panel.ownerDocument || document; }
  function panelWin() { return panelDoc().defaultView || window; }

  // The popover was built with the main document's createElement, so it has to be
  // adopted before it can live in the pane document. adoptNode keeps its listeners.
  function mountPop(pop) {
    const d = panelDoc();
    d.body.appendChild(d === document ? pop : d.adoptNode(pop));
    _pop = pop;
  }

  // Dismiss-on-outside-click, in the window the user is actually clicking in.
  function dismissPopOnOutsideClick() {
    const w = panelWin();
    setTimeout(() => {
      if (!_pop) return;   // already closed before we could arm
      const onDoc = (e) => {
        // Self-remove whenever the popover is gone, however it went — not only when
        // this listener is the one that closed it.
        if (!_pop || !_pop.contains(e.target)) closePop();
      };
      w.addEventListener('pointerdown', onDoc, true);
      _popDismiss = () => w.removeEventListener('pointerdown', onDoc, true);
    }, 0);
  }
  function openValueEditor(key) {
    closePop();
    const scale = key === 'yaw' ? 57.2958 : 1;
    const cur = API.getAxis(key) * scale;
    const pop = el('div', 'camdir-valedit');
    const input = el('input'); input.type = 'text'; input.inputMode = 'decimal';
    input.value = (Math.round(cur * 100) / 100).toString();
    const unit = el('span', 'camdir-valedit-unit');
    unit.textContent = key === 'yaw' ? '°' : (key === 'heightMul' || key === 'distMul' ? '×' : '');
    const ok = el('button', 'camdir-valedit-ok'); ok.textContent = '✓';
    const commit = () => {
      const v = API.parseAxis(key, input.value);
      if (v != null) { API.setAxis(key, v); syncSliders(); }
      closePop();
    };
    on(input, 'keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') closePop(); });
    on(ok, 'click', commit);
    pop.append(input, unit, ok);
    mountPop(pop);
    // getBoundingClientRect on the label (which is inside the panel) is already
    // relative to the panel's own window — so once the popover lives in that same
    // document, these coordinates line up.
    const r = valLabels[key].getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, r.right - 140) + 'px';
    input.focus(); input.select();
    dismissPopOnOutsideClick();
  }

  // ── Name prompt (Electron has no window.prompt) — anchored under Create ─────
  function askName(initial, onOk) {
    closePop();
    const pop = el('div', 'camdir-valedit camdir-nameedit');
    const input = el('input'); input.type = 'text'; input.placeholder = t('savePrompt'); input.value = initial || '';
    const ok = el('button', 'camdir-valedit-ok'); ok.textContent = '✓';
    const done = () => { const n = input.value.trim(); closePop(); if (n) onOk(n); };
    on(input, 'keydown', (e) => { if (e.key === 'Enter') done(); if (e.key === 'Escape') closePop(); });
    on(ok, 'click', done);
    pop.append(input, ok);
    mountPop(pop);
    const anchor = panel.querySelector('.camdir-create') || panel;
    const r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.left = (r.left + r.width / 2) + 'px';
    pop.style.transform = 'translateX(-50%)';
    input.focus();
    dismissPopOnOutsideClick();
  }

  // ── Language ────────────────────────────────────────────────────────────────
  function setLang(next) {
    lang = i18n[next] ? next : 'en';
    try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* ignore */ }
    buildPanel();
  }

  // ── Visibility + hotkey ─────────────────────────────────────────────────────
  function togglePanel() {
    panel.hidden = !panel.hidden;
    const open = !panel.hidden;
    // Highlight the launcher + flip Open/Close while the panel is showing.
    launchBtn.style.boxShadow = open ? 'inset 0 0 0 1px #4fd584' : '';
    launchBtn.style.color = open ? '#fff' : '';
    const lbl = launchBtn.querySelector('span');
    if (lbl) lbl.textContent = open ? t('close') : t('open');
    if (open) {
      panel.classList.remove('camdir-pop'); void panel.offsetWidth; panel.classList.add('camdir-pop');
      syncSliders();
    }
  }
  on(window, 'keydown', (e) => {
    if (e.key !== '`') return;
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    togglePanel(); e.preventDefault();
  });

  // ── Launcher button in the Visualisation & Quality toolbar ──────────────────
  // The camera only responds on the 3D highways (guitar/drum/keys), so the
  // button is shown only when one of those is the active visualization.
  const VIZ_3D = { highway_3d: 1, drum_highway_3d: 1, keys_highway_3d: 1, venue: 1 };
  function is3DHighway() {
    const sel = document.getElementById('viz-picker');
    const v = sel ? sel.value : '';
    // 'auto' resolves to an arrangement-matched viz (almost always a 3D highway
    // here); show the launcher for it too — it's harmless if it resolved to 2D.
    return v === 'auto' || !!VIZ_3D[v];
  }
  function refreshLaunchVisibility() {
    const show = is3DHighway();
    launchRow.style.display = show ? 'flex' : 'none';
    if (!show && !panel.hidden) togglePanel(); // close if the highway went 2D
  }
  let _mountTries = 0;
  function mountLauncher() {
    if (launchRow.isConnected) { refreshLaunchVisibility(); return; }
    const pop = document.getElementById('v3-rail-pop-viz');
    const picker = document.getElementById('viz-picker');
    if (pop) {
      // Add our row to the Visualisation & Quality popover, right after the
      // Visualization row so it sits with the viz/quality controls.
      const vizRow = picker && picker.closest('.v3-pop-row');
      if (vizRow && vizRow.parentElement === pop) vizRow.insertAdjacentElement('afterend', launchRow);
      else pop.appendChild(launchRow);
      refreshLaunchVisibility();
      return;
    }
    // Fallback for non-v3 layouts: drop the row next to the viz picker.
    if (picker && picker.parentElement) {
      picker.insertAdjacentElement('afterend', launchRow);
      refreshLaunchVisibility();
      return;
    }
    // Popover not in the DOM yet — retry briefly (player chrome mounts lazily).
    if (_mountTries++ < 40) setTimeout(mountLauncher, 150);
  }
  // Close the floating panel when the user leaves the highway. highway:visibility
  // tracks the canvas's DOM visibility (offsetParent), so `visible:false` means
  // the highway view was actually navigated away from — not a mere tab switch —
  // and the panel shouldn't linger floating over the library / other screens.
  function onHighwayVisibility(ev) {
    if (ev && ev.visible === false && !panel.hidden) togglePanel();
  }
  on(launchBtn, 'click', togglePanel);
  const _vizSel = document.getElementById('viz-picker');
  if (_vizSel) on(_vizSel, 'change', refreshLaunchVisibility);
  if (window.feedBack && typeof window.feedBack.on === 'function') {
    try {
      window.feedBack.on('viz:renderer:ready', refreshLaunchVisibility);
      window.feedBack.on('highway:visibility', onHighwayVisibility);
    } catch (e) { /* ignore */ }
  }

  // ── Brain subscriptions ─────────────────────────────────────────────────────
  const onChange = (k) => { if (k === API.getEditingKey()) syncSliders(); };
  const onMode = () => { buildPanel(); };
  const onPresets = () => renderPresets();   // shared library — always re-render
  API.on('change', onChange);
  API.on('mode', onMode);
  API.on('presets', onPresets);

  // ── Mount ───────────────────────────────────────────────────────────────────
  document.body.appendChild(root);
  document.body.appendChild(importPicker);
  mountLauncher();
  buildPanel();
  loadLocales().then(() => {
    buildPanel();
    launchLabel.textContent = t('launch');
    launchBtn.querySelector('span').textContent = panel.hidden ? t('open') : t('close');
    launchBtn.title = t('title');
  });

  // ── Teardown handle (called by the brain on re-injection) ───────────────────
  window.__camDirUI = {
    destroy() {
      API.off('change', onChange); API.off('mode', onMode); API.off('presets', onPresets);
      if (window.feedBack && typeof window.feedBack.off === 'function') {
        try {
          window.feedBack.off('viz:renderer:ready', refreshLaunchVisibility);
          window.feedBack.off('highway:visibility', onHighwayVisibility);
        } catch (e) { /* ignore */ }
      }
      closePop();
      // Detach the chip before the panel goes: it also un-hides the panel and
      // drops the "popped out" stub, so a re-injected plugin doesn't leave an
      // orphaned stub pointing at DOM that no longer exists.
      if (paneChipDetach) { try { paneChipDetach(); } catch (e) { /* ignore */ } paneChipDetach = null; }
      for (const [e2, ev, fn, opts] of L) { try { e2.removeEventListener(ev, fn, opts); } catch (e) { /* ignore */ } }
      L.length = 0;
      launchRow.remove();
      root.remove(); importPicker.remove();
    },
  };
})();

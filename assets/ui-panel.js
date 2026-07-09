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
  function buildPanel() {
    panel.innerHTML = '';
    root.style.setProperty('--cd-accent', API.getColor());

    // Player tabs — ONLY in splitscreen (more than one player). Single mode hides them.
    const slots = API.getSlots();
    if (slots.length > 1) {
      const tabs = el('div', 'camdir-tabs');
      slots.forEach((s) => {
        const tab = el('button', 'camdir-tab' + (s.key === API.getEditingKey() ? ' is-active' : ''));
        tab.textContent = `${t('player')} ${s.label}`;
        tab.style.setProperty('--tab', s.color);
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

      // Inverted order ONLY here (the preset row renders under a reversed rule):
      // appending acts-then-name yields name-left / icons-right visually.
      item.append(acts, nm);
      list.appendChild(item);
    }
  }

  // ── Editable value popover ──────────────────────────────────────────────────
  let _pop = null;
  function closePop() { if (_pop) { _pop.remove(); _pop = null; } }
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
    document.body.appendChild(pop); _pop = pop;
    const r = valLabels[key].getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, r.right - 140) + 'px';
    input.focus(); input.select();
    setTimeout(() => {
      const onDoc = (e) => { if (_pop && !_pop.contains(e.target)) { closePop(); window.removeEventListener('pointerdown', onDoc, true); } };
      window.addEventListener('pointerdown', onDoc, true);
    }, 0);
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
    document.body.appendChild(pop); _pop = pop;
    const anchor = panel.querySelector('.camdir-create') || panel;
    const r = anchor.getBoundingClientRect();
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.left = (r.left + r.width / 2) + 'px';
    pop.style.transform = 'translateX(-50%)';
    input.focus();
    setTimeout(() => {
      const onDoc = (e) => { if (_pop && !_pop.contains(e.target)) { closePop(); window.removeEventListener('pointerdown', onDoc, true); } };
      window.addEventListener('pointerdown', onDoc, true);
    }, 0);
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
  const onPresets = (k) => { if (k === API.getEditingKey()) renderPresets(); };
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
      for (const [e2, ev, fn, opts] of L) { try { e2.removeEventListener(ev, fn, opts); } catch (e) { /* ignore */ } }
      L.length = 0;
      launchRow.remove();
      root.remove(); importPicker.remove();
    },
  };
})();

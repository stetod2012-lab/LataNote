/* LataNote appearance: themes (some animated), text size for low vision, readable font, reduced motion */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$;

  // mode: light/dark base · fx: animated background · sw: preview swatches [bg, surface, brand]
  const THEMES = [
    { id: 'classic', name: 'Classic', mode: 'light', sw: ['#f7f7fb', '#ffffff', '#4f46e5'] },
    { id: 'midnight', name: 'Midnight', mode: 'dark', sw: ['#0f1120', '#171a2c', '#818cf8'] },
    { id: 'sepia', name: 'Sepia', mode: 'light', sw: ['#f4ecdf', '#fbf6ee', '#b5651d'] },
    { id: 'forest', name: 'Forest', mode: 'light', sw: ['#eef4ee', '#fbfdfb', '#2f855a'] },
    { id: 'candy', name: 'Candy', mode: 'light', sw: ['#f6f0ff', '#fffdff', '#a855f7'] },
    { id: 'contrast', name: 'High contrast', mode: 'dark', sw: ['#000000', '#000000', '#ffd60a'] },
    { id: 'ocean', name: 'Ocean waves', mode: 'light', fx: 'ocean', sw: ['#e8f4fb', '#ffffff', '#0284c7'] },
    { id: 'sunset', name: 'Sunset glow', mode: 'light', fx: 'sunset', sw: ['#fff3ea', '#fffaf6', '#e8590c'] },
    { id: 'sakura', name: 'Sakura', mode: 'light', fx: 'sakura', sw: ['#fff1f5', '#fffafc', '#db2777'] },
    { id: 'aurora', name: 'Aurora', mode: 'dark', fx: 'aurora', sw: ['#070b1a', '#0f1528', '#5eead4'] },
    { id: 'starry', name: 'Starry night', mode: 'dark', fx: 'starry', sw: ['#0b1026', '#12183a', '#fbbf24'] },
    { id: 'snow', name: 'Snowfall', mode: 'dark', fx: 'snow', sw: ['#0f1b2b', '#16253a', '#7dd3fc'] },
  ];
  const SIZES = [
    { id: 'normal', name: 'Default', z: 1 },
    { id: 'lg', name: 'Large', z: 1.15 },
    { id: 'xl', name: 'Larger', z: 1.3 },
    { id: 'xxl', name: 'Largest', z: 1.5 },
  ];

  const Ap = (LN.appearance = { THEMES, SIZES });
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem('latanote-' + k); localStorage.setItem('latanote-' + k, v); } catch (e) { return null; } return null; };

  Ap.get = () => ({
    theme: store('skin') || (store('theme') === 'dark' ? 'midnight' : 'classic'),
    size: store('textsize') || 'normal',
    font: store('font') || 'default',
    motion: store('motion') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full'),
  });
  Ap.zoom = () => (SIZES.find((s) => s.id === Ap.get().size) || SIZES[0]).z;

  /* ---------- animated layers ---------- */
  const buildFx = (fx) => {
    let el = $('#fx');
    if (!el) { el = document.createElement('div'); el.id = 'fx'; el.setAttribute('aria-hidden', 'true'); document.body.prepend(el); }
    el.className = fx ? 'fx-' + fx : '';
    el.innerHTML = '';
    if (fx === 'sakura' || fx === 'snow') {
      const n = fx === 'snow' ? 46 : 26;
      let html = '';
      for (let i = 0; i < n; i++) {
        const size = fx === 'snow' ? 3 + Math.random() * 6 : 9 + Math.random() * 9;
        const dur = (fx === 'snow' ? 9 : 12) + Math.random() * 12;
        html += `<i style="left:${Math.random() * 100}%;width:${size}px;height:${size * (fx === 'snow' ? 1 : 0.8)}px;animation-duration:${dur}s,${3 + Math.random() * 4}s;animation-delay:-${Math.random() * dur}s,-${Math.random() * 4}s;opacity:${0.45 + Math.random() * 0.5}"></i>`;
      }
      el.innerHTML = html;
    } else if (fx === 'starry') {
      el.innerHTML = '<span class="shoot"></span><span class="shoot s2"></span>';
    } else if (fx === 'ocean') {
      el.innerHTML = '<span class="wave w1"></span><span class="wave w2"></span><span class="wave w3"></span>';
    }
  };

  Ap.apply = () => {
    const cfg = Ap.get();
    const t = THEMES.find((x) => x.id === cfg.theme) || THEMES[0];
    const root = document.documentElement;
    root.dataset.theme = t.mode;
    root.dataset.skin = t.id;
    if (t.fx) root.dataset.fx = t.fx; else delete root.dataset.fx;
    root.dataset.text = cfg.size;
    root.style.setProperty('--uiz', Ap.zoom());
    root.dataset.font = cfg.font;
    root.classList.toggle('reduce-motion', cfg.motion === 'reduce');
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t.sw[1];
    if (cfg.font === 'readable' && !$('#font-readable')) {
      const l = document.createElement('link');
      l.id = 'font-readable'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
      document.head.appendChild(l);
    }
    if (document.body) buildFx(t.fx && cfg.motion !== 'reduce' ? t.fx : (t.fx ? t.fx + ' still' : ''));
    const tb = $('#theme-toggle'); if (tb) tb.innerHTML = LN.icon('palette');
    window.dispatchEvent(new Event('resize'));
  };
  Ap.set = (k, v) => { store(k, v); if (k === 'skin') store('theme', (THEMES.find((x) => x.id === v) || {}).mode || 'light'); Ap.apply(); };

  /* ---------- picker ---------- */
  Ap.open = () => {
    const cfg = Ap.get();
    const tile = (t) => `<button class="th-tile ${cfg.theme === t.id ? 'on' : ''}" data-ap-theme="${t.id}" aria-pressed="${cfg.theme === t.id}">
      <span class="th-prev th-${t.id}" style="--b:${t.sw[0]};--s:${t.sw[1]};--a:${t.sw[2]}"><span class="th-side"></span><span class="th-card"><i></i><i></i><b></b></span>${t.fx ? '<span class="th-anim">✦</span>' : ''}</span>
      <span class="th-name">${t.name}</span></button>`;
    const body = LN.panel(`
      <h3>${LN.icon('palette')} Appearance</h3>
      <h4 class="pp-h">Theme</h4>
      <div class="th-grid">${THEMES.filter((t) => !t.fx).map(tile).join('')}</div>
      <h4 class="pp-h">Animated themes</h4>
      <div class="th-grid">${THEMES.filter((t) => t.fx).map(tile).join('')}</div>
      <h4 class="pp-h">Text size</h4>
      <div class="seg size-seg">${SIZES.map((s) => `<button class="seg-btn ${cfg.size === s.id ? 'active' : ''}" data-ap-size="${s.id}"><span style="font-size:${0.75 * s.z}rem">A</span> ${s.name}</button>`).join('')}</div>
      <p class="muted small">Makes all text, buttons and menus bigger. Note pages also get bigger; zoom them with the % button or Ctrl+scroll.</p>
      <label class="set-row"><input type="checkbox" data-ap-font ${cfg.font === 'readable' ? 'checked' : ''}><span><b>Easy-to-read font</b><small>Atkinson Hyperlegible, designed for readers with low vision</small></span></label>
      <label class="set-row"><input type="checkbox" data-ap-motion ${cfg.motion === 'reduce' ? 'checked' : ''}><span><b>Reduce motion</b><small>Pause animated themes and interface animations</small></span></label>
      <div class="dlg-actions"><button class="btn btn-primary" data-close>Done</button></div>`, 'wide');
    body.onclick = (e) => {
      const b = e.target.closest('[data-ap-theme], [data-ap-size]'); if (!b) return;
      if (b.dataset.apTheme) Ap.set('skin', b.dataset.apTheme);
      else Ap.set('textsize', b.dataset.apSize);
      Ap.open();
    };
    body.onchange = (e) => {
      if (e.target.matches('[data-ap-font]')) Ap.set('font', e.target.checked ? 'readable' : 'default');
      if (e.target.matches('[data-ap-motion]')) Ap.set('motion', e.target.checked ? 'reduce' : 'full');
    };
  };

  // quick light/dark flip (keeps your theme family where possible)
  Ap.toggleDark = () => {
    const cur = THEMES.find((t) => t.id === Ap.get().theme) || THEMES[0];
    Ap.set('skin', cur.mode === 'dark' ? 'classic' : 'midnight');
  };

  Ap.apply();
  document.addEventListener('DOMContentLoaded', Ap.apply);
})();

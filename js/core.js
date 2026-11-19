/* LataNote core: storage, state, helpers, icons, dialogs */
(function () {
  'use strict';
  const LN = (window.LN = window.LN || {});

  /* ---------- helpers ---------- */
  LN.$ = (sel, root = document) => root.querySelector(sel);
  LN.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  LN.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  LN.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LN.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  LN.ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  LN.parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  LN.fmtDur = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(r).padStart(2, '0'); };
  LN.relTime = (ts) => {
    const d = Date.now() - ts, m = 60e3, h = 60 * m, day = 24 * h;
    if (d < m) return 'just now';
    if (d < h) return Math.floor(d / m) + 'm ago';
    if (d < day) return Math.floor(d / h) + 'h ago';
    if (d < 7 * day) return Math.floor(d / day) + 'd ago';
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  LN.download = (name, data, type = 'text/plain') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  LN.safeName = (s) => (s || 'note').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'note';
  LN.htmlToText = (html) => {
    const withBreaks = String(html || '')
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr|table|ul|ol)>/gi, '\n')
      .replace(/<\/(td|th)>/gi, ' \t ');
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    return (doc.body.textContent || '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  };
  LN.noteText = (note) => (note ? note.pages.map((p) => LN.htmlToText(p.html) + (p.ocr ? '\n' + p.ocr : '')).join('\n') : '');

  /* ---------- storage (IndexedDB with localStorage fallback) ---------- */
  LN.db = (() => {
    let dbp = null;
    const open = () => {
      if (!dbp) {
        dbp = new Promise((res, rej) => {
          if (!('indexedDB' in window)) return rej(new Error('no idb'));
          const r = indexedDB.open('latanote', 1);
          r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blobs'); };
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      return dbp;
    };
    const run = async (store, mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => res(req && req.result);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    };
    return {
      async get(key, store = 'kv') {
        try { return await run(store, 'readonly', (s) => s.get(key)); }
        catch (e) { if (store === 'kv') { const v = localStorage.getItem('ln:' + key); return v ? JSON.parse(v) : undefined; } throw e; }
      },
      async set(key, val, store = 'kv') {
        try { return await run(store, 'readwrite', (s) => s.put(val, key)); }
        catch (e) { if (store === 'kv') { localStorage.setItem('ln:' + key, JSON.stringify(val)); return; } throw e; }
      },
      async del(key, store = 'kv') {
        try { return await run(store, 'readwrite', (s) => s.delete(key)); } catch (e) { /* ignore */ }
      },
    };
  })();

  /* ---------- state ---------- */
  LN.PAGE_W = 816;
  LN.PAGE_H = 1056;
  LN.NB_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#e11d48', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'];

  LN.state = { notebooks: [], notes: [], events: [], settings: { penOnly: false }, ui: {} };
  LN.newPage = (html = '') => ({ id: LN.uid(), html, strokes: [], bg: null, bgH: 0 });
  LN.newNote = (notebookId, title = '') => {
    const now = Date.now();
    return { id: LN.uid(), notebookId, title, paper: 'lined', created: now, updated: now, pages: [LN.newPage()], recordings: [], cards: [] };
  };
  LN.getNote = (id) => LN.state.notes.find((n) => n.id === id);
  LN.getNotebook = (id) => LN.state.notebooks.find((n) => n.id === id);

  const saveIndicator = () => LN.$('#save-state');
  const persist = LN.debounce(async () => {
    try {
      await LN.db.set('state', LN.state);
      const el = saveIndicator(); if (el) { el.textContent = 'Saved'; el.classList.remove('dirty'); }
    } catch (e) {
      console.error(e);
      LN.toast('Could not save. Storage may be full.');
    }
  }, 500);
  LN.save = () => { const el = saveIndicator(); if (el) { el.textContent = 'Saving…'; el.classList.add('dirty'); } persist(); };
  LN.touch = (note) => { if (note) note.updated = Date.now(); LN.save(); LN.emit('notes-changed'); };

  LN.load = async () => {
    let s;
    try { s = await LN.db.get('state'); } catch (e) { console.warn(e); }
    if (s && s.notebooks) {
      LN.state = Object.assign(LN.state, s);
      LN.state.settings = Object.assign({ penOnly: false }, s.settings);
      LN.state.ui = s.ui || {};
    }
    LN.state.trash = LN.state.trash || [];
    LN.cleanSamples();
    LN.save();
  };

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  LN.on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
  LN.emit = (ev, data) => (handlers[ev] || []).forEach((fn) => fn(data));

  /* ---------- icons ---------- */
  const P = {
    pen: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
    highlighter: 'm9 11-6 6v3h9l3-3|m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
    eraser: 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21|M22 21H7|m5 11 9 9',
    line: 'M5 19 19 5',
    arrow: 'M5 19 19 5|M9 5h10v10',
    rect: 'M4 5h16v14H4z',
    ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
    undo: 'M9 14 4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'm15 14 5-5-5-5|M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    type: 'M4 7V4h16v3|M9 20h6|M12 4v16',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v3',
    stop: 'M7 7h10v10H7z',
    play: 'M7 4.5v15l12-7.5z',
    pause: 'M8 5h3v14H8z|M14 5h3v14h-3z',
    sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z|M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
    present: 'M2 4h20|M4 4v11h16V4|M12 15v4|M8 21l4-2 4 2',
    plus: 'M12 5v14|M5 12h14',
    trash: 'M3 6h18|M8 6V4h8v2|M19 6l-1 14H6L5 6|M10 11v5|M14 11v5',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z|M21 21l-4.3-4.3',
    calendar: 'M3 6h18v15H3z|M3 10h18|M8 3v4|M16 3v4',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z|M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
    image: 'M3 5h18v14H3z|M3 16l5-5 5 5|M14 14l2-2 5 5|M15.5 8.5h.01',
    filepdf: 'M14 3H6v18h12V7z|M14 3v4h4|M9 13h6|M9 17h4',
    pageplus: 'M14 3H6v18h12V7z|M14 3v4h4|M12 11v6|M9 14h6',
    upload: 'M12 15V3|M7 8l5-5 5 5|M4 15v6h16v-6',
    download: 'M12 3v12|M7 10l5 5 5-5|M4 17v4h16v-4',
    more: 'M5 12h.01|M12 12h.01|M19 12h.01',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4',
    menu: 'M4 6h16|M4 12h16|M4 18h16',
    x: 'M6 6l12 12|M18 6 6 18',
    list: 'M9 6h12|M9 12h12|M9 18h12|M4 6h.01|M4 12h.01|M4 18h.01',
    olist: 'M10 6h11|M10 12h11|M10 18h11|M4 4h1v4|M4 14h2l-2 3h2',
    checksquare: 'M4 4h16v16H4z|M8 12l3 3 5-6',
    check: 'M5 12l5 5L20 7',
    table: 'M3 4h18v16H3z|M3 10h18|M3 15h18|M9 4v16|M15 4v16',
    link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1|M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    clear: 'M4 7V4h16v3|M9 20h6|M12 4v16|M4 20 20 4',
    alignleft: 'M4 6h16|M4 12h10|M4 18h14',
    aligncenter: 'M4 6h16|M7 12h10|M5 18h14',
    printer: 'M6 9V3h12v6|M6 18H4v-7h16v7h-2|M6 14h12v7H6z',
    share: 'M4 12v8h16v-8|M16 6l-4-4-4 4|M12 2v13',
    copy: 'M9 9h11v11H9z|M5 15H4V4h11v1',
    folder: 'M3 6h6l2 2h10v11H3z',
    chevleft: 'M15 6l-6 6 6 6',
    chevright: 'M9 6l6 6-6 6',
    laser: 'M12 12h.01|M12 4v3|M12 17v3|M4 12h3|M17 12h3|M6.3 6.3l2 2|M15.7 15.7l2 2|M6.3 17.7l2-2|M15.7 8.3l2-2',
    lock: 'M5 11h14v10H5z|M8 11V7a4 4 0 0 1 8 0v4',
    edit: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
    note: 'M14 3H6v18h12V7z|M14 3v4h4|M9 13h6|M9 17h6',
    cards: 'M3 8h14v12H3z|M7 4h14v12',
    shuffle: 'M16 3h5v5|M4 20 21 3|M21 16v5h-5|M15 15l6 6|M4 4l5 5',
    link2: 'M9 17H7a5 5 0 0 1 0-10h2|M15 7h2a5 5 0 0 1 0 10h-2|M8 12h8',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z|M12 7v5l3 2',
    install: 'M12 3v11|M7 9l5 5 5-5|M5 19h14',
    maximize: 'M8 3H3v5|M16 3h5v5|M8 21H3v-5|M16 21h5v-5',
    minimize: 'M3 8h5V3|M21 8h-5V3|M3 16h5v5|M21 16h-5v5',
    pin: 'M12 17v5|M9 3h6l-1 6 4 4H6l4-4z',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M2 21v-1a6 6 0 0 1 12 0v1|M16 3.5a4 4 0 0 1 0 7|M22 21v-1a6 6 0 0 0-4-5.6',
    scan: 'M3 7V3h4|M17 3h4v4|M21 17v4h-4|M7 21H3v-4|M7 12h10|M7 8h6|M7 16h8',
    volume: 'M11 5 6 9H2v6h4l5 4z|M15.5 8.5a5 5 0 0 1 0 7|M19 5a10 10 0 0 1 0 14',
    lasso: 'M7 22a5 5 0 0 1-2-4|M3.3 14A7 7 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1|M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8|M21 3v5h-5',
    restore: 'M3 12a9 9 0 1 0 3-6.7L3 8|M3 3v5h5',
    send: 'M22 2 11 13|M22 2l-7 20-4-9-9-4z',
    keyboard: 'M3 6h18v12H3z|M7 10h.01|M11 10h.01|M15 10h.01|M7 14h10',
    devices: 'M4 5h12v9H4z|M2 18h16|M18 9h4v11h-4z',
  };
  LN.icon = (name, cls = '') => {
    const d = P[name] || P.note;
    const sw = name === 'more' ? ' style="stroke-width:3"' : '';
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"${sw}>${d.split('|').map((p) => `<path d="${p}"/>`).join('')}</svg>`;
  };
  LN.hydrateIcons = (root = document) => {
    LN.$$('i[data-icon]', root).forEach((el) => { el.outerHTML = LN.icon(el.dataset.icon); });
  };

  /* ---------- toast & dialogs ---------- */
  let toastT;
  LN.toast = (msg) => {
    const t = LN.$('#toast'); if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  };

  // opts: {title, message, input:{value,placeholder}, select:{options:[{value,label}],value}, colors:[...], color, ok, danger}
  LN.dialog = (opts) => new Promise((resolve) => {
    const dlg = LN.$('#dlg');
    const input = LN.$('#dlg-input'), sel = LN.$('#dlg-select'), colors = LN.$('#dlg-colors'), ok = LN.$('#dlg-ok');
    LN.$('#dlg-title').textContent = opts.title || '';
    const msg = LN.$('#dlg-msg'); msg.textContent = opts.message || ''; msg.hidden = !opts.message;
    input.hidden = !opts.input; input.value = opts.input?.value || ''; input.placeholder = opts.input?.placeholder || ''; input.required = !!opts.input;
    sel.hidden = !opts.select;
    sel.innerHTML = (opts.select?.options || []).map((o) => `<option value="${LN.esc(o.value)}">${LN.esc(o.label)}</option>`).join('');
    if (opts.select?.value) sel.value = opts.select.value;
    let color = opts.color || null;
    colors.hidden = !opts.colors;
    colors.innerHTML = (opts.colors || []).map((c) => `<button type="button" class="dc ${c === color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('');
    colors.onclick = (e) => { const b = e.target.closest('.dc'); if (!b) return; color = b.dataset.c; LN.$$('.dc', colors).forEach((x) => x.classList.toggle('on', x === b)); };
    ok.textContent = opts.ok || 'OK';
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      resolve({ value: input.value.trim(), select: sel.value, color });
    };
    dlg.showModal();
    if (opts.input) setTimeout(() => { input.focus(); input.select(); }, 30);
  });
  LN.confirm = async (title, message, ok = 'Delete') => !!(await LN.dialog({ title, message, ok, danger: true }));
  LN.prompt = async (title, value = '', placeholder = '') => { const r = await LN.dialog({ title, input: { value, placeholder } }); return r ? r.value : null; };

  /* ---------- remove the sample content older versions created ---------- */
  LN.cleanSamples = () => {
    if (LN.state.ui.samplesRemoved) return;
    LN.state.ui.samplesRemoved = true;
    const SAMPLE_NOTES = {
      'Welcome to LataNote 👋': 'Here’s a quick tour',
      'Cell structure & organelles': 'The cell is the basic unit of life',
      'Photosynthesis': 'Photosynthesis is the process by which plants, algae',
      'The French Revolution': 'period of political and social upheaval',
    };
    const SAMPLE_NBS = ['Biology 101', 'World History', 'Personal'];
    const SAMPLE_EVENTS = ['Biology lecture', 'Review photosynthesis flashcards', 'History seminar', 'Biology midterm', 'Essay draft due'];
    const isSample = (n) => SAMPLE_NOTES[n.title] && n.pages.length === 1 && !n.recordings.length && n.pages[0].html.includes(SAMPLE_NOTES[n.title]);
    const before = LN.state.notes.length;
    LN.state.notes = LN.state.notes.filter((n) => !isSample(n));
    LN.state.notebooks = LN.state.notebooks.filter((nb) => !SAMPLE_NBS.includes(nb.name) || LN.state.notes.some((n) => n.notebookId === nb.id));
    LN.state.events = LN.state.events.filter((e) => !SAMPLE_EVENTS.includes(e.title));
    if (LN.state.ui.noteId && !LN.getNote(LN.state.ui.noteId)) LN.state.ui.noteId = null;
    if (LN.state.ui.notebookId && !LN.getNotebook(LN.state.ui.notebookId)) LN.state.ui.notebookId = null;
    return before !== LN.state.notes.length;
  };
})();

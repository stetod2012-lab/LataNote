/* LataNote editor: pages, text layer, ink layer, formatting, imports */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;
  const ZOOMS = [0.5, 0.67, 0.75, 0.85, 1, 1.1, 1.25, 1.5, 1.75, 2];

  const E = (LN.editor = {
    note: null, mode: 'type', zoom: 1, fit: true,
    pages: [], undo: [], redo: [], range: null,
  });

  E.inkHost = {
    isDraw: () => E.mode === 'draw',
    commit(pg, before) {
      E.undo.push({ pg, strokes: before });
      if (E.undo.length > 200) E.undo.shift();
      E.redo = [];
      E.updateUndoButtons();
      LN.touch(E.note);
    },
  };

  /* ---------- open / render ---------- */
  E.open = (id) => {
    const note = id ? LN.getNote(id) : null;
    E.note = note; E.undo = []; E.redo = []; E.range = null;
    LN.state.ui.noteId = note ? note.id : null; LN.save();
    document.body.classList.toggle('no-note', !note);
    $('#empty').hidden = !!note;
    if (LN.audio) LN.audio.stopPlayback();
    if (!note) { $('#pages').innerHTML = ''; E.pages = []; LN.emit('note-opened', null); return; }
    $('#note-title').value = note.title;
    E.renderChip();
    $('#paper-select').value = note.paper;
    E.renderPages();
    $('#pages-area').scrollTop = 0;
    E.updateUndoButtons();
    LN.emit('note-opened', note);
  };

  E.renderChip = () => {
    const nb = E.note && LN.getNotebook(E.note.notebookId);
    const chip = $('#nb-chip');
    chip.textContent = nb ? nb.name : 'No notebook';
    chip.style.setProperty('--c', nb ? nb.color : '#94a3b8');
  };

  E.renderPages = () => {
    const host = $('#pages');
    host.innerHTML = '';
    E.pages = E.note.pages.map((pg, i) => {
      const rec = E.pageEl(pg, i, E.note.pages.length);
      host.appendChild(rec.block);
      return rec;
    });
    E.computeFit();
    E.pages.forEach(E.layout);
  };

  E.pageEl = (pg, i, total) => {
    const block = document.createElement('div'); block.className = 'page-block';
    const meta = document.createElement('div'); meta.className = 'page-meta';
    meta.innerHTML = `<span>Page ${i + 1} of ${total}</span>
      <button class="icon-btn sm" data-page-cmd="up" title="Move page up" ${i === 0 ? 'disabled' : ''}>${LN.icon('chevleft', 'rot90')}</button>
      <button class="icon-btn sm" data-page-cmd="down" title="Move page down" ${i === total - 1 ? 'disabled' : ''}>${LN.icon('chevright', 'rot90')}</button>
      <button class="icon-btn sm" data-page-cmd="delete" title="Delete page">${LN.icon('trash')}</button>`;
    meta.addEventListener('click', (e) => { const b = e.target.closest('[data-page-cmd]'); if (b) E.pageCmd(b.dataset.pageCmd, i); });

    const wrap = document.createElement('div'); wrap.className = 'page-wrap';
    const page = document.createElement('div');
    page.className = 'page paper-' + (pg.bg ? 'blank' : E.note.paper) + (pg.bg ? ' has-bg' : '');
    if (pg.bg) {
      const img = document.createElement('img'); img.className = 'page-bg'; img.src = pg.bg; img.alt = ''; img.draggable = false;
      page.appendChild(img);
    }
    const text = document.createElement('div');
    text.className = 'page-text';
    text.contentEditable = E.mode === 'type' ? 'true' : 'false';
    text.spellcheck = true;
    text.innerHTML = pg.html;
    if (pg.bg) text.style.minHeight = pg.bgH + 'px';
    if (i === 0) text.dataset.placeholder = 'Start typing here, or switch to Draw and write by hand…';
    text.addEventListener('input', () => { pg.html = text.innerHTML; LN.touch(E.note); });
    text.addEventListener('click', (e) => {
      const li = e.target.closest('ul.checklist > li');
      if (li && e.clientX < li.getBoundingClientRect().left) { li.classList.toggle('done'); pg.html = text.innerHTML; LN.touch(E.note); return; }
      const a = e.target.closest('a[href]');
      if (a && (e.ctrlKey || e.metaKey || E.mode !== 'type')) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
    });
    const canvas = document.createElement('canvas'); canvas.className = 'page-ink';
    page.append(text, canvas);
    wrap.appendChild(page);
    block.append(meta, wrap);

    const rec = { pg, block, wrap, page, text, canvas, ink: new LN.Ink(canvas, pg, E.inkHost) };
    new ResizeObserver(() => E.layout(rec)).observe(page);
    return rec;
  };

  E.layout = (rec) => {
    const w = rec.page.offsetWidth, h = rec.page.offsetHeight, z = E.zoom;
    if (!w) return;
    rec.page.style.transform = `scale(${z})`;
    rec.wrap.style.width = w * z + 'px';
    rec.wrap.style.height = h * z + 'px';
    rec.ink.resize(w, h, Math.min(3, (window.devicePixelRatio || 1) * z));
  };

  E.computeFit = () => {
    if (!E.fit) return;
    const area = $('#pages-area');
    const avail = area.clientWidth - (area.clientWidth < 700 ? 16 : 64);
    E.zoom = Math.max(0.3, Math.min(1, avail / LN.PAGE_W));
    E.updateZoomLabel();
  };
  E.setZoom = (dir) => {
    if (dir === 0) { E.fit = true; E.computeFit(); }
    else {
      E.fit = false;
      const idx = ZOOMS.findIndex((z) => z >= E.zoom - 0.001);
      let next = dir > 0 ? ZOOMS.find((z) => z > E.zoom + 0.001) : [...ZOOMS].reverse().find((z) => z < E.zoom - 0.001);
      E.zoom = next || (idx < 0 ? ZOOMS[ZOOMS.length - 1] : E.zoom);
    }
    E.updateZoomLabel();
    E.pages.forEach(E.layout);
  };
  E.updateZoomLabel = () => { $('#zoom-label').textContent = Math.round(E.zoom * 100) + '%'; };

  E.redrawInk = () => E.pages.forEach((r) => r.ink.render());

  /* ---------- mode ---------- */
  E.setMode = (m) => {
    E.mode = m;
    document.body.classList.toggle('mode-draw', m === 'draw');
    document.body.classList.toggle('mode-type', m === 'type');
    $$('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
    E.pages.forEach((r) => { r.text.contentEditable = m === 'type' ? 'true' : 'false'; });
    if (m === 'draw' && document.activeElement && document.activeElement.classList.contains('page-text')) document.activeElement.blur();
  };

  /* ---------- undo / redo (ink) ---------- */
  E.updateUndoButtons = () => {
    $('#undo-btn').disabled = !E.undo.length;
    $('#redo-btn').disabled = !E.redo.length;
  };
  E.doUndo = () => {
    const u = E.undo.pop(); if (!u) return;
    E.redo.push({ pg: u.pg, strokes: u.pg.strokes });
    u.pg.strokes = u.strokes;
    E.redrawInk(); E.updateUndoButtons(); LN.touch(E.note);
  };
  E.doRedo = () => {
    const r = E.redo.pop(); if (!r) return;
    E.undo.push({ pg: r.pg, strokes: r.pg.strokes });
    r.pg.strokes = r.strokes;
    E.redrawInk(); E.updateUndoButtons(); LN.touch(E.note);
  };

  /* ---------- text formatting ---------- */
  const textHost = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el ? el.closest('.page-text') : null;
  };
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (!s.rangeCount || !textHost(s.anchorNode)) return;
    E.range = s.getRangeAt(0).cloneRange();
    const el = s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement;
    const blk = el.closest('h1,h2,h3,blockquote,pre,p,li,div.page-text');
    const tag = blk ? blk.tagName.toLowerCase() : 'p';
    $('#block-select').value = ['h1', 'h2', 'h3', 'blockquote', 'pre'].includes(tag) ? tag : 'p';
  });
  E.restoreRange = () => {
    if (!E.range || !document.contains(E.range.startContainer)) return false;
    const host = textHost(E.range.startContainer); if (!host) return false;
    host.focus({ preventScroll: true });
    const s = getSelection(); s.removeAllRanges(); s.addRange(E.range);
    return true;
  };
  E.focusEnd = () => {
    const rec = E.pages[E.pages.length - 1]; if (!rec) return false;
    rec.text.focus();
    const r = document.createRange(); r.selectNodeContents(rec.text); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    return true;
  };
  E.syncText = () => {
    E.pages.forEach((r) => { if (r.pg.html !== r.text.innerHTML) r.pg.html = r.text.innerHTML; });
    LN.touch(E.note);
  };
  E.exec = (cmd, arg = null) => {
    if (!E.note) return;
    if (E.mode !== 'type') E.setMode('type');
    if (!E.restoreRange()) E.focusEnd();
    document.execCommand('styleWithCSS', false, ['foreColor', 'hiliteColor'].includes(cmd));
    if (cmd === 'hiliteColor') {
      // toggle highlight off if already highlighted
      const s = getSelection();
      const el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const bg = el && getComputedStyle(el).backgroundColor;
      if (bg && bg.replace(/\s/g, '') === 'rgb(253,230,138)') arg = 'transparent';
    }
    document.execCommand(cmd, false, arg);
    E.syncText();
  };
  E.insertHTML = (html) => {
    if (E.mode !== 'type') E.setMode('type');
    if (!E.restoreRange()) E.focusEnd();
    document.execCommand('insertHTML', false, html);
    E.syncText();
  };

  E.checklist = () => {
    if (E.mode !== 'type') E.setMode('type');
    if (!E.restoreRange()) E.focusEnd();
    const s = getSelection();
    const el = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    let ul = el && el.closest('.page-text ul');
    if (ul) ul.classList.toggle('checklist');
    else {
      document.execCommand('insertUnorderedList');
      const s2 = getSelection();
      const el2 = s2.anchorNode && (s2.anchorNode.nodeType === 1 ? s2.anchorNode : s2.anchorNode.parentElement);
      ul = el2 && el2.closest('.page-text ul');
      if (ul) ul.classList.add('checklist');
    }
    E.syncText();
  };

  E.table = () => {
    const cells = (tag) => `<tr>${[1, 2, 3].map(() => `<${tag}><br></${tag}>`).join('')}</tr>`;
    E.insertHTML(`<table><thead>${cells('th')}</thead><tbody>${cells('td')}${cells('td')}</tbody></table><p><br></p>`);
  };

  E.link = async () => {
    const saved = E.range && E.range.cloneRange();
    const text = saved ? saved.toString() : '';
    let url = await LN.prompt('Insert link', 'https://', 'https://example.com');
    if (!url) return;
    if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
    E.range = saved;
    if (text) E.exec('createLink', url);
    else E.insertHTML(`<a href="${LN.esc(url)}">${LN.esc(url)}</a>&nbsp;`);
  };

  /* ---------- images & PDF ---------- */
  const readAsDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const downscale = async (file, maxW, type = 'image/jpeg') => {
    const img = await loadImg(await readAsDataURL(file));
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0, c.width, c.height);
    return { url: c.toDataURL(type, 0.86), w: c.width, h: c.height };
  };

  E.insertImageFile = async (file) => {
    if (!file || !E.note) return;
    try {
      const { url } = await downscale(file, 1400, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
      E.insertHTML(`<img src="${url}" alt="">`);
    } catch (e) { LN.toast('Could not read that image.'); }
  };

  const pageIsEmpty = (pg) => !pg.bg && !pg.strokes.length && !LN.htmlToText(pg.html) && !/<img/i.test(pg.html);

  E.addBgPages = (list) => {
    const pages = E.note.pages;
    if (pages.length === 1 && pageIsEmpty(pages[0])) pages.length = 0;
    list.forEach(({ url, h }) => { const p = LN.newPage(); p.bg = url; p.bgH = Math.round(h); pages.push(p); });
    LN.touch(E.note);
    const first = pages.length - list.length;
    E.renderPages();
    requestAnimationFrame(() => E.pages[first] && E.pages[first].block.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  let pdfjsP = null;
  const loadPdfJs = () => {
    if (!pdfjsP) {
      pdfjsP = new Promise((res, rej) => {
        if (window.pdfjsLib) return res(window.pdfjsLib);
        const s = document.createElement('script');
        s.src = 'js/vendor/pdfjs/pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdfjs/pdf.worker.min.js'; res(window.pdfjsLib); };
        s.onerror = () => { pdfjsP = null; rej(new Error('pdf.js failed to load')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsP;
  };

  E.importFile = async (file) => {
    if (!file || !E.note) return;
    if (file.type.startsWith('image/')) {
      const { url, w, h } = await downscale(file, LN.PAGE_W * 2);
      E.addBgPages([{ url, h: (h / w) * LN.PAGE_W }]);
      LN.toast('Image added as a page. Switch to Draw to annotate it.');
      return;
    }
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { LN.toast('Choose a PDF or image file.'); return; }
    try {
      LN.toast('Opening PDF…');
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const n = Math.min(doc.numPages, 80);
      const out = [];
      for (let i = 1; i <= n; i++) {
        LN.toast(`Importing page ${i} of ${n}…`);
        const page = await doc.getPage(i);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (LN.PAGE_W * 2) / v1.width });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        out.push({ url: c.toDataURL('image/jpeg', 0.82), h: (vp.height / vp.width) * LN.PAGE_W });
      }
      if (!E.note.title || E.note.title === 'Untitled note') { E.note.title = file.name.replace(/\.pdf$/i, ''); $('#note-title').value = E.note.title; }
      E.addBgPages(out);
      LN.toast(doc.numPages > n ? `Imported the first ${n} of ${doc.numPages} pages.` : `Imported ${n} page${n > 1 ? 's' : ''}. Switch to Draw to annotate.`);
    } catch (e) {
      console.error(e);
      LN.toast('Could not import that PDF.');
    }
  };

  /* ---------- page commands ---------- */
  E.addPage = () => {
    if (!E.note) return;
    E.note.pages.push(LN.newPage());
    LN.touch(E.note);
    E.renderPages();
    const last = E.pages[E.pages.length - 1];
    requestAnimationFrame(() => last.block.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  E.pageCmd = async (cmd, i) => {
    const pages = E.note.pages;
    if (cmd === 'delete') {
      if (pages.length === 1) {
        if (!(await LN.confirm('Clear this page?', 'This is the only page, so its text and ink will be cleared.', 'Clear'))) return;
        pages[0] = LN.newPage();
      } else {
        if (!pageIsEmpty(pages[i]) && !(await LN.confirm(`Delete page ${i + 1}?`, 'Its text, ink and background will be removed.'))) return;
        pages.splice(i, 1);
      }
    } else if (cmd === 'up' && i > 0) [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]];
    else if (cmd === 'down' && i < pages.length - 1) [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]];
    E.undo = []; E.redo = []; E.updateUndoButtons();
    LN.touch(E.note);
    const y = $('#pages-area').scrollTop;
    E.renderPages();
    $('#pages-area').scrollTop = y;
  };

  E.clearInk = async () => {
    if (!E.note) return;
    if (!(await LN.confirm('Clear all ink?', 'Removes every pen stroke, highlight and shape in this note. You can undo this.', 'Clear ink'))) return;
    E.note.pages.forEach((pg) => { if (pg.strokes.length) { E.undo.push({ pg, strokes: pg.strokes }); pg.strokes = []; } });
    E.redo = []; E.updateUndoButtons();
    E.redrawInk(); LN.touch(E.note);
  };

  E.setPaper = (paper) => {
    if (!E.note) return;
    E.note.paper = paper;
    E.pages.forEach((r) => { if (!r.pg.bg) r.page.className = 'page paper-' + paper; });
    LN.touch(E.note);
  };

  /* Snapshot of a page for presenting / exporting: html with ink as an image */
  E.snapshot = (rec) => ({
    html: rec.pg.html,
    bg: rec.pg.bg,
    paper: rec.pg.bg ? 'blank' : E.note.paper,
    w: rec.page.offsetWidth,
    h: rec.page.offsetHeight,
    ink: rec.pg.strokes.length ? E.inkPNG(rec) : null,
  });
  E.inkPNG = (rec, res = 2) => {
    const c = document.createElement('canvas');
    const w = rec.page.offsetWidth, h = rec.page.offsetHeight;
    c.width = w * res; c.height = h * res;
    LN.renderStrokes(c, rec.pg.strokes, w, h, res, null, null);
    return c.toDataURL('image/png');
  };

  window.addEventListener('resize', LN.debounce(() => { if (E.fit && E.note) { E.computeFit(); E.pages.forEach(E.layout); } }, 120));
})();

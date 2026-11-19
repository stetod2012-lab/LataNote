/* LataNote editor: pages, text layer, ink layer, formatting, imports */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;
  const ZOOMS = [0.3, 0.4, 0.5, 0.67, 0.75, 0.85, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const ZMIN = 0.3, ZMAX = 4;

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
      if (!$('#templates').hidden) E.renderTemplates();
    },
  };

  /* ---------- open / render ---------- */
  E.open = (id) => {
    const note = id ? LN.getNote(id) : null;
    if (LN.inkSel) LN.inkSel.clearSel();
    E.note = note; E.undo = []; E.redo = []; E.range = null;
    LN.state.ui.noteId = note ? note.id : null; LN.save();
    document.body.classList.toggle('no-note', !note);
    $('#empty').hidden = !!note;
    if (LN.audio) LN.audio.stopPlayback();
    if (!note) {
      const any = LN.state.notes.length > 0;
      $('#empty-title').textContent = any ? 'No note open' : 'Your library is empty';
      $('#empty-msg').textContent = any ? 'Open a note from the library, or create a new one.' : 'Create your first note to start writing, drawing, recording and studying.';
      $('#templates').hidden = true;
    }
    if (!note) { $('#pages').innerHTML = ''; E.pages = []; LN.emit('note-opened', null); return; }
    $('#note-title').value = note.title;
    E.renderChip();
    E.updatePaperLabel();
    E.renderPages();
    $('#pages-area').scrollTop = 0;
    E.updateUndoButtons();
    LN.emit('note-opened', note);
  };

  // the back button shows where the note lives ("‹ Biology")
  E.renderChip = () => {
    const lbl = $('#back-label'), btn = $('#back-btn'); if (!lbl) return;
    const path = E.note && E.note.notebookId && LN.lib ? LN.lib.path(E.note.notebookId) : [];
    const here = path.length ? path[path.length - 1] : null;
    lbl.textContent = here ? here.name : 'All notes';
    btn.title = 'Back to ' + (path.length ? path.map((c) => c.name).join(' › ') : 'All notes') + ' (Esc)';
    btn.style.setProperty('--c', here ? LN.lib.colorOf(here.id) : 'var(--text-3)');
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
    E.renderTemplates();
  };

  /* ---------- templates ---------- */
  const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  E.TEMPLATES = [
    { id: 'blank', name: 'Blank page', icon: 'note', paper: 'lined', html: () => '' },
    { id: 'lecture', name: 'Lecture (Cornell)', icon: 'book', paper: 'cornell', title: 'Lecture notes',
      html: () => `<h1>Lecture:&nbsp;</h1><p><b>Date:</b> ${today()}</p><p><b>Topic:</b> </p><h2>Notes</h2><p><br></p><p><br></p><h2>Key terms</h2><p>Term: definition</p><h2>Summary</h2><p><br></p>` },
    { id: 'meeting', name: 'Meeting', icon: 'calendar', paper: 'blank', title: 'Meeting notes',
      html: () => `<h1>Meeting notes</h1><p><b>Date:</b> ${today()}</p><p><b>Attendees:</b> </p><h2>Agenda</h2><ol><li><br></li></ol><h2>Notes</h2><p><br></p><h2>Action items</h2><ul class="checklist"><li><br></li></ul>` },
    { id: 'todo', name: 'To-do list', icon: 'checksquare', paper: 'lined', title: 'To-do',
      html: () => `<h1>To-do</h1><ul class="checklist"><li><br></li></ul><h2>Later</h2><ul class="checklist"><li><br></li></ul>` },
    { id: 'journal', name: 'Daily journal', icon: 'edit', paper: 'dot', title: 'Journal',
      html: () => `<h1>${today()}</h1><h2>Today I’m grateful for</h2><p><br></p><h2>Highlights</h2><p><br></p><h2>What I learned</h2><p><br></p><h2>Tomorrow</h2><ul class="checklist"><li><br></li></ul>` },
    { id: 'study', name: 'Study guide', icon: 'sparkles', paper: 'lined', title: 'Study guide',
      html: () => `<h1>Study guide:&nbsp;</h1><h2>Key terms</h2><p>Term: definition</p><p>Term: definition</p><h2>Main ideas</h2><ul><li><br></li></ul><h2>Questions to review</h2><ol><li><br></li></ol><h2>Summary</h2><p><br></p>` },
    { id: 'sketch', name: 'Sketch / diagram', icon: 'pen', paper: 'grid', title: 'Sketch', draw: true, html: () => '' },
  ];
  E.isBlank = (note) => note && note.pages.length === 1 && pageIsEmpty(note.pages[0]);
  E.renderTemplates = () => {
    const el = $('#templates'); if (!el) return;
    const show = E.isBlank(E.note);
    el.hidden = !show;
    if (!show) return;
    el.innerHTML = `<span class="tpl-label">Start with a template</span>` + E.TEMPLATES.map((t) =>
      `<button class="tpl" data-tpl="${t.id}">${LN.icon(t.icon)}<span>${t.name}</span></button>`).join('') +
      (LN.state.pageTemplates || []).map((t) => `<button class="tpl mine" data-utpl="${t.id}">${LN.icon('bookmark')}<span>${LN.esc(t.name)}</span></button>`).join('') +
      `<button class="tpl" data-tpl-paper>${LN.icon('layout')}<span>Choose paper…</span></button>`;
  };
  E.applyUserTemplate = (id) => {
    const t = (LN.state.pageTemplates || []).find((x) => x.id === id); if (!t || !E.note) return;
    E.note.pages[0] = LN.pageFromTemplate(t);
    if (!E.note.title) { E.note.title = t.name; $('#note-title').value = t.name; }
    LN.touch(E.note); E.renderPages(); $('#templates').hidden = true;
  };
  E.applyTemplate = (id) => {
    const t = E.TEMPLATES.find((x) => x.id === id); if (!t || !E.note) return;
    E.note.pages[0].html = t.html();
    E.note.paper = t.paper; delete E.note.pages[0].paper;
    if (!E.note.title && t.title) { E.note.title = t.title; $('#note-title').value = t.title; }
    LN.touch(E.note);
    E.renderPages();
    $('#templates').hidden = true;
    if (t.draw) E.setMode('draw');
    else if (t.id !== 'blank') {
      E.setMode('type');
      const h1 = E.pages[0].text.querySelector('h1');
      if (h1) { E.pages[0].text.focus(); const r = document.createRange(); r.selectNodeContents(h1); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    } else E.focusEnd();
  };

  /* ---------- live collaboration: merge a remote copy of the open note ---------- */
  E.applyRemote = (remote) => {
    const note = E.note;
    if (!note || note.id !== remote.id) return false;
    const sameShape = remote.pages.length === note.pages.length && remote.pages.every((p, i) => p.id === note.pages[i].id);
    if (note.title !== remote.title) { note.title = remote.title; if (document.activeElement !== $('#note-title')) $('#note-title').value = remote.title; }
    LN.mergePapers(remote.papers);
    let paperChanged = false;
    ['paper', 'spacing', 'color'].forEach((k) => { if (note[k] !== remote[k]) { note[k] = remote[k]; paperChanged = true; } });
    note.cards = remote.cards || note.cards;
    if (!sameShape) {
      note.pages = remote.pages.map((p) => Object.assign(LN.newPage(), p));
      E.undo = []; E.redo = [];
      const y = $('#pages-area').scrollTop; E.renderPages(); $('#pages-area').scrollTop = y;
      return true;
    }
    remote.pages.forEach((rp, i) => {
      const rec = E.pages[i], pg = note.pages[i];
      if (rp.html !== pg.html) {
        pg.html = rp.html;
        if (document.activeElement !== rec.text) rec.text.innerHTML = rp.html;
      }
      if (JSON.stringify(rp.strokes) !== JSON.stringify(pg.strokes)) {
        if (LN.inkSel === rec.ink) rec.ink.clearSel();
        pg.strokes = rp.strokes; rec.ink.render();
      }
      pg.ocr = rp.ocr;
      ['paper', 'spacing', 'color'].forEach((k) => { if (pg[k] !== rp[k]) { if (rp[k]) pg[k] = rp[k]; else delete pg[k]; paperChanged = true; } });
    });
    if (paperChanged) E.refreshPaper();
    return true;
  };

  E.pageEl = (pg, i, total) => {
    const block = document.createElement('div'); block.className = 'page-block';
    const meta = document.createElement('div'); meta.className = 'page-meta';
    meta.innerHTML = `<span>Page ${i + 1} of ${total}</span>
      <button class="icon-btn sm" data-page-cmd="menu" title="Page options" aria-label="Page ${i + 1} options">${LN.icon('more')}</button>`;
    meta.addEventListener('click', (e) => {
      const b = e.target.closest('[data-page-cmd]'); if (!b) return;
      LN.popover(b, `<button data-pick="paper">${LN.icon('layout')} Change background</button>
        <button data-pick="duplicate">${LN.icon('copy')} Duplicate page</button>
        <button data-pick="template">${LN.icon('bookmark')} Save as template</button>
        <hr><button data-pick="up" ${i === 0 ? 'disabled' : ''}>${LN.icon('chevleft', 'rot90')} Move up</button>
        <button data-pick="down" ${i === total - 1 ? 'disabled' : ''}>${LN.icon('chevright', 'rot90')} Move down</button>
        <hr><button data-pick="delete" class="danger">${LN.icon('trash')} Delete page</button>`, (x) => E.pageCmd(x.dataset.pick, i), { alignRight: true });
    });

    const wrap = document.createElement('div'); wrap.className = 'page-wrap';
    const page = document.createElement('div');
    page.className = 'page' + (pg.bg ? ' has-bg' : '');
    E.stylePage(page, pg);
    if (pg.bg) {
      const img = document.createElement('img'); img.className = 'page-bg'; img.src = pg.bg; img.alt = ''; img.draggable = false;
      page.appendChild(img);
    }
    const text = document.createElement('div');
    text.className = 'page-text';
    text.contentEditable = E.mode === 'type' ? 'true' : 'false';
    text.spellcheck = true;
    text.innerHTML = pg.html;
    text.style.minHeight = page.style.minHeight;
    if (i === 0) text.dataset.placeholder = 'Start typing here, or switch to Draw and write by hand…';
    text.addEventListener('input', () => { pg.html = text.innerHTML; LN.touch(E.note); if (!$('#templates').hidden) E.renderTemplates(); });
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

  /* ---------- paper ---------- */
  E.stylePage = (page, pg) => {
    const eff = LN.effPaper(E.note, pg);
    const ps = LN.paperStyle(pg.bg ? { paper: 'blank', spacing: eff.spacing, color: eff.color } : eff);
    page.style.cssText = ps.style;
    page.style.minHeight = Math.max(ps.minH, pg.bg ? pg.bgH : 0) + 'px';
    const text = page.querySelector('.page-text'); if (text) text.style.minHeight = page.style.minHeight;
  };
  E.refreshPaper = () => {
    E.pages.forEach((r) => { const t = r.page.style.transform; E.stylePage(r.page, r.pg); r.page.style.transform = t; });
    E.updatePaperLabel();
  };
  E.updatePaperLabel = () => {
    const l = $('#paper-label'); if (!l || !E.note) return;
    const eff = LN.effPaper(E.note, null);
    l.textContent = LN.paperName(eff.paper) + (eff.spacing !== 'normal' ? ` · ${LN.SPACINGS[eff.spacing].name}` : '');
  };
  // index of the page currently in view
  E.visiblePage = () => {
    const area = $('#pages-area'), top = area.getBoundingClientRect().top + area.clientHeight * 0.3;
    let best = 0;
    E.pages.forEach((r, i) => { if (r.block.getBoundingClientRect().top <= top) best = i; });
    return Math.min(best, Math.max(0, E.note.pages.length - 1));
  };

  E.layout = (rec, quick) => {
    const w = rec.page.offsetWidth, h = rec.page.offsetHeight, z = E.zoom;
    if (!w) return;
    rec.page.style.transform = `scale(${z})`;
    rec.wrap.style.width = w * z + 'px';
    rec.wrap.style.height = h * z + 'px';
    if (!quick) rec.ink.resize(w, h, Math.min(3, (window.devicePixelRatio || 1) * z));
  };

  E.computeFit = () => {
    if (!E.fit) return;
    const area = $('#pages-area');
    const avail = area.clientWidth - (area.clientWidth < 700 ? 16 : 64);
    E.zoom = Math.max(0.3, Math.min(1, avail / LN.PAGE_W));
    E.updateZoomLabel();
  };
  // step zoom: dir = 1 (in), -1 (out), 0 (fit to width)
  E.setZoom = (dir) => {
    if (dir === 0) {
      const area = $('#pages-area'), old = E.zoom;
      E.fit = true; E.computeFit();
      const r = E.zoom / old;
      E.pages.forEach((rec) => E.layout(rec));
      area.scrollTop = area.scrollTop * r; area.scrollLeft = 0;
      return;
    }
    const next = dir > 0 ? ZOOMS.find((z) => z > E.zoom + 0.001) : [...ZOOMS].reverse().find((z) => z < E.zoom - 0.001);
    if (next) E.setZoomTo(next);
  };
  // continuous zoom that keeps the point under `focal` (px inside the page area) still
  let settleT = 0;
  E.setZoomTo = (z, focal, quick) => {
    if (!E.note) return;
    z = Math.max(ZMIN, Math.min(ZMAX, z));
    const area = $('#pages-area'), old = E.zoom;
    if (Math.abs(z - old) < 0.0005) return;
    const fx = focal ? focal.x : area.clientWidth / 2, fy = focal ? focal.y : area.clientHeight / 2;
    const cx = area.scrollLeft + fx, cy = area.scrollTop + fy, r = z / old;
    E.zoom = z; E.fit = false;
    E.updateZoomLabel();
    E.pages.forEach((rec) => E.layout(rec, quick));
    area.scrollLeft = Math.max(0, cx * r - fx);
    area.scrollTop = Math.max(0, cy * r - fy);
    clearTimeout(settleT);
    if (quick) settleT = setTimeout(() => E.pages.forEach((rec) => E.layout(rec)), 180); // sharpen ink once zooming pauses
  };
  E.updateZoomLabel = () => { $('#zoom-label').textContent = Math.round(E.zoom * 100) + '%'; };

  E.redrawInk = () => E.pages.forEach((r) => r.ink.render());

  /* ---------- mode ---------- */
  E.setMode = (m) => {
    E.mode = m;
    document.body.classList.toggle('mode-draw', m === 'draw');
    document.body.classList.toggle('mode-type', m === 'type');
    $$('.mode-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
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
    if (LN.inkSel) LN.inkSel.clearSel();
    E.redo.push({ pg: u.pg, strokes: u.pg.strokes });
    u.pg.strokes = u.strokes;
    E.redrawInk(); E.updateUndoButtons(); LN.touch(E.note);
  };
  E.doRedo = () => {
    const r = E.redo.pop(); if (!r) return;
    if (LN.inkSel) LN.inkSel.clearSel();
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

  E.imageToPage = async (file) => {
    const { url, w, h } = await downscale(file, LN.PAGE_W * 2);
    return { url, h: (h / w) * LN.PAGE_W };
  };
  // render up to `max` PDF pages as images sized for LataNote pages
  E.renderPdf = async (file, max = 80, onPage) => {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, max);
    const out = [];
    out.total = doc.numPages;
    for (let i = 1; i <= n; i++) {
      if (onPage) onPage(i, n);
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (LN.PAGE_W * 2) / v1.width });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      out.push({ url: c.toDataURL('image/jpeg', 0.82), h: (vp.height / vp.width) * LN.PAGE_W });
    }
    return out;
  };

  E.importFile = async (file) => {
    if (!file || !E.note) return;
    if (file.type.startsWith('image/')) {
      E.addBgPages([await E.imageToPage(file)]);
      LN.toast('Image added as a page. Switch to Draw to annotate it.');
      return;
    }
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { LN.toast('Choose a PDF or image file.'); return; }
    try {
      LN.toast('Opening PDF…');
      const out = await E.renderPdf(file, 80, (i, n) => LN.toast(`Importing page ${i} of ${n}…`));
      const n = out.length, doc = { numPages: out.total };
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
    if (cmd === 'paper') { LN.openPaperPicker(i); return; }
    if (cmd === 'template') { LN.savePageTemplate(E.note, pages[i]); return; }
    if (cmd === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(pages[i])); copy.id = LN.uid(); copy.strokes.forEach((st) => delete st.rec);
      pages.splice(i + 1, 0, copy);
    }
    if (cmd === 'delete') {
      if (pages.length === 1) {
        if (!(await LN.confirm('Clear this page?', 'This is the only page, so its text and ink will be cleared.', 'Clear'))) return;
        pages[0] = Object.assign(LN.newPage(), { paper: pages[0].paper, spacing: pages[0].spacing, color: pages[0].color });
        ['paper', 'spacing', 'color'].forEach((k) => { if (!pages[0][k]) delete pages[0][k]; });
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


  /* Snapshot of a page for presenting / exporting: html with ink as an image */
  E.snapshot = (rec) => ({
    html: rec.pg.html,
    bg: rec.pg.bg,
    style: rec.page.style.cssText.replace(/transform:[^;]*;?/, ''),
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

  /* floating "page x of n" while scrolling */
  let indT = 0;
  E.updatePageInd = () => {
    const el = $('#page-ind'); if (!el || !E.note) return;
    const n = E.note.pages.length;
    if (n < 2) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = `Page ${E.visiblePage() + 1} of ${n}`;
    el.classList.add('show');
    clearTimeout(indT); indT = setTimeout(() => el.classList.remove('show'), 1400);
  };
  /* ---------- zoom gestures ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const area = $('#pages-area');
    const rel = (x, y) => { const r = area.getBoundingClientRect(), z = LN.uiZoom ? LN.uiZoom() : 1; return { x: (x - r.left) / z, y: (y - r.top) / z }; };
    area.addEventListener('scroll', () => requestAnimationFrame(E.updatePageInd), { passive: true });

    // trackpad pinch (sent as ctrl+wheel) and Ctrl/Cmd + mouse wheel: smooth, anchored at the cursor
    area.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey) || !E.note) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // mouse-wheel notches are big: one gentle step each; trackpad pinches send small deltas: follow them smoothly
      const f = Math.abs(dy) >= 40 ? (dy < 0 ? 1.12 : 1 / 1.12) : Math.exp(-dy * 0.012);
      E.setZoomTo(E.zoom * f, rel(e.clientX, e.clientY), true);
    }, { passive: false });

    // two-finger pinch on touch screens (also pans); works in Type and Draw mode
    let pinch = null;
    const two = (t) => { const a = t[0], b = t[1]; return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; };
    area.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2 || !E.note) return;
      LN.pinching = true;
      E.pages.forEach((r) => r.ink.cancel()); // a second finger means "zoom", not "draw"
      const g = two(e.touches);
      pinch = { d0: g.d || 1, z0: E.zoom, x: g.x, y: g.y };
      e.preventDefault();
    }, { passive: false });
    area.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const g = two(e.touches);
      E.setZoomTo(pinch.z0 * (g.d / pinch.d0), rel(g.x, g.y), true);
      area.scrollBy(pinch.x - g.x, pinch.y - g.y);
      pinch.x = g.x; pinch.y = g.y;
    }, { passive: false });
    const endPinch = (e) => {
      if (!pinch || (e.touches && e.touches.length >= 2)) return;
      pinch = null;
      setTimeout(() => { LN.pinching = false; }, 60);
    };
    area.addEventListener('touchend', endPinch);
    area.addEventListener('touchcancel', endPinch);

    // Safari on Mac/iPad: native gesture events
    let gz = 1;
    area.addEventListener('gesturestart', (e) => { e.preventDefault(); gz = E.zoom; });
    area.addEventListener('gesturechange', (e) => { e.preventDefault(); if (!pinch) E.setZoomTo(gz * e.scale, rel(e.clientX, e.clientY), true); });
    area.addEventListener('gestureend', (e) => e.preventDefault());

    // double-click the zoom % to toggle 100% / fit
    $('#zoom-label').addEventListener('dblclick', () => (Math.abs(E.zoom - 1) < 0.01 ? E.setZoom(0) : E.setZoomTo(1)));
  });

  window.addEventListener('resize', LN.debounce(() => { if (E.fit && E.note) { E.computeFit(); E.pages.forEach(E.layout); } }, 120));
})();

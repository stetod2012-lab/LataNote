/* LataNote app controller: library, views, toolbar wiring, presenting, export, shortcuts */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$, E = () => LN.editor;

  const App = (LN.app = { view: 'notes', search: '' });
  const TRASH = '__trash';
  const TRASH_DAYS = 30;
  const INK_COLORS = ['#1f2937', '#2563eb', '#e11d48', '#059669', '#7c3aed', '#ea580c'];
  const HL_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd'];
  const toolColors = { pen: '#1f2937', highlighter: '#fde047', shape: '#2563eb' };
  const colorKey = (t) => (t === 'pen' ? 'pen' : t === 'highlighter' ? 'highlighter' : 'shape');

  /* ---------- library ---------- */
  App.renderLibrary = () => LN.lib.render();

  App.openNote = (id) => {
    if (!LN.getNote(id)) return;
    App.setView('notes');
    E().open(id);
    LN.lib.renderTree();
    App.closeSidebarMobile();
  };

  // containerId: where to put it (defaults to the library location you're looking at)
  App.newNote = (containerId) => {
    let cid = containerId !== undefined ? containerId : (LN.lib.currentContainer() || {}).id || null;
    const c = cid ? LN.lib.get(cid) : null;
    if (c && c.type === 'notebook' && LN.state.ui.sectionTab && containerId === undefined) cid = LN.state.ui.sectionTab;
    const note = LN.newNote(cid || null, '');
    LN.state.notes.push(note);
    LN.touch(note);
    App.openNote(note.id);
    setTimeout(() => { const ae = document.activeElement; if (!ae || ae === document.body || ae.closest('#lib, .popover, #lib-new')) $('#note-title').focus(); }, 50);
  };

  App.trashNote = (note, quiet) => {
    if (LN.collab.noteId === note.id) LN.collab.stop(true);
    LN.state.notes = LN.state.notes.filter((n) => n !== note);
    note.deletedAt = Date.now();
    (LN.state.trash = LN.state.trash || []).push(note);
    LN.save();
    if (!quiet) LN.toast(`Moved “${note.title || 'Untitled note'}” to Trash.`);
  };
  App.trashAction = async (act, id) => {
    const S = LN.state;
    if (act === 'empty') {
      if (!(await LN.confirm('Empty trash?', `${S.trash.length} note${S.trash.length === 1 ? '' : 's'} will be deleted forever.`, 'Empty trash'))) return;
      S.trash.forEach((n) => n.recordings.forEach((r) => LN.db.del(r.id, 'blobs')));
      S.trash = [];
    } else {
      const n = S.trash.find((x) => x.id === id); if (!n) return;
      S.trash = S.trash.filter((x) => x !== n);
      if (act === 'restore') {
        delete n.deletedAt;
        if (n.notebookId && !LN.getNotebook(n.notebookId)) n.notebookId = null;
        S.notes.push(n);
        LN.toast(`Restored “${n.title || 'Untitled note'}”.`);
      } else n.recordings.forEach((r) => LN.db.del(r.id, 'blobs'));
    }
    LN.save(); App.renderLibrary();
  };
  App.purgeTrash = () => {
    const cutoff = Date.now() - TRASH_DAYS * 864e5;
    const old = (LN.state.trash || []).filter((n) => n.deletedAt < cutoff);
    old.forEach((n) => n.recordings.forEach((r) => LN.db.del(r.id, 'blobs')));
    LN.state.trash = (LN.state.trash || []).filter((n) => n.deletedAt >= cutoff);
  };

  App.firstNoteId = () => {
    const list = LN.state.notes.slice().sort((a, b) => b.updated - a.updated);
    return list[0] ? list[0].id : null;
  };

  /* ---------- note menu commands ---------- */
  App.noteCmd = async (cmd) => {
    const note = E().note;
    if (cmd === 'new-note') return App.newNote();
    if (!note) return;
    if (cmd === 'export-html') App.exportHTML();
    else if (cmd === 'print') window.print();
    else if (cmd === 'share') {
      LN.download(`${LN.safeName(note.title)}.latanote`, JSON.stringify({ type: 'latanote-note', version: 1, note: Object.assign({}, note, { recordings: [] }), papers: LN.papersUsedBy([note]) }), 'application/json');
      LN.toast('Note file downloaded. Anyone with LataNote can import it.');
    } else if (cmd === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(note));
      copy.id = LN.uid(); copy.title = (note.title || 'Untitled note') + ' (copy)'; copy.recordings = []; copy.pinned = false;
      copy.pages.forEach((p) => { p.id = LN.uid(); p.strokes.forEach((s) => delete s.rec); });
      copy.created = copy.updated = Date.now();
      LN.state.notes.push(copy); LN.touch(copy); App.openNote(copy.id);
    } else if (cmd === 'move') LN.lib.moveDialog('note', note.id);
    else if (cmd === 'present') App.present();
    else if (cmd === 'fullscreen') LN.extras.toggleFullscreen();
    else if (cmd === 'export') App.exportPanel();
    else if (cmd === 'insert-pdf') $('#file-pdf').click(); else if (cmd === 'clear-ink') E().clearInk();
    else if (cmd === 'delete') {
      LN.audio.stop();
      App.trashNote(note);
      E().open(null);
      LN.lib.open(note.notebookId && LN.lib.get(note.notebookId) ? note.notebookId : null);
    } else if (cmd === 'pin') {
      note.pinned = !note.pinned; LN.save(); App.renderLibrary();
      LN.toast(note.pinned ? 'Pinned to the top of the list.' : 'Unpinned.');
    } else if (cmd === 'collab') LN.collab.openLivePanel();
    else if (cmd === 'ocr') LN.extras.ocrNote();
    else if (cmd === 'speak') LN.extras.speak();
    else if (cmd === 'export-md') LN.extras.exportMarkdown();
    else if (cmd === 'dictate') LN.extras.dictate(); else if (cmd === 'add-page') LN.openAddPage();
    else if (cmd === 'paper') LN.openPaperPicker('all');
    else if (cmd === 'import-pdf') $('#file-pdf').click();
    else if (cmd === 'image') { $('#file-image').click(); }
    else if (cmd === 'checklist') E().checklist();
    else if (cmd === 'table') E().table();
    else if (cmd === 'link') E().link();
  };

  /* ---------- export ---------- */
  App.exportPanel = () => {
    const body = LN.panel(`<h3>${LN.icon('download')} Export &amp; share</h3>
      <button class="set-row" data-ex="print">${LN.icon('printer')}<span><b>Print or save as PDF</b><small>Uses your browser’s print dialog</small></span></button>
      <button class="set-row" data-ex="export-html">${LN.icon('download')}<span><b>Web page (HTML)</b><small>Opens in any browser, with handwriting and backgrounds</small></span></button>
      <button class="set-row" data-ex="export-md">${LN.icon('download')}<span><b>Markdown</b><small>Plain text for other note apps</small></span></button>
      <button class="set-row" data-ex="share">${LN.icon('share')}<span><b>LataNote file</b><small>Someone else can import it into their LataNote</small></span></button>`);
    body.onclick = (e) => { const b = e.target.closest('[data-ex]'); if (!b) return; LN.closePanel(); setTimeout(() => App.noteCmd(b.dataset.ex), 50); };
  };
  App.exportHTML = () => {
    const note = E().note;
    const pages = E().pages.map(E().snapshot);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${LN.esc(note.title || 'Untitled note')}</title>
<style>
body{margin:0;background:#eef0f5;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937}
h1.doc{max-width:816px;margin:32px auto 8px;font-size:22px;padding:0 12px}
.pg{position:relative;width:816px;margin:16px auto;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.08);overflow:hidden}
.pg .bg{position:absolute;inset:0 0 auto 0;width:100%}
.pg .ink{position:absolute;inset:0;width:100%;height:100%;mix-blend-mode:multiply}
.txt{position:relative;padding:var(--pad-t) 56px 64px var(--pad-l);font-size:var(--fs);line-height:var(--ls)}.hasbg .txt{padding:40px 56px}
.txt h1{font-size:calc(var(--fs)*1.67);line-height:calc(var(--ls)*2);margin:0}.txt h2{font-size:calc(var(--fs)*1.28);line-height:var(--ls);margin:0}.txt h3{font-size:calc(var(--fs)*1.06);line-height:var(--ls);margin:0}
.txt p,.txt ul,.txt ol{margin:0}.txt img{max-width:100%;height:auto}
.txt table{border-collapse:collapse;margin:0 0 32px}.txt td,.txt th{border:1px solid #cbd5e1;padding:0 10px;min-width:80px}
.txt blockquote{margin:0;padding-left:16px;border-left:3px solid #6366f1;color:#475569}
.txt pre{background:#f1f5f9;border-radius:6px;padding:0 12px;margin:0;font-family:ui-monospace,Menlo,monospace;font-size:15px}
ul.checklist{list-style:none;padding-left:32px}ul.checklist li{position:relative}ul.checklist li:before{content:"";position:absolute;left:-28px;top:7px;width:16px;height:16px;border:2px solid #94a3b8;border-radius:4px}
ul.checklist li.done{color:#94a3b8;text-decoration:line-through}ul.checklist li.done:before{background:#6366f1;border-color:#6366f1}
@media print{body{background:#fff}.pg{box-shadow:none;margin:0 auto;page-break-after:always}h1.doc{display:none}}
</style></head><body><h1 class="doc">${LN.esc(note.title || 'Untitled note')}</h1>
${pages.map((p) => `<section class="pg${p.bg ? ' hasbg' : ''}" style="${p.style};height:${p.h}px">
${p.bg ? `<img class="bg" src="${p.bg}" alt="">` : ''}<div class="txt">${p.html}</div>${p.ink ? `<img class="ink" src="${p.ink}" alt="">` : ''}</section>`).join('\n')}
</body></html>`;
    LN.download(`${LN.safeName(note.title)}.html`, html, 'text/html');
  };

  /* ---------- presenting ---------- */
  const Pr = { slides: [], i: 0, laser: false };
  App.present = () => {
    const note = E().note; if (!note) return;
    Pr.slides = E().pages.map(E().snapshot);
    Pr.i = 0;
    const stage = $('#present-stage');
    stage.innerHTML = Pr.slides.map((p, i) => `
      <div class="slide" data-i="${i}" hidden>
        <div class="page${p.bg ? ' has-bg' : ''}" style="${p.style};height:${p.h}px">
          ${p.bg ? `<img class="page-bg" src="${p.bg}" alt="">` : ''}
          <div class="page-text">${p.html}</div>
          ${p.ink ? `<img class="page-ink" src="${p.ink}" alt="">` : ''}
        </div>
      </div>`).join('');
    $('#present').hidden = false;
    document.body.classList.add('presenting');
    const el = $('#present');
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    Pr.show(0);
  };
  Pr.fit = () => {
    const slide = $(`#present-stage .slide[data-i="${Pr.i}"]`); if (!slide) return;
    const p = Pr.slides[Pr.i];
    const z = LN.uiZoom(), vw = window.innerWidth / z - 32, vh = window.innerHeight / z - 90;
    // fit width, but cap so a page roughly fills the screen; tall pages scroll
    const s = Math.min(vw / p.w, Math.max(vh / p.h, Math.min(vw / p.w, (vh * 1.6) / p.h)));
    const page = slide.firstElementChild;
    page.style.transform = `scale(${s})`;
    slide.style.width = p.w * s + 'px';
    slide.style.height = p.h * s + 'px';
  };
  Pr.show = (i) => {
    Pr.i = Math.max(0, Math.min(Pr.slides.length - 1, i));
    $$('#present-stage .slide').forEach((s) => { s.hidden = +s.dataset.i !== Pr.i; });
    $('#pr-count').textContent = `${Pr.i + 1} / ${Pr.slides.length}`;
    $('#present-stage').scrollTop = 0;
    Pr.fit();
  };
  Pr.close = () => {
    $('#present').hidden = true;
    document.body.classList.remove('presenting');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  Pr.toggleLaser = () => {
    Pr.laser = !Pr.laser;
    $('#pr-laser').classList.toggle('active', Pr.laser);
    $('#present').classList.toggle('laser-on', Pr.laser);
    if (!Pr.laser) $('#laser').hidden = true;
  };

  /* ---------- backup / import ---------- */
  App.backup = () => {
    const data = { type: 'latanote-backup', version: 1, exported: new Date().toISOString(), state: LN.state };
    LN.download(`LataNote backup ${LN.ymd(new Date())}.json`, JSON.stringify(data), 'application/json');
    LN.toast('Backup downloaded. Audio recordings are kept on this device only.');
  };
  App.importFile = async (file) => {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { LN.toast('That file isn’t a LataNote note or backup.'); return; }
    if (data.type === 'latanote-note' && data.note && Array.isArray(data.note.pages)) {
      const n = data.note;
      LN.mergePapers(data.papers);
      n.id = LN.uid(); n.recordings = []; n.cards = n.cards || [];
      n.notebookId = (LN.lib.currentContainer() || {}).id || null;
      n.updated = Date.now();
      LN.state.notes.push(n);
      LN.touch(n); App.openNote(n.id);
      LN.toast(`Imported “${n.title || 'Untitled note'}”.`);
    } else if (data.type === 'latanote-notebook' && Array.isArray(data.notes)) {
      LN.lib.importContainer(data);
    } else if (data.type === 'latanote-backup' && data.state && Array.isArray(data.state.notes)) {
      if (!(await LN.confirm('Restore this backup?', `This replaces everything on this device with ${data.state.notes.length} notes from ${data.exported ? new Date(data.exported).toLocaleString() : 'the backup'}.`, 'Restore'))) return;
      LN.state = Object.assign({ notebooks: [], notes: [], events: [], trash: [], settings: { penOnly: false }, ui: {} }, data.state);
      LN.state.ui.samplesRemoved = true;
      LN.lib.migrate();
      LN.save();
      E().open(null);
      LN.lib.open(null);
      LN.toast('Backup restored.');
    } else LN.toast('That file isn’t a LataNote note or backup.');
  };

  /* ---------- views & layout ---------- */
  App.setView = (v) => {
    App.view = v;
    $('#view-library').hidden = v !== 'library';
    $('#view-notes').hidden = v !== 'notes';
    $('#view-planner').hidden = v !== 'planner';
    $('#nav-planner').classList.toggle('active', v === 'planner');
    document.body.classList.toggle('view-planner', v === 'planner');
    document.body.classList.toggle('view-library', v === 'library');
    if (v !== 'notes') { LN.audio.stopPlayback(); if (LN.study.open) LN.study.toggle(false); }
    if (v === 'planner') LN.planner.render();
    else if (v === 'notes' && E().note) { E().computeFit(); E().pages.forEach(E().layout); }
    if (LN.lib) LN.lib.renderTree();
  };
  App.setPenOnly = (on) => {
    LN.state.settings.penOnly = !!on;
    document.body.classList.toggle('pen-only', !!on);
    LN.save();
    LN.toast(on ? 'Stylus only: fingers now scroll instead of drawing.' : 'Fingers and stylus can both draw.');
  };
  App.closeSidebarMobile = () => document.body.classList.remove('sidebar-open');

  App.setTheme = (t) => LN.appearance.set('skin', t === 'dark' ? 'midnight' : 'classic');

  /* ---------- drawing toolbar ---------- */
  App.renderSwatches = () => {
    const isHl = LN.tool.name === 'highlighter';
    const list = isHl ? HL_COLORS : INK_COLORS;
    $('#swatches').innerHTML = list.map((c) => `<button class="swatch ${c === LN.tool.color ? 'active' : ''}" data-color="${c}" style="--c:${c}" title="${c}" aria-label="Color ${c}"></button>`).join('');
    $('#ink-color').value = LN.tool.color;
  };
  App.setTool = (name) => {
    LN.tool.name = name;
    if (name !== 'lasso' && LN.inkSel) LN.inkSel.clearSel();
    if (name !== 'eraser' && name !== 'lasso') LN.tool.color = toolColors[colorKey(name)];
    const SH = ['line', 'arrow', 'rect', 'ellipse'];
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === name || (b.id === 'shapes-btn' && SH.includes(name))));
    if (SH.includes(name)) $('#shapes-btn').innerHTML = LN.icon(name);
    document.body.dataset.tool = name;
    App.renderSwatches();
    if (E().mode !== 'draw') E().setMode('draw');
  };
  App.setColor = (c) => {
    if (LN.inkSel && LN.tool.name === 'lasso') { LN.inkSel.recolorSel(c); return; }
    LN.tool.color = c;
    if (LN.tool.name !== 'eraser' && LN.tool.name !== 'lasso') toolColors[colorKey(LN.tool.name)] = c;
    else { App.setTool('pen'); LN.tool.color = toolColors.pen = c; }
    if (LN.tool.name === 'lasso') { App.setTool('pen'); LN.tool.color = toolColors.pen = c; }
    App.renderSwatches();
  };

  /* ---------- init ---------- */
  App.init = async () => {
    LN.hydrateIcons();
    await LN.load();

    App.purgeTrash();
    LN.lib.init();
    LN.audio.init(); LN.planner.init(); LN.study.init(); LN.extras.init();
    LN.on('ink-selection', (on) => document.body.classList.toggle('has-sel', !!on));
    $('#templates').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tpl], [data-utpl], [data-tpl-paper]'); if (!b) return;
      if (b.dataset.utpl) E().applyUserTemplate(b.dataset.utpl);
      else if (b.hasAttribute('data-tpl-paper')) LN.openPaperPicker('all');
      else E().applyTemplate(b.dataset.tpl);
    });
    LN.on('notes-changed', LN.debounce(() => { if (App.view === 'library') LN.lib.render(); else LN.lib.renderTree(); if (App.view === 'planner') LN.planner.render(); }, 300));

    // sidebar
    $('#nav-planner').addEventListener('click', () => { App.setView('planner'); App.closeSidebarMobile(); });
    $('#search').addEventListener('input', LN.debounce((e) => { LN.lib.search = e.target.value; App.setView('library'); LN.lib.render(); }, 150));
    $$('[data-action="toggle-sidebar"]').forEach((b) => b.addEventListener('click', () => document.body.classList.toggle('sidebar-open')));
    $('#theme-toggle').addEventListener('click', () => LN.appearance.open());
    $('#file-import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) App.importFile(f); });
    $('#back-btn').addEventListener('click', () => { const n = E().note; LN.lib.open(n && n.notebookId && LN.lib.get(n.notebookId) ? n.notebookId : null); });

    // title
    $('#note-title').addEventListener('input', (e) => { const n = E().note; if (!n) return; n.title = e.target.value; LN.touch(n); });
    $('#note-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (E().mode === 'type') E().focusEnd(); else e.target.blur(); } });

    // mode
    $$('.mode-seg .seg-btn').forEach((b) => b.addEventListener('click', () => E().setMode(b.dataset.mode)));

    // toolbar: keep text selection when pressing buttons
    $('#toolbar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    $('#toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.drop) { App.openDrop(b); return; }
      App.toolbarAction(b);
    });
    $('#block-select').addEventListener('change', (e) => E().exec('formatBlock', '<' + e.target.value + '>'));
    $('#fore-color').addEventListener('input', (e) => { $('#fore-bar').style.background = e.target.value; });
    $('#fore-color').addEventListener('change', (e) => E().exec('foreColor', e.target.value));
    $('#fore-bar').style.background = $('#fore-color').value;
    $('#ink-color').addEventListener('input', (e) => App.setColor(e.target.value));
    $('#undo-btn').addEventListener('click', () => E().doUndo());
    $('#redo-btn').addEventListener('click', () => E().doRedo());
    document.body.classList.toggle('pen-only', !!LN.state.settings.penOnly);
    $('#file-image').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) E().insertImageFile(f); });
    $('#file-pdf').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) E().importFile(f); });
    App.renderSwatches();
    document.body.dataset.tool = LN.tool.name;

    // more menu
    const menu = $('#more-menu');
    $('#more-btn').addEventListener('click', (e) => {
      e.stopPropagation(); menu.hidden = !menu.hidden;
      if (E().note) $('#pin-label').textContent = E().note.pinned ? 'Unpin note' : 'Pin note';
      LN.extras.updateSpeakLabel();
    });
    menu.addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (!b) return; menu.hidden = true; App.noteCmd(b.dataset.cmd); });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.menu-wrap')) menu.hidden = true; });
    $('#empty').addEventListener('click', (e) => { if (e.target.closest('[data-cmd="new-note"]')) App.newNote(); else if (e.target.closest('[data-cmd="library"]')) LN.lib.open(null); });

    // drag & drop PDFs/images onto the page area
    const area = $('#pages-area');
    area.addEventListener('dragover', (e) => { if (E().note && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); area.classList.add('drop'); } });
    area.addEventListener('dragleave', (e) => { if (e.target === area) area.classList.remove('drop'); });
    area.addEventListener('drop', (e) => {
      area.classList.remove('drop');
      const f = e.dataTransfer.files[0]; if (!f || !E().note) return;
      e.preventDefault();
      if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name)) E().importFile(f);
      else if (f.type.startsWith('image/')) { if (E().mode === 'type' && e.target.closest('.page-text')) E().insertImageFile(f); else E().importFile(f); }
    });

    // presenting
    $('#pr-prev').addEventListener('click', () => Pr.show(Pr.i - 1));
    $('#pr-next').addEventListener('click', () => Pr.show(Pr.i + 1));
    $('#pr-close').addEventListener('click', Pr.close);
    $('#pr-laser').addEventListener('click', Pr.toggleLaser);
    $('#present').addEventListener('pointermove', (e) => {
      if (!Pr.laser) return;
      const l = $('#laser'); l.hidden = false;
      l.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && !$('#present').hidden) Pr.fit(); });
    window.addEventListener('resize', LN.debounce(() => { if (!$('#present').hidden) Pr.fit(); }, 100));

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const inField = e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (!$('#present').hidden) {
        if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); Pr.show(Pr.i + 1); }
        else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); Pr.show(Pr.i - 1); }
        else if (e.key === 'Escape') Pr.close();
        else if (e.key.toLowerCase() === 'l') Pr.toggleLaser();
        return;
      }
      if ($('#dlg').open) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); e.shiftKey ? E().doRedo() : E().doUndo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); E().doRedo(); return; }
      if (mod && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); App.newNote(); return; }
      if (mod && App.view === 'notes' && E().note && ['=', '+', '-', '_', '0'].includes(e.key)) {
        e.preventDefault(); E().setZoom(e.key === '0' ? 0 : e.key === '-' || e.key === '_' ? -1 : 1); return;
      }
      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) { e.preventDefault(); document.body.classList.add('sidebar-open'); $('#search').focus(); return; }
      if (inField || mod || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { LN.extras.toggleFullscreen(); return; }
      if (e.key === '?') { LN.extras.shortcuts(); return; }
      if (e.key === 'Escape' && App.view === 'notes' && !LN.inkSel && !$('#popover:not([hidden])') && menu.hidden) { $('#back-btn').click(); return; }
      if (App.view !== 'notes' || !E().note) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && LN.inkSel) { e.preventDefault(); LN.inkSel.deleteSel(); return; }
      if (e.key === 'Escape' && LN.inkSel) { LN.inkSel.clearSel(); return; }
      const k = e.key.toLowerCase();
      if (k === 't') E().setMode('type');
      else if (k === 'd') E().setMode('draw');
      else if (k === 'p') App.setTool('pen');
      else if (k === 'h') App.setTool('highlighter');
      else if (k === 'e') App.setTool('eraser');
      else if (k === 'l') App.setTool('lasso');
      else if (k === 'escape') { menu.hidden = true; }
    });

    window.addEventListener('beforeunload', (e) => { if (LN.audio.rec) { e.preventDefault(); e.returnValue = ''; } });

    // first render
    E().setMode('type');
    E().open(null);
    App.setView('library');
    LN.lib.render();
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'planner') App.setView('planner');
    if (params.get('new') === '1') App.newNote();
    LN.collab.checkInvite();
    // opened by double-clicking a .latanote file (installed app)
    if ('launchQueue' in window) window.launchQueue.setConsumer(async (params) => { for (const h of params.files || []) App.importFile(await h.getFile()); });
  };

  /* ---------- toolbar actions & dropdowns ---------- */
  App.toolbarAction = (b) => {
    if (b.dataset.exec) E().exec(b.dataset.exec, b.dataset.arg || null);
    else if (b.dataset.cmd) App.noteCmd(b.dataset.cmd);
    else if (b.dataset.tool) App.setTool(b.dataset.tool);
    else if (b.dataset.color) App.setColor(b.dataset.color);
    else if (b.dataset.size) { LN.tool.size = +b.dataset.size; $$('#sizes .size').forEach((x) => x.classList.toggle('active', x === b)); }
    else if (b.dataset.zoom != null) E().setZoom(+b.dataset.zoom);
    else if (b.dataset.sel && LN.inkSel) { const a = b.dataset.sel; if (a === 'delete') LN.inkSel.deleteSel(); else if (a === 'duplicate') LN.inkSel.duplicateSel(); else if (a === 'ocr') LN.extras.ocrSelection(); }
  };
  const DROPS = {
    insert: () => `<button data-cmd="table">${LN.icon('table')} Table</button>
      <button data-cmd="link">${LN.icon('link')} Link</button>
      <button data-cmd="image">${LN.icon('image')} Image</button>
      <button data-exec="insertOrderedList">${LN.icon('olist')} Numbered list</button>
      <hr><button data-cmd="insert-pdf">${LN.icon('filepdf')} Pages from a PDF or image</button>`,
    format: () => `<button data-exec="strikeThrough">${LN.icon('clear')} Strikethrough</button>
      <button data-exec="justifyLeft">${LN.icon('alignleft')} Align left</button>
      <button data-exec="justifyCenter">${LN.icon('aligncenter')} Align center</button>
      <hr><button data-exec="removeFormat">${LN.icon('clear')} Clear formatting</button>`,
    shapes: () => ['line', 'arrow', 'rect', 'ellipse'].map((t) => `<button data-tool="${t}" class="${LN.tool.name === t ? 'on' : ''}">${LN.icon(t)} ${{ line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse' }[t]}</button>`).join('') + '<p class="menu-note">Hold Shift for straight lines and perfect shapes</p>',
    zoom: () => `<button data-zoom="1" data-keep>${LN.icon('plus')} Zoom in</button><button data-zoom="-1" data-keep>${LN.icon('chevdown')} Zoom out</button><button data-zoom="0">${LN.icon('maximize')} Fit to width</button>`,
  };
  App.openDrop = (btn) => LN.popover(btn, DROPS[btn.dataset.drop](), (b) => App.toolbarAction(b), { cls: 'tb-pop' });

  document.addEventListener('DOMContentLoaded', () => App.init().catch((e) => { console.error(e); LN.toast('LataNote failed to start: ' + e.message); }));
})();

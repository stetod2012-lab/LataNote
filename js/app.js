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

  /* ---------- library sidebar ---------- */
  App.renderNotebooks = () => {
    const sel = LN.state.ui.notebookId;
    const count = (id) => LN.state.notes.filter((n) => !id || n.notebookId === id).length;
    $('#notebook-list').innerHTML =
      `<li><button class="nb ${!sel ? 'active' : ''}" data-nb=""><span class="nb-dot all"></span><span class="nb-name">All notes</span><span class="nb-count">${count()}</span></button></li>` +
      LN.state.notebooks.map((nb) => `
        <li><button class="nb ${sel === nb.id ? 'active' : ''}" data-nb="${nb.id}">
          <span class="nb-dot" style="background:${nb.color}"></span><span class="nb-name">${LN.esc(nb.name)}</span><span class="nb-count">${count(nb.id)}</span>
          <span class="nb-edit" data-nb-edit="${nb.id}" role="button" tabindex="0" title="Edit notebook" aria-label="Edit ${LN.esc(nb.name)}">${LN.icon('edit')}</span>
        </button></li>`).join('') +
      `<li><button class="nb trash-nb ${sel === TRASH ? 'active' : ''}" data-nb="${TRASH}">${LN.icon('trash')}<span class="nb-name">Trash</span><span class="nb-count">${(LN.state.trash || []).length || ''}</span></button></li>`;
  };

  App.renderTrash = () => {
    const items = (LN.state.trash || []).slice().sort((a, b) => b.deletedAt - a.deletedAt);
    $('#notes-heading').textContent = 'Trash';
    $('#note-list').innerHTML = (items.length ? `<li class="ni-empty">Notes are deleted forever ${TRASH_DAYS} days after you trash them. <button class="link-btn" data-trash="empty">Empty trash</button></li>` : '') +
      items.map((n) => `<li class="trash-item"><div><b>${LN.esc(n.title || 'Untitled note')}</b><small>Deleted ${LN.relTime(n.deletedAt)}</small></div>
        <button class="icon-btn sm" data-trash="restore" data-id="${n.id}" title="Restore">${LN.icon('restore')}</button>
        <button class="icon-btn sm" data-trash="purge" data-id="${n.id}" title="Delete forever">${LN.icon('x')}</button></li>`).join('') ||
      '<li class="ni-empty">Trash is empty.</li>';
  };

  App.renderNotes = () => {
    const q = App.search.trim().toLowerCase();
    const nbId = LN.state.ui.notebookId;
    if (nbId === TRASH && !q) return App.renderTrash();
    let notes = LN.state.notes.slice();
    if (q) notes = notes.filter((n) => (n.title + '\n' + LN.noteText(n)).toLowerCase().includes(q));
    else if (nbId) notes = notes.filter((n) => n.notebookId === nbId);
    notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
    const nb = nbId && LN.getNotebook(nbId);
    $('#notes-heading').textContent = q ? `Results (${notes.length})` : nb ? nb.name : 'All notes';
    const cur = E().note && E().note.id;
    $('#note-list').innerHTML = notes.map((n) => {
      const text = LN.noteText(n);
      let snip = text.replace(/\s+/g, ' ').trim().slice(0, 90);
      if (q) { const i = text.toLowerCase().indexOf(q); if (i > 30) snip = '…' + text.slice(i - 25, i + 70).replace(/\s+/g, ' '); }
      const nbk = LN.getNotebook(n.notebookId);
      const badges = [n.pinned ? 'pin' : '', n.pages.some((p) => p.strokes.length) ? 'pen' : '', n.recordings.length ? 'mic' : '', n.pages.some((p) => p.bg) ? 'filepdf' : ''].filter(Boolean);
      return `<li><button class="note-item ${n.id === cur ? 'active' : ''}" data-note="${n.id}">
        <span class="ni-title"><span class="ni-dot" style="background:${nbk ? nbk.color : '#94a3b8'}"></span>${LN.esc(n.title || 'Untitled note')}</span>
        <span class="ni-snip">${LN.esc(snip) || '<em>Empty note</em>'}</span>
        <span class="ni-meta">${LN.relTime(n.updated)} ${badges.map((b) => LN.icon(b)).join('')}</span>
      </button></li>`;
    }).join('') || `<li class="ni-empty">${q ? 'No notes match your search.' : LN.state.notes.length ? 'No notes in this notebook yet.' : 'No notes yet. Press + to create one.'}</li>`;
  };
  App.renderLibrary = () => { App.renderNotebooks(); App.renderNotes(); };

  App.openNote = (id) => {
    const note = LN.getNote(id);
    App.setView('notes');
    E().open(id);
    if (note && LN.state.ui.notebookId && note.notebookId !== LN.state.ui.notebookId && !App.search) LN.state.ui.notebookId = note.notebookId;
    App.renderLibrary();
    App.closeSidebarMobile();
  };

  App.newNote = () => {
    let nbId = LN.state.ui.notebookId && LN.state.ui.notebookId !== TRASH ? LN.state.ui.notebookId : null;
    if (!nbId || !LN.getNotebook(nbId)) nbId = LN.state.notebooks[0] && LN.state.notebooks[0].id;
    if (!nbId) {
      const nb = { id: LN.uid(), name: 'My Notebook', color: LN.NB_COLORS[0], created: Date.now() };
      LN.state.notebooks.push(nb); nbId = nb.id;
    }
    if (LN.state.ui.notebookId === TRASH) LN.state.ui.notebookId = null;
    const note = LN.newNote(nbId, '');
    LN.state.notes.push(note);
    LN.touch(note);
    App.openNote(note.id);
    setTimeout(() => $('#note-title').focus(), 50);
  };

  App.newNotebook = async () => {
    const r = await LN.dialog({ title: 'New notebook', input: { value: '', placeholder: 'e.g. Chemistry 201' }, colors: LN.NB_COLORS, color: LN.NB_COLORS[LN.state.notebooks.length % LN.NB_COLORS.length], ok: 'Create' });
    if (!r || !r.value) return;
    const nb = { id: LN.uid(), name: r.value, color: r.color, created: Date.now() };
    LN.state.notebooks.push(nb);
    LN.state.ui.notebookId = nb.id;
    LN.save();
    App.renderLibrary();
    App.newNote();
  };

  App.deleteNotebook = async (id) => {
    const nb = LN.getNotebook(id); if (!nb) return;
    const notes = LN.state.notes.filter((n) => n.notebookId === id);
    if (!(await LN.confirm(`Delete “${nb.name}”?`, notes.length ? `Its ${notes.length} note${notes.length > 1 ? 's' : ''} will move to the Trash, where you can restore ${notes.length > 1 ? 'them' : 'it'} for ${TRASH_DAYS} days.` : 'This notebook is empty.'))) return;
    notes.forEach((n) => App.trashNote(n, true));
    LN.state.notebooks = LN.state.notebooks.filter((n) => n !== nb);
    LN.state.events.forEach((ev) => { if (ev.noteId && !LN.getNote(ev.noteId)) ev.noteId = null; });
    if (LN.state.ui.notebookId === id) LN.state.ui.notebookId = null;
    LN.save();
    if (E().note && !LN.getNote(E().note.id)) E().open(App.firstNoteId());
    App.renderLibrary();
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
        if (!LN.getNotebook(n.notebookId)) {
          let nb = LN.state.notebooks.find((b) => b.name === 'Restored');
          if (!nb) { nb = { id: LN.uid(), name: 'Restored', color: '#64748b', created: Date.now() }; S.notebooks.push(nb); }
          n.notebookId = nb.id;
        }
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
    const nbId = LN.state.ui.notebookId === TRASH ? null : LN.state.ui.notebookId;
    const list = LN.state.notes.filter((n) => !nbId || n.notebookId === nbId).sort((a, b) => b.updated - a.updated);
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
      LN.download(`${LN.safeName(note.title)}.latanote`, JSON.stringify({ type: 'latanote-note', version: 1, note: Object.assign({}, note, { recordings: [] }) }), 'application/json');
      LN.toast('Note file downloaded. Anyone with LataNote can import it.');
    } else if (cmd === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(note));
      copy.id = LN.uid(); copy.title = (note.title || 'Untitled note') + ' (copy)'; copy.recordings = []; copy.pinned = false;
      copy.pages.forEach((p) => { p.id = LN.uid(); p.strokes.forEach((s) => delete s.rec); });
      copy.created = copy.updated = Date.now();
      LN.state.notes.push(copy); LN.touch(copy); App.openNote(copy.id);
    } else if (cmd === 'move') {
      const r = await LN.dialog({ title: 'Move to notebook', select: { options: LN.state.notebooks.map((n) => ({ value: n.id, label: n.name })), value: note.notebookId }, ok: 'Move' });
      if (r) { note.notebookId = r.select; LN.touch(note); E().renderChip(); App.renderLibrary(); }
    } else if (cmd === 'clear-ink') E().clearInk();
    else if (cmd === 'delete') {
      LN.audio.stop();
      App.trashNote(note);
      E().open(App.firstNoteId());
      App.renderLibrary();
    } else if (cmd === 'pin') {
      note.pinned = !note.pinned; LN.save(); App.renderLibrary();
      LN.toast(note.pinned ? 'Pinned to the top of the list.' : 'Unpinned.');
    } else if (cmd === 'collab') LN.collab.openLivePanel();
    else if (cmd === 'ocr') LN.extras.ocrNote();
    else if (cmd === 'speak') LN.extras.speak();
    else if (cmd === 'export-md') LN.extras.exportMarkdown();
    else if (cmd === 'dictate') LN.extras.dictate(); else if (cmd === 'add-page') E().addPage();
    else if (cmd === 'import-pdf') $('#file-pdf').click();
    else if (cmd === 'image') { $('#file-image').click(); }
    else if (cmd === 'checklist') E().checklist();
    else if (cmd === 'table') E().table();
    else if (cmd === 'link') E().link();
  };

  /* ---------- export ---------- */
  const PAPER_CSS = {
    lined: 'background-image:linear-gradient(90deg,transparent 79px,#f4b4b4 79px,#f4b4b4 81px,transparent 81px),linear-gradient(transparent 31px,#cfe0f5 31px,#cfe0f5 32px);background-size:100% 100%,100% 32px;',
    grid: 'background-image:linear-gradient(#e3e8f0 1px,transparent 1px),linear-gradient(90deg,#e3e8f0 1px,transparent 1px);background-size:24px 24px;',
    dot: 'background-image:radial-gradient(circle,#c3cad6 1.3px,transparent 1.6px);background-size:24px 24px;',
    cornell: 'background-image:linear-gradient(90deg,transparent 219px,#f4b4b4 219px,#f4b4b4 221px,transparent 221px),linear-gradient(transparent 31px,#cfe0f5 31px,#cfe0f5 32px);background-size:100% 100%,100% 32px;',
    blank: '',
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
.txt{position:relative;padding:38px 56px 64px 96px;font-size:18px;line-height:32px}
.cornell .txt{padding-left:236px}.blank .txt,.grid .txt,.dot .txt{padding:40px 56px}.hasbg .txt{padding:40px 56px}
.txt h1{font-size:30px;line-height:64px;margin:0}.txt h2{font-size:23px;line-height:32px;margin:0 0 0}.txt h3{font-size:19px;line-height:32px;margin:0}
.txt p,.txt ul,.txt ol{margin:0}.txt img{max-width:100%;height:auto}
.txt table{border-collapse:collapse;margin:0 0 32px}.txt td,.txt th{border:1px solid #cbd5e1;padding:0 10px;min-width:80px}
.txt blockquote{margin:0;padding-left:16px;border-left:3px solid #6366f1;color:#475569}
.txt pre{background:#f1f5f9;border-radius:6px;padding:0 12px;margin:0;font-family:ui-monospace,Menlo,monospace;font-size:15px}
ul.checklist{list-style:none;padding-left:32px}ul.checklist li{position:relative}ul.checklist li:before{content:"";position:absolute;left:-28px;top:7px;width:16px;height:16px;border:2px solid #94a3b8;border-radius:4px}
ul.checklist li.done{color:#94a3b8;text-decoration:line-through}ul.checklist li.done:before{background:#6366f1;border-color:#6366f1}
@media print{body{background:#fff}.pg{box-shadow:none;margin:0 auto;page-break-after:always}h1.doc{display:none}}
</style></head><body><h1 class="doc">${LN.esc(note.title || 'Untitled note')}</h1>
${pages.map((p) => `<section class="pg ${p.paper}${p.bg ? ' hasbg' : ''}" style="height:${p.h}px;${PAPER_CSS[p.paper] || ''}">
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
        <div class="page paper-${p.paper}${p.bg ? ' has-bg' : ''}" style="height:${p.h}px">
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
    const vw = window.innerWidth - 32, vh = window.innerHeight - 90;
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
      n.id = LN.uid(); n.recordings = []; n.cards = n.cards || [];
      const nbId = LN.state.ui.notebookId || (LN.state.notebooks[0] && LN.state.notebooks[0].id);
      if (!nbId) { const nb = { id: LN.uid(), name: 'Imported', color: LN.NB_COLORS[0], created: Date.now() }; LN.state.notebooks.push(nb); n.notebookId = nb.id; }
      else n.notebookId = nbId;
      n.updated = Date.now();
      LN.state.notes.push(n);
      LN.touch(n); App.openNote(n.id);
      LN.toast(`Imported “${n.title || 'Untitled note'}”.`);
    } else if (data.type === 'latanote-notebook' && data.notebook && Array.isArray(data.notes)) {
      const nb = Object.assign({}, data.notebook, { id: LN.uid(), created: Date.now() });
      delete nb.shared;
      LN.state.notebooks.push(nb);
      data.notes.forEach((n) => { n.id = LN.uid(); n.notebookId = nb.id; n.recordings = []; n.cards = n.cards || []; n.updated = Date.now(); LN.state.notes.push(n); });
      LN.state.ui.notebookId = nb.id;
      LN.save(); App.renderLibrary(); E().open(App.firstNoteId());
      LN.toast(`Imported notebook “${nb.name}” with ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}.`);
    } else if (data.type === 'latanote-backup' && data.state && Array.isArray(data.state.notes)) {
      if (!(await LN.confirm('Restore this backup?', `This replaces everything on this device with ${data.state.notes.length} notes from ${data.exported ? new Date(data.exported).toLocaleString() : 'the backup'}.`, 'Restore'))) return;
      LN.state = Object.assign({ notebooks: [], notes: [], events: [], trash: [], settings: { penOnly: false }, ui: {} }, data.state);
      LN.state.ui.samplesRemoved = true;
      LN.save();
      App.renderLibrary();
      E().open(LN.state.ui.noteId && LN.getNote(LN.state.ui.noteId) ? LN.state.ui.noteId : App.firstNoteId());
      LN.toast('Backup restored.');
    } else LN.toast('That file isn’t a LataNote note or backup.');
  };

  /* ---------- views & layout ---------- */
  App.setView = (v) => {
    App.view = v;
    $('#view-notes').hidden = v !== 'notes';
    $('#view-planner').hidden = v !== 'planner';
    $$('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    document.body.classList.toggle('view-planner', v === 'planner');
    if (v === 'planner') { LN.audio.stopPlayback(); LN.planner.render(); if (LN.study.open) LN.study.toggle(false); }
    else if (E().note) { E().computeFit(); E().pages.forEach(E().layout); }
  };
  App.closeSidebarMobile = () => document.body.classList.remove('sidebar-open');

  const setTheme = App.setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('latanote-theme', t);
    $('#theme-toggle').innerHTML = LN.icon(t === 'dark' ? 'sun' : 'moon');
  };

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
    $$('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
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
    setTheme(document.documentElement.dataset.theme || 'light');

    App.purgeTrash();
    LN.audio.init(); LN.planner.init(); LN.study.init(); LN.extras.init();
    LN.on('ink-selection', (on) => document.body.classList.toggle('has-sel', !!on));
    $('#note-list').addEventListener('click', (e) => { const b = e.target.closest('[data-trash]'); if (b) { e.stopPropagation(); App.trashAction(b.dataset.trash, b.dataset.id); } });
    $('#templates').addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) E().applyTemplate(b.dataset.tpl); });
    LN.on('notes-changed', LN.debounce(() => { App.renderLibrary(); if (App.view === 'planner') LN.planner.render(); }, 300));

    // sidebar
    $('#notebook-list').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-nb-edit]');
      if (ed) { e.stopPropagation(); App.nbMenu(ed.dataset.nbEdit); return; }
      const b = e.target.closest('[data-nb]'); if (!b) return;
      LN.state.ui.notebookId = b.dataset.nb || null;
      App.search = ''; $('#search').value = '';
      LN.save();
      App.renderLibrary();
      if (App.view !== 'notes') App.setView('notes');
      const cur = E().note;
      if (LN.state.ui.notebookId !== TRASH && (!cur || (LN.state.ui.notebookId && cur.notebookId !== LN.state.ui.notebookId))) E().open(App.firstNoteId());
      App.renderNotes();
    });
    $('#note-list').addEventListener('click', (e) => { const b = e.target.closest('[data-note]'); if (b) App.openNote(b.dataset.note); });
    $('#add-note').addEventListener('click', App.newNote);
    $('#add-notebook').addEventListener('click', App.newNotebook);
    $('#search').addEventListener('input', LN.debounce((e) => { App.search = e.target.value; App.renderNotes(); }, 120));
    $$('.view-btn').forEach((b) => b.addEventListener('click', () => { App.setView(b.dataset.view); App.closeSidebarMobile(); }));
    $$('[data-action="toggle-sidebar"]').forEach((b) => b.addEventListener('click', () => document.body.classList.toggle('sidebar-open')));
    $('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    $('#file-import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) App.importFile(f); });

    // title
    $('#note-title').addEventListener('input', (e) => { const n = E().note; if (!n) return; n.title = e.target.value; LN.touch(n); });
    $('#note-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (E().mode === 'type') E().focusEnd(); else e.target.blur(); } });

    // mode
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => E().setMode(b.dataset.mode)));

    // toolbar: keep text selection when pressing buttons
    $('#toolbar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
    $('#toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.exec) E().exec(b.dataset.exec, b.dataset.arg || null);
      else if (b.dataset.cmd) App.noteCmd(b.dataset.cmd);
      else if (b.dataset.tool) App.setTool(b.dataset.tool);
      else if (b.dataset.color) App.setColor(b.dataset.color);
      else if (b.dataset.size) { LN.tool.size = +b.dataset.size; $$('#sizes .size').forEach((x) => x.classList.toggle('active', x === b)); }
      else if (b.dataset.zoom != null) E().setZoom(+b.dataset.zoom);
      else if (b.dataset.sel && LN.inkSel) { const a = b.dataset.sel; if (a === 'delete') LN.inkSel.deleteSel(); else if (a === 'duplicate') LN.inkSel.duplicateSel(); else if (a === 'ocr') LN.extras.ocrSelection(); }
    });
    $('#block-select').addEventListener('change', (e) => E().exec('formatBlock', '<' + e.target.value + '>'));
    $('#fore-color').addEventListener('input', (e) => { $('#fore-bar').style.background = e.target.value; });
    $('#fore-color').addEventListener('change', (e) => E().exec('foreColor', e.target.value));
    $('#fore-bar').style.background = $('#fore-color').value;
    $('#ink-color').addEventListener('input', (e) => App.setColor(e.target.value));
    $('#paper-select').addEventListener('change', (e) => E().setPaper(e.target.value));
    $('#undo-btn').addEventListener('click', () => E().doUndo());
    $('#redo-btn').addEventListener('click', () => E().doRedo());
    $('#pen-only').checked = !!LN.state.settings.penOnly;
    document.body.classList.toggle('pen-only', !!LN.state.settings.penOnly);
    $('#pen-only').addEventListener('change', (e) => { LN.state.settings.penOnly = e.target.checked; document.body.classList.toggle('pen-only', e.target.checked); LN.save(); LN.toast(e.target.checked ? 'Stylus only: fingers now scroll instead of drawing.' : 'Fingers and stylus can both draw.'); });
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
    $('#empty').addEventListener('click', (e) => { if (e.target.closest('[data-cmd="new-note"]')) App.newNote(); });

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
    $('#present-btn').addEventListener('click', App.present);
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
      if (mod && e.key.toLowerCase() === 'k' && !e.shiftKey) { e.preventDefault(); document.body.classList.add('sidebar-open'); $('#search').focus(); return; }
      if (inField || mod || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') { LN.extras.toggleFullscreen(); return; }
      if (e.key === '?') { LN.extras.shortcuts(); return; }
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
    const startNote = LN.state.ui.noteId && LN.getNote(LN.state.ui.noteId) ? LN.state.ui.noteId : App.firstNoteId();
    E().setMode('type');
    E().open(startNote);
    App.renderLibrary();
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'planner') App.setView('planner');
    if (params.get('new') === '1') App.newNote();
    LN.collab.checkInvite();
    // opened by double-clicking a .latanote file (installed app)
    if ('launchQueue' in window) window.launchQueue.setConsumer(async (params) => { for (const h of params.files || []) App.importFile(await h.getFile()); });
  };

  App.nbMenu = async (id) => {
    const nb = LN.getNotebook(id); if (!nb) return;
    const r = await LN.dialog({ title: 'Edit notebook', input: { value: nb.name }, colors: LN.NB_COLORS, color: nb.color, select: { options: [{ value: 'keep', label: 'Save changes' }, { value: 'export', label: 'Share notebook as a file' }, { value: 'delete', label: 'Delete notebook…' }], value: 'keep' }, ok: 'OK' });
    if (!r) return;
    if (r.select === 'delete') return App.deleteNotebook(id);
    if (r.select === 'export') {
      const notes = LN.state.notes.filter((n) => n.notebookId === id).map((n) => Object.assign({}, n, { recordings: [] }));
      LN.download(`${LN.safeName(nb.name)}.latanote`, JSON.stringify({ type: 'latanote-notebook', version: 1, notebook: { name: nb.name, color: nb.color }, notes }), 'application/json');
      LN.toast('Notebook file downloaded. Share it with your class or team; they can import it from Settings.');
      return;
    }
    if (r.value) nb.name = r.value;
    if (r.color) nb.color = r.color;
    LN.save(); App.renderLibrary(); E().renderChip();
  };

  document.addEventListener('DOMContentLoaded', () => App.init().catch((e) => { console.error(e); LN.toast('LataNote failed to start: ' + e.message); }));
})();

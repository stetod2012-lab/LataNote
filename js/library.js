/* LataNote library: Folder › Divider › Notebook › Section › Note, the sidebar tree and the All notes page */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;
  const TRASH = '__trash';

  const TYPES = {
    folder: { level: 0, label: 'Folder', icon: 'folder', hint: 'Group anything, e.g. “School” or “Work”' },
    divider: { level: 1, label: 'Divider', icon: 'divider', hint: 'Split a folder into parts, e.g. “Semester 1”' },
    notebook: { level: 2, label: 'Notebook', icon: 'book', hint: 'A subject or project, e.g. “Biology”' },
    section: { level: 3, label: 'Section', icon: 'section', hint: 'A part of a notebook, e.g. “Unit 1: Cells”' },
  };
  const ORDER = ['folder', 'divider', 'notebook', 'section'];

  const L = (LN.lib = { TYPES, TRASH, search: '', sort: 'recent' });

  /* ---------- model helpers ---------- */
  const all = () => LN.state.notebooks;
  L.get = (id) => all().find((c) => c.id === id);
  L.children = (id) => all().filter((c) => (c.parentId || null) === (id || null))
    .sort((a, b) => (a.order ?? a.created ?? 0) - (b.order ?? b.created ?? 0));
  L.descendants = (id) => { const out = []; const walk = (pid) => L.children(pid).forEach((c) => { out.push(c); walk(c.id); }); walk(id); return out; };
  L.path = (id) => { const out = []; let c = L.get(id); let guard = 0; while (c && guard++ < 50) { out.unshift(c); c = L.get(c.parentId); } return out; };
  L.notesIn = (id, deep) => {
    const ids = new Set([id].concat(deep ? L.descendants(id).map((c) => c.id) : []));
    return LN.state.notes.filter((n) => ids.has(n.notebookId || null));
  };
  L.countDeep = (id) => L.notesIn(id, true).length;
  // can a container of `childType` live inside `parent` (null = top level)?
  L.canContain = (parent, childType) => {
    if (!parent) return true;
    if (parent.type === 'folder') return true;
    return TYPES[childType].level > TYPES[parent.type].level;
  };
  L.allowedChildTypes = (parent) => ORDER.filter((t) => L.canContain(parent, t));
  L.pathText = (note) => L.path(note.notebookId).map((c) => c.name).join(' › ');
  L.colorOf = (id) => { const p = L.path(id).reverse().find((c) => c.color); return p ? p.color : '#94a3b8'; };

  // migrate old flat notebooks
  L.migrate = () => {
    all().forEach((c, i) => {
      if (!c.type) c.type = 'notebook';
      if (c.parentId === undefined) c.parentId = null;
      if (c.order === undefined) c.order = c.created || i;
    });
  };

  // where a new note should go
  L.currentContainer = () => {
    const id = LN.state.ui.containerId;
    return id && id !== TRASH ? L.get(id) || null : null;
  };

  /* ---------- create / edit / move / delete ---------- */
  L.create = async (type, parentId) => {
    const parent = parentId ? L.get(parentId) : null;
    if (!L.canContain(parent, type)) { LN.toast(`A ${TYPES[type].label.toLowerCase()} can’t go inside a ${TYPES[parent.type].label.toLowerCase()}.`); return null; }
    const sibs = L.children(parentId);
    const r = await LN.dialog({
      title: `New ${TYPES[type].label.toLowerCase()}${parent ? ` in “${parent.name}”` : ''}`,
      message: TYPES[type].hint,
      input: { value: '', placeholder: `${TYPES[type].label} name` },
      colors: type === 'divider' ? null : LN.NB_COLORS,
      color: LN.NB_COLORS[(all().length) % LN.NB_COLORS.length],
      ok: 'Create',
    });
    if (!r || !r.value) return null;
    const c = { id: LN.uid(), type, name: r.value, color: r.color || null, parentId: parentId || null, order: (sibs.length ? Math.max(...sibs.map((s) => s.order || 0)) : 0) + 1, created: Date.now() };
    all().push(c);
    if (parent) parent.collapsed = false;
    LN.save();
    L.open(type === 'divider' ? parentId : c.id);
    return c;
  };

  L.rename = async (id) => {
    const c = L.get(id); if (!c) return;
    const r = await LN.dialog({ title: `Edit ${TYPES[c.type].label.toLowerCase()}`, input: { value: c.name }, colors: c.type === 'divider' ? null : LN.NB_COLORS, color: c.color, ok: 'Save' });
    if (!r) return;
    if (r.value) c.name = r.value;
    if (r.color) c.color = r.color;
    LN.save(); L.render(); LN.editor.renderChip();
  };

  // destinations for moving a container or note: [{id, label, depth}]
  const destinations = (forType, movingId) => {
    const out = [];
    const banned = movingId ? new Set([movingId].concat(L.descendants(movingId).map((c) => c.id))) : new Set();
    const walk = (pid, depth) => L.children(pid).forEach((c) => {
      if (banned.has(c.id)) return;
      const ok = forType === 'note' ? c.type !== 'divider' || true : L.canContain(c, forType);
      if (ok) out.push({ id: c.id, label: `${' '.repeat(depth)}${TYPES[c.type].label}: ${c.name}`, depth });
      walk(c.id, depth + 1);
    });
    walk(null, 0);
    return out;
  };

  L.moveDialog = async (kind, id) => {
    const item = kind === 'note' ? LN.getNote(id) : L.get(id); if (!item) return;
    const forType = kind === 'note' ? 'note' : item.type;
    const opts = [{ value: '', label: kind === 'note' ? 'All notes (no folder)' : 'Top level' }].concat(destinations(forType, kind === 'note' ? null : id).map((d) => ({ value: d.id, label: d.label })));
    const r = await LN.dialog({ title: `Move “${item.title || item.name || 'Untitled note'}”`, message: 'Choose where it should go:', select: { options: opts, value: (kind === 'note' ? item.notebookId : item.parentId) || '' }, ok: 'Move' });
    if (!r) return;
    L.moveTo(kind, id, r.select || null);
  };

  L.moveTo = (kind, id, destId) => {
    const dest = destId ? L.get(destId) : null;
    if (kind === 'note') {
      const n = LN.getNote(id); if (!n) return false;
      n.notebookId = destId || null; LN.touch(n);
      LN.toast(`Moved to ${dest ? `“${dest.name}”` : 'All notes'}.`);
    } else {
      const c = L.get(id); if (!c) return false;
      if (destId === id || L.descendants(id).some((d) => d.id === destId)) { LN.toast('You can’t move something inside itself.'); return false; }
      if (!L.canContain(dest, c.type)) { LN.toast(`A ${TYPES[c.type].label.toLowerCase()} can’t go inside a ${TYPES[dest.type].label.toLowerCase()}. The order is Folder › Divider › Notebook › Section.`); return false; }
      c.parentId = destId || null;
      c.order = Date.now();
      if (dest) dest.collapsed = false;
      LN.save();
    }
    L.render(); LN.editor.renderChip();
    return true;
  };

  L.remove = async (id) => {
    const c = L.get(id); if (!c) return;
    const notes = L.notesIn(id, true), subs = L.descendants(id);
    const what = [subs.length ? `${subs.length} item${subs.length > 1 ? 's' : ''} inside it` : '', notes.length ? `${notes.length} note${notes.length > 1 ? 's' : ''} (moved to Trash, restorable for 30 days)` : ''].filter(Boolean).join(' and ');
    if (!(await LN.confirm(`Delete ${TYPES[c.type].label.toLowerCase()} “${c.name}”?`, what ? `This also removes ${what}.` : `This ${TYPES[c.type].label.toLowerCase()} is empty.`))) return;
    notes.forEach((n) => LN.app.trashNote(n, true));
    const gone = new Set([id].concat(subs.map((s) => s.id)));
    LN.state.notebooks = all().filter((x) => !gone.has(x.id));
    LN.state.events.forEach((ev) => { if (ev.noteId && !LN.getNote(ev.noteId)) ev.noteId = null; });
    if (gone.has(LN.state.ui.containerId)) LN.state.ui.containerId = c.parentId || null;
    if (LN.editor.note && !LN.getNote(LN.editor.note.id)) { LN.editor.open(null); LN.app.setView('library'); }
    LN.save(); L.render();
  };

  /* export / import a container with everything inside it */
  L.exportContainer = (id) => {
    const c = L.get(id); if (!c) return;
    const containers = [c].concat(L.descendants(id)).map((x) => Object.assign({}, x));
    const notes = L.notesIn(id, true).map((n) => Object.assign({}, n, { recordings: [] }));
    LN.download(`${LN.safeName(c.name)}.latanote`, JSON.stringify({ type: 'latanote-notebook', version: 2, root: id, containers, notes, papers: LN.papersUsedBy(notes) }), 'application/json');
    LN.toast(`${TYPES[c.type].label} downloaded. Others can import it from Settings.`);
  };
  L.importContainer = (data) => {
    LN.mergePapers(data.papers);
    const map = {};
    let containers = data.containers;
    if (!containers) { // version 1: single notebook
      containers = [Object.assign({ type: 'notebook' }, data.notebook, { id: 'old-root' })];
      data.root = 'old-root';
      data.notes.forEach((n) => { n.notebookId = 'old-root'; });
    }
    containers.forEach((c) => { map[c.id] = LN.uid(); });
    const parent = L.currentContainer();
    containers.forEach((c) => {
      const copy = Object.assign({}, c, { id: map[c.id], created: Date.now(), order: Date.now() });
      delete copy.shared;
      copy.parentId = c.id === data.root ? (parent && L.canContain(parent, c.type) ? parent.id : null) : map[c.parentId] || null;
      all().push(copy);
    });
    data.notes.forEach((n) => { n.id = LN.uid(); n.notebookId = map[n.notebookId] || map[data.root]; n.recordings = []; n.cards = n.cards || []; n.updated = Date.now(); LN.state.notes.push(n); });
    LN.save();
    L.open(map[data.root]);
    LN.toast(`Imported “${containers.find((c) => c.id === data.root).name}” with ${data.notes.length} note${data.notes.length === 1 ? '' : 's'}.`);
  };

  /* ---------- navigation ---------- */
  L.open = (id) => {
    LN.state.ui.containerId = id || null;
    if (id && id !== TRASH) {
      L.path(id).forEach((p) => { if (p.id !== id) p.collapsed = false; });
      const c = L.get(id);
      if (c && c.type === 'section') { LN.state.ui.containerId = c.parentId && L.get(c.parentId) && L.get(c.parentId).type === 'notebook' ? c.parentId : id; LN.state.ui.sectionTab = c.parentId && L.get(c.parentId) && L.get(c.parentId).type === 'notebook' ? id : null; }
      else LN.state.ui.sectionTab = null;
    }
    L.search = ''; const s = $('#search'); if (s) s.value = '';
    LN.save();
    LN.app.setView('library');
    LN.app.closeSidebarMobile();
    L.render();
    $('#lib').scrollTop = 0;
  };

  /* ---------- sidebar tree ---------- */
  L.renderTree = () => {
    const cur = LN.app.view === 'library' ? (LN.state.ui.sectionTab || LN.state.ui.containerId) : (LN.editor.note ? LN.editor.note.notebookId : null);
    const rows = [];
    const walk = (pid, depth) => L.children(pid).forEach((c) => {
      const kids = L.children(c.id);
      const n = L.countDeep(c.id);
      rows.push(`<li class="tr tr-${c.type} ${cur === c.id ? 'active' : ''}" style="--d:${depth}" data-cid="${c.id}" draggable="true">
        <button class="tr-tw ${kids.length ? '' : 'leaf'}" data-tw="${c.id}" aria-label="${c.collapsed ? 'Expand' : 'Collapse'}">${kids.length ? LN.icon(c.collapsed ? 'chevright' : 'chevdown') : ''}</button>
        <button class="tr-main" data-open="${c.id}">
          ${c.type === 'divider' ? '' : `<span class="tr-ico" style="--c:${c.color || L.colorOf(c.id)}">${LN.icon(TYPES[c.type].icon)}</span>`}
          <span class="tr-name">${LN.esc(c.name)}</span>
        </button>
        <span class="tr-count">${n || ''}</span>
        <button class="tr-act" data-tmenu="${c.id}" aria-label="Options for ${LN.esc(c.name)}">${LN.icon('more')}</button>
      </li>`);
      if (!c.collapsed) walk(c.id, depth + 1);
    });
    walk(null, 0);
    $('#tree').innerHTML = rows.join('') || '<li class="tr-empty">Create a folder or notebook with the + button above.</li>';
    $('#nav-all-count').textContent = LN.state.notes.length || '';
    $('#nav-all').classList.toggle('active', LN.app.view === 'library' && !LN.state.ui.containerId && !L.search);
    $('#nav-trash').classList.toggle('active', LN.app.view === 'library' && LN.state.ui.containerId === TRASH);
    $('#nav-trash-count').textContent = (LN.state.trash || []).length || '';
  };

  const containerMenu = (c) => {
    const kids = L.allowedChildTypes(c);
    return kids.map((t) => `<button data-pick="new:${t}">${LN.icon(TYPES[t].icon)} New ${TYPES[t].label.toLowerCase()} inside</button>`).join('') +
      (c.type !== 'divider' ? `<button data-pick="note">${LN.icon('note')} New note here</button>` : '') +
      `<hr><button data-pick="rename">${LN.icon('edit')} Rename / color</button>
      <button data-pick="move">${LN.icon('move')} Move to…</button>
      <button data-pick="export">${LN.icon('share')} Share as a file</button>
      <hr><button data-pick="delete" class="danger">${LN.icon('trash')} Delete</button>`;
  };
  L.containerAction = (act, id) => {
    if (act.startsWith('new:')) return L.create(act.slice(4), id);
    if (act === 'note') return LN.app.newNote(id);
    if (act === 'rename') return L.rename(id);
    if (act === 'move') return L.moveDialog('container', id);
    if (act === 'export') return L.exportContainer(id);
    if (act === 'delete') return L.remove(id);
  };

  L.newMenu = (parentId) => {
    const parent = parentId ? L.get(parentId) : null;
    const types = L.allowedChildTypes(parent);
    return `<button data-pick="note">${LN.icon('note')}<span><b>Note</b><small>A page to write, type and draw on</small></span></button><hr>` +
      types.map((t) => `<button data-pick="new:${t}">${LN.icon(TYPES[t].icon)}<span><b>${TYPES[t].label}</b><small>${TYPES[t].hint}</small></span></button>`).join('');
  };

  /* ---------- the library page ---------- */
  const fmtDate = (ts) => LN.relTime(ts);
  const sortNotes = (notes) => {
    const s = L.sort;
    return notes.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      (s === 'name' ? (a.title || '').localeCompare(b.title || '') : s === 'created' ? b.created - a.created : b.updated - a.updated));
  };

  const noteCard = (n, showPath) => {
    const badges = [n.pages.some((p) => p.strokes.length) ? 'pen' : '', n.recordings.length ? 'mic' : '', n.pages.some((p) => p.bg) ? 'filepdf' : ''].filter(Boolean);
    const path = showPath ? L.pathText(n) : '';
    return `<article class="card" data-note="${n.id}" draggable="true">
      <button class="card-thumb" data-opennote="${n.id}" aria-label="Open ${LN.esc(n.title || 'Untitled note')}"><div class="thumb" data-thumb="${n.id}"></div>
        ${n.pages.length > 1 ? `<span class="card-pages">${n.pages.length} pages</span>` : ''}${n.pinned ? `<span class="card-pin">${LN.icon('pin')}</span>` : ''}</button>
      <div class="card-info">
        <div class="card-title" title="${LN.esc(n.title || 'Untitled note')}">${LN.esc(n.title || 'Untitled note')}</div>
        <div class="card-meta"><span>${fmtDate(n.updated)}</span>${badges.map((b) => LN.icon(b)).join('')}</div>
        ${path ? `<div class="card-path" title="${LN.esc(path)}"><span style="background:${L.colorOf(n.notebookId)}"></span>${LN.esc(path)}</div>` : ''}
      </div>
      <button class="card-more" data-cardmenu="${n.id}" aria-label="Note options">${LN.icon('more')}</button>
    </article>`;
  };

  const tile = (c) => {
    const n = L.countDeep(c.id), kids = L.children(c.id).length;
    const sub = [kids ? `${kids} item${kids > 1 ? 's' : ''}` : '', `${n} note${n === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
    const color = c.color || L.colorOf(c.id);
    if (c.type === 'notebook') {
      return `<button class="tile tile-notebook" data-open="${c.id}" data-cid="${c.id}" draggable="true" style="--c:${color}"><span class="cover"><span class="cover-label">${LN.esc(c.name)}</span></span><span class="tile-name">${LN.esc(c.name)}</span><span class="tile-sub">${sub}</span></button>`;
    }
    const peek = L.children(c.id).filter((k) => k.type !== 'divider').slice(0, 3).map((k) => `<i style="background:${k.color || color}"></i>`).join('');
    return `<button class="tile tile-${c.type}" data-open="${c.id}" data-cid="${c.id}" draggable="true" style="--c:${color}"><span class="art art-${c.type}"><span class="art-tab"></span><span class="art-body">${LN.icon(TYPES[c.type].icon)}<span class="art-peek">${peek}</span></span></span><span class="tile-name">${LN.esc(c.name)}</span><span class="tile-sub">${TYPES[c.type].label} · ${sub}</span></button>`;
  };

  // children of a folder/root: dividers become headings that group what's inside them
  const childBlocks = (pid) => {
    const kids = L.children(pid);
    const plain = kids.filter((c) => c.type !== 'divider'), dividers = kids.filter((c) => c.type === 'divider');
    let html = plain.length ? `<div class="tiles">${plain.map(tile).join('')}</div>` : '';
    dividers.forEach((d) => {
      const inner = L.children(d.id), dn = L.notesIn(d.id, false);
      html += `<div class="divider-block" data-cid="${d.id}">
        <div class="divider-head"><span class="divider-name" data-open="${d.id}">${LN.esc(d.name)}</span><span class="divider-line"></span><button class="icon-btn sm" data-tmenu="${d.id}" aria-label="Divider options">${LN.icon('more')}</button></div>
        ${inner.length ? `<div class="tiles">${inner.map(tile).join('')}</div>` : ''}
        ${dn.length ? `<div class="grid">${sortNotes(dn).map((n) => noteCard(n)).join('')}</div>` : ''}
        ${!inner.length && !dn.length ? `<p class="lib-hint">Empty divider. <button class="link-btn" data-pick-new="notebook" data-parent="${d.id}">Add a notebook</button></p>` : ''}
      </div>`;
    });
    return html;
  };

  L.render = () => {
    L.renderTree();
    if (LN.app.view !== 'library') return;
    const ui = LN.state.ui, root = $('#lib');
    const q = L.search.trim().toLowerCase();
    const id = ui.containerId;
    let crumbs = `<button class="crumb" data-open="">${LN.icon('home')} All notes</button>`;
    let html = '';
    const newBtnParent = id && id !== TRASH ? id : '';

    if (q) {
      const res = sortNotes(LN.state.notes.filter((n) => (n.title + '\n' + LN.noteText(n)).toLowerCase().includes(q)));
      crumbs += `<span class="crumb-sep">›</span><span class="crumb cur">Search: “${LN.esc(L.search)}”</span>`;
      html = `<h1 class="lib-title">${res.length} result${res.length === 1 ? '' : 's'}</h1>` +
        (res.length ? `<div class="grid">${res.map((n) => noteCard(n, true)).join('')}</div>` : '<div class="lib-empty"><p>No notes match your search.</p></div>');
    } else if (id === TRASH) {
      const items = (LN.state.trash || []).slice().sort((a, b) => b.deletedAt - a.deletedAt);
      crumbs += `<span class="crumb-sep">›</span><span class="crumb cur">Trash</span>`;
      html = `<div class="lib-head"><h1 class="lib-title">Trash</h1>${items.length ? '<button class="btn btn-ghost btn-sm" data-trash="empty">Empty trash</button>' : ''}</div>
        <p class="lib-hint">Notes are deleted forever 30 days after you trash them.</p>` +
        (items.length ? `<div class="grid">${items.map((n) => `<article class="card trashed"><div class="card-thumb"><div class="thumb" data-thumb-trash="${n.id}"></div></div>
          <div class="card-info"><div class="card-title">${LN.esc(n.title || 'Untitled note')}</div><div class="card-meta">Deleted ${LN.relTime(n.deletedAt)}</div>
          <div class="card-actions"><button class="btn btn-soft btn-sm" data-trash="restore" data-id="${n.id}">Restore</button><button class="btn btn-ghost btn-sm" data-trash="purge" data-id="${n.id}">Delete</button></div></div></article>`).join('')}</div>`
          : '<div class="lib-empty"><p>Trash is empty.</p></div>');
    } else if (!id) {
      const notes = sortNotes(LN.state.notes);
      const hasContainers = L.children(null).length > 0;
      html = `<div class="lib-head"><h1 class="lib-title">All notes <span class="lib-count">${notes.length || ''}</span></h1></div>` +
        (hasContainers ? `<h2 class="lib-sub">Folders &amp; notebooks</h2>${childBlocks(null)}` : '') +
        (notes.length ? `${hasContainers ? '<h2 class="lib-sub">Every note</h2>' : ''}<div class="grid">${notes.map((n) => noteCard(n, true)).join('')}</div>`
          : `<div class="lib-empty">${LN.icon('note')}<h2>Nothing here yet</h2><p>Start with a note, or organize first: Folder › Divider › Notebook › Section › Note.</p>
            <div class="lib-empty-actions"><button class="btn btn-primary" data-pick-new="note">${LN.icon('plus')} New note</button><button class="btn btn-ghost" data-pick-new="folder">${LN.icon('folder')} New folder</button><button class="btn btn-ghost" data-pick-new="notebook">${LN.icon('book')} New notebook</button></div></div>`);
    } else {
      const c = L.get(id);
      if (!c) { ui.containerId = null; return L.render(); }
      L.path(id).forEach((p, i, arr) => { crumbs += `<span class="crumb-sep">›</span><button class="crumb ${i === arr.length - 1 ? 'cur' : ''}" data-open="${p.id}">${LN.esc(p.name)}</button>`; });
      const head = `<div class="lib-head"><span class="lib-type" style="--c:${c.color || L.colorOf(c.id)}">${LN.icon(TYPES[c.type].icon)} ${TYPES[c.type].label}</span>
        <h1 class="lib-title">${LN.esc(c.name)}</h1><button class="icon-btn" data-tmenu="${c.id}" aria-label="Options">${LN.icon('more')}</button></div>`;
      if (c.type === 'notebook') {
        const sections = L.children(id).filter((s) => s.type === 'section');
        const tab = ui.sectionTab && sections.some((s) => s.id === ui.sectionTab) ? ui.sectionTab : null;
        const tabs = `<div class="tabs-row"><button class="sec-tab ${!tab ? 'on' : ''}" data-tab="">All</button>${sections.map((s) => `<button class="sec-tab ${tab === s.id ? 'on' : ''}" data-tab="${s.id}" data-cid="${s.id}" style="--c:${s.color || c.color || '#6366f1'}">${LN.esc(s.name)}<span>${L.notesIn(s.id, true).length}</span></button>`).join('')}
          <button class="sec-tab add" data-pick-new="section" data-parent="${id}">${LN.icon('plus')} Section</button></div>`;
        let body = '';
        if (tab) {
          const ns = sortNotes(L.notesIn(tab, true));
          body = `<div class="grid">${ns.map((n) => noteCard(n)).join('')}${addCard(tab)}</div>`;
        } else {
          const direct = sortNotes(L.notesIn(id, false));
          body = (direct.length || !sections.length ? `<div class="grid">${direct.map((n) => noteCard(n)).join('')}${addCard(id)}</div>` : '') +
            sections.map((s) => { const ns = sortNotes(L.notesIn(s.id, true)); return `<h2 class="lib-sub sec-h" style="--c:${s.color || c.color}" data-cid="${s.id}"><button class="link-plain" data-tab="${s.id}">${LN.esc(s.name)}</button><small>${ns.length}</small></h2><div class="grid">${ns.map((n) => noteCard(n)).join('')}${addCard(s.id)}</div>`; }).join('');
        }
        const other = L.children(id).filter((s) => s.type !== 'section');
        html = head + tabs + body + (other.length ? childBlocks(id) : '');
      } else {
        const direct = sortNotes(L.notesIn(id, false));
        html = head + childBlocks(id) +
          (c.type !== 'divider' || direct.length ? `${L.children(id).length ? '<h2 class="lib-sub">Notes</h2>' : ''}<div class="grid">${direct.map((n) => noteCard(n)).join('')}${addCard(id)}</div>` : '');
        if (!L.children(id).length && !direct.length) html = head + emptyIn(id);
      }
    }
    $('#crumbs').innerHTML = crumbs;
    const tabSel = id && id !== TRASH && L.get(id) && L.get(id).type === 'notebook' && ui.sectionTab && L.get(ui.sectionTab) ? ui.sectionTab : null;
    $('#lib-new').dataset.parent = tabSel || newBtnParent;
    $('#lib-new').hidden = id === TRASH;
    root.innerHTML = html;
    lazyThumbs();
  };
  const addCard = (cid) => `<button class="card add-card" data-pick-new="note" data-parent="${cid}">${LN.icon('plus')}<span>New note</span></button>`;
  const emptyIn = (cid) => {
    const c = L.get(cid), types = L.allowedChildTypes(c).filter((t) => t !== 'folder' || c.type === 'folder');
    return `<div class="lib-empty">${LN.icon(TYPES[c.type].icon)}<h2>This ${TYPES[c.type].label.toLowerCase()} is empty</h2>
      <div class="lib-empty-actions">${c.type !== 'divider' ? `<button class="btn btn-primary" data-pick-new="note" data-parent="${cid}">${LN.icon('plus')} New note</button>` : ''}
      ${types.map((t) => `<button class="btn btn-ghost" data-pick-new="${t}" data-parent="${cid}">${LN.icon(TYPES[t].icon)} New ${TYPES[t].label.toLowerCase()}</button>`).join('')}</div></div>`;
  };

  /* ---------- page thumbnails ---------- */
  const TW = 168; // thumbnail width in px
  L.drawThumb = (el, note) => {
    if (!note) return;
    const pg = note.pages[0]; if (!pg) return;
    const k = TW / LN.PAGE_W;
    const eff = LN.effPaper(note, pg);
    const small = LN.paperStyle(pg.bg ? { paper: 'blank', spacing: eff.spacing, color: eff.color } : eff, k);
    const full = LN.paperStyle(pg.bg ? { paper: 'blank', spacing: eff.spacing, color: eff.color } : eff, 1);
    el.style.cssText = small.style.replace(/--[a-z-]+:[^;]+;/g, '');
    const html = (pg.html || '').replace(/contenteditable/gi, 'data-x');
    el.innerHTML = `${pg.bg ? `<img class="thumb-bg" src="${pg.bg}" alt="">` : ''}<div class="thumb-text page-text${pg.bg ? ' on-bg' : ''}" style="${full.style.match(/--[^;]+;/g).join('')};transform:scale(${k})">${html}</div><canvas class="thumb-ink"></canvas>`;
    if (pg.strokes.length) {
      const c = el.querySelector('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
      const h = Math.round(TW * (LN.PAGE_H / LN.PAGE_W));
      c.width = TW * dpr; c.height = h * dpr;
      LN.renderStrokes(c, pg.strokes, LN.PAGE_W, LN.PAGE_H, k * dpr, null, null);
    }
  };
  let io = null;
  const lazyThumbs = () => {
    if (io) io.disconnect();
    const els = $$('#lib [data-thumb], #lib [data-thumb-trash]');
    const draw = (el) => L.drawThumb(el, el.dataset.thumb ? LN.getNote(el.dataset.thumb) : (LN.state.trash || []).find((n) => n.id === el.dataset.thumbTrash));
    if (!('IntersectionObserver' in window)) { els.forEach(draw); return; }
    io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); draw(en.target); } }), { root: $('#lib'), rootMargin: '300px' });
    els.forEach((el) => io.observe(el));
  };

  /* ---------- card menu ---------- */
  const cardMenu = (n) => `<button data-pick="open">${LN.icon('note')} Open</button>
    <button data-pick="pin">${LN.icon('pin')} ${n.pinned ? 'Unpin' : 'Pin to top'}</button>
    <button data-pick="rename">${LN.icon('edit')} Rename</button>
    <button data-pick="duplicate">${LN.icon('copy')} Duplicate</button>
    <button data-pick="move">${LN.icon('move')} Move to…</button>
    <hr><button data-pick="trash" class="danger">${LN.icon('trash')} Move to trash</button>`;
  const cardAction = async (act, id) => {
    const n = LN.getNote(id); if (!n) return;
    if (act === 'open') LN.app.openNote(id);
    else if (act === 'pin') { n.pinned = !n.pinned; LN.save(); L.render(); }
    else if (act === 'rename') { const t = await LN.prompt('Rename note', n.title, 'Untitled note'); if (t !== null) { n.title = t; LN.touch(n); L.render(); } }
    else if (act === 'duplicate') {
      const copy = JSON.parse(JSON.stringify(n));
      copy.id = LN.uid(); copy.title = (n.title || 'Untitled note') + ' (copy)'; copy.recordings = []; copy.pinned = false;
      copy.pages.forEach((p) => { p.id = LN.uid(); p.strokes.forEach((s) => delete s.rec); });
      copy.created = copy.updated = Date.now();
      LN.state.notes.push(copy); LN.touch(copy); L.render();
    } else if (act === 'move') L.moveDialog('note', id);
    else if (act === 'trash') { LN.app.trashNote(n); L.render(); }
  };

  /* ---------- events ---------- */
  L.init = () => {
    L.migrate();
    const lib = $('#lib');
    const onPickNew = async (b) => {
      const what = b.dataset.pickNew, parent = b.dataset.parent || null;
      if (what === 'note') LN.app.newNote(parent);
      else await L.create(what, parent);
    };
    lib.addEventListener('click', (e) => {
      const t = e.target;
      const nb = t.closest('[data-pick-new]'); if (nb) { onPickNew(nb); return; }
      const cm = t.closest('[data-cardmenu]'); if (cm) { LN.popover(cm, cardMenu(LN.getNote(cm.dataset.cardmenu)), (b) => cardAction(b.dataset.pick, cm.dataset.cardmenu)); return; }
      const tm = t.closest('[data-tmenu]'); if (tm) { LN.popover(tm, containerMenu(L.get(tm.dataset.tmenu)), (b) => L.containerAction(b.dataset.pick, tm.dataset.tmenu)); return; }
      const on = t.closest('[data-opennote]'); if (on) { LN.app.openNote(on.dataset.opennote); return; }
      const tab = t.closest('[data-tab]'); if (tab) { LN.state.ui.sectionTab = tab.dataset.tab || null; LN.save(); L.render(); return; }
      const tr = t.closest('[data-trash]'); if (tr) { LN.app.trashAction(tr.dataset.trash, tr.dataset.id).then(() => L.render()); return; }
      const op = t.closest('[data-open]'); if (op) { L.open(op.dataset.open); }
    });
    lib.addEventListener('dblclick', (e) => { const c = e.target.closest('.card[data-note]'); if (c) LN.app.openNote(c.dataset.note); });
    $('#crumbs').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) L.open(b.dataset.open); });
    $('#lib-new').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      LN.popover(btn, L.newMenu(btn.dataset.parent || null), (b) => {
        const act = b.dataset.pick, parent = btn.dataset.parent || null;
        if (act === 'note') LN.app.newNote(parent); else L.create(act.slice(4), parent);
      }, { cls: 'wide-menu', alignRight: true });
    });
    $('#lib-sort').addEventListener('change', (e) => { L.sort = e.target.value; L.render(); });

    // sidebar tree
    const tree = $('#tree');
    tree.addEventListener('click', (e) => {
      const tw = e.target.closest('[data-tw]');
      if (tw) { const c = L.get(tw.dataset.tw); if (c && L.children(c.id).length) { c.collapsed = !c.collapsed; LN.save(); L.renderTree(); } return; }
      const tm = e.target.closest('[data-tmenu]'); if (tm) { LN.popover(tm, containerMenu(L.get(tm.dataset.tmenu)), (b) => L.containerAction(b.dataset.pick, tm.dataset.tmenu)); return; }
      const op = e.target.closest('[data-open]'); if (op) L.open(op.dataset.open);
    });
    $('#lib-add').addEventListener('click', (e) => {
      const btn = e.currentTarget, parent = L.currentContainer();
      LN.popover(btn, L.newMenu(parent ? parent.id : null), (b) => {
        const act = b.dataset.pick;
        if (act === 'note') LN.app.newNote(parent ? parent.id : null); else L.create(act.slice(4), parent ? parent.id : null);
      }, { cls: 'wide-menu' });
    });
    $('#nav-all').addEventListener('click', () => L.open(null));
    $('#nav-trash').addEventListener('click', () => L.open(TRASH));

    /* drag & drop: notes and containers onto containers */
    let drag = null;
    document.addEventListener('dragstart', (e) => {
      const card = e.target.closest && e.target.closest('.card[data-note]');
      const cont = e.target.closest && e.target.closest('[data-cid][draggable]');
      if (card) drag = { kind: 'note', id: card.dataset.note };
      else if (cont) drag = { kind: 'container', id: cont.dataset.cid };
      else return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.id);
      document.body.classList.add('dragging');
    });
    document.addEventListener('dragend', () => { drag = null; document.body.classList.remove('dragging'); $$('.drop-ok').forEach((x) => x.classList.remove('drop-ok')); });
    const targetOf = (e) => {
      if (!drag) return null;
      const t = e.target.closest && e.target.closest('[data-cid], #nav-all');
      if (!t) return null;
      const destId = t.id === 'nav-all' ? null : t.dataset.cid;
      if (drag.kind === 'container') {
        if (destId === drag.id) return null;
        const c = L.get(drag.id), dest = destId ? L.get(destId) : null;
        if (!L.canContain(dest, c.type) || (destId && L.descendants(drag.id).some((d) => d.id === destId))) return null;
      }
      return { el: t, destId };
    };
    document.addEventListener('dragover', (e) => {
      const t = targetOf(e);
      $$('.drop-ok').forEach((x) => { if (!t || x !== t.el) x.classList.remove('drop-ok'); });
      if (t) { e.preventDefault(); t.el.classList.add('drop-ok'); }
    });
    document.addEventListener('drop', (e) => {
      const t = targetOf(e); if (!t) return;
      e.preventDefault();
      L.moveTo(drag.kind, drag.id, t.destId);
    });
  };
})();

/* LataNote collaboration: live shared notes and device-to-device sync over peer-to-peer WebRTC (PeerJS).
   Data travels directly between browsers. PeerJS's free public broker only introduces the two devices. */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$;
  const C = (LN.collab = { peer: null, conns: [], noteId: null, role: null, applying: false });

  let peerLib = null;
  const loadPeer = () => {
    if (!peerLib) {
      peerLib = new Promise((res, rej) => {
        if (window.Peer) return res(window.Peer);
        const s = document.createElement('script');
        s.src = 'js/vendor/peerjs/peerjs.min.js';
        s.onload = () => res(window.Peer);
        s.onerror = () => { peerLib = null; rej(new Error('PeerJS failed to load')); };
        document.head.appendChild(s);
      });
    }
    return peerLib;
  };
  const peerOpts = () => Object.assign({ debug: 0 }, window.LN_PEER_OPTS || {});
  const randId = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  const makePeer = async (id) => {
    const Peer = await loadPeer();
    return new Promise((res, rej) => {
      const p = id ? new Peer(id, peerOpts()) : new Peer(peerOpts());
      const t = setTimeout(() => rej(new Error('timeout')), 15000);
      p.on('open', () => { clearTimeout(t); res(p); });
      p.on('error', (e) => { clearTimeout(t); rej(e); });
    });
  };

  /* ---------- packing notes for the wire ---------- */
  const shapeOf = (note) => note.pages.map((p) => p.id).join(',');
  const pack = (note, withBg) => ({
    id: note.id, title: note.title, paper: note.paper, spacing: note.spacing, color: note.color, created: note.created, updated: note.updated, cards: note.cards || [],
    papers: withBg ? LN.papersUsedBy([note]) : [],
    pages: note.pages.map((p) => ({ id: p.id, html: p.html, strokes: p.strokes, ocr: p.ocr || '', bg: withBg ? p.bg : null, bgH: p.bgH, hasBg: !!p.bg, paper: p.paper, spacing: p.spacing, color: p.color })),
  });

  /* ======================= LIVE NOTE ======================= */
  const setChip = () => {
    const chip = $('#live-chip');
    const active = !!C.peer && C.role !== 'sync';
    chip.hidden = !active;
    if (active) $('#live-count').textContent = C.role === 'host' ? `Live · ${C.conns.length + 1}` : C.conns.length ? 'Live' : 'Connecting…';
  };

  const send = (msg, except) => C.conns.forEach((c) => { if (c !== except && c.open) { try { c.send(msg); } catch (e) { /* noop */ } } });

  let lastShape = '';
  const pushChanges = LN.debounce(() => {
    const note = LN.getNote(C.noteId); if (!note || !C.conns.length) return;
    const shape = shapeOf(note);
    send({ t: 'note', note: pack(note, shape !== lastShape) });
    lastShape = shape;
  }, 250);

  // called for every local change
  const origTouch = LN.touch;
  LN.touch = (note) => {
    origTouch(note);
    if (C.peer && C.role !== 'sync' && note && note.id === C.noteId && !C.applying) pushChanges();
  };

  const applyIncoming = (remote, from) => {
    let note = LN.getNote(remote.id);
    LN.mergePapers(remote.papers);
    C.applying = true;
    try {
      if (!note) {
        note = Object.assign(LN.newNote(sharedNotebook().id, remote.title), { id: remote.id, paper: remote.paper, spacing: remote.spacing, color: remote.color, cards: remote.cards || [] });
        note.pages = remote.pages.map((p) => Object.assign(LN.newPage(), p));
        LN.state.notes.push(note);
        LN.touch(note);
        LN.app.openNote(note.id);
      } else {
        // keep page backgrounds we already have when the update omitted them
        remote.pages.forEach((rp) => { if (rp.hasBg && !rp.bg) { const local = note.pages.find((p) => p.id === rp.id); if (local) rp.bg = local.bg; } });
        if (LN.editor.note && LN.editor.note.id === note.id) LN.editor.applyRemote(remote);
        else { note.title = remote.title; note.paper = remote.paper; note.spacing = remote.spacing; note.color = remote.color; note.pages = remote.pages.map((p) => Object.assign(LN.newPage(), p)); }
        LN.touch(note);
      }
      lastShape = shapeOf(note);
    } finally { C.applying = false; }
    if (C.role === 'host') send({ t: 'note', note: remote }, from); // relay to the other guests
  };

  const sharedNotebook = () => {
    let nb = LN.state.notebooks.find((n) => n.shared);
    if (!nb) { nb = { id: LN.uid(), type: 'folder', parentId: null, order: Date.now(), name: 'Shared with me', color: '#0ea5e9', created: Date.now(), shared: true }; LN.state.notebooks.push(nb); LN.save(); }
    return nb;
  };

  const wire = (conn) => {
    conn.on('open', () => {
      C.conns.push(conn); setChip(); renderLivePanel();
      if (C.role === 'host') {
        const note = LN.getNote(C.noteId);
        if (note) conn.send({ t: 'note', note: pack(note, true) });
        LN.toast('Someone joined your live note.');
      }
    });
    conn.on('data', (msg) => { if (msg && msg.t === 'note' && msg.note) applyIncoming(msg.note, conn); });
    conn.on('close', () => {
      C.conns = C.conns.filter((c) => c !== conn); setChip(); renderLivePanel();
      if (C.role === 'guest') { LN.toast('The live session ended. Your copy of the note is saved.'); C.stop(true); }
    });
    conn.on('error', () => {});
  };

  const linkFor = (id) => `${location.origin}${location.pathname}#live=${id}`;

  function renderLivePanel() {
    const dlg = $('#panel');
    if (!dlg.open || !$('#live-panel')) return;
    const note = LN.getNote(C.noteId);
    $('#live-status').innerHTML = C.role === 'host'
      ? `${C.conns.length ? `<b>${C.conns.length}</b> ${C.conns.length === 1 ? 'person is' : 'people are'} editing with you.` : 'Waiting for people to join…'}`
      : C.conns.length ? `Connected. You’re editing “${LN.esc(note ? note.title || 'Untitled note' : '')}” live.` : 'Connecting…';
  }

  C.openLivePanel = () => {
    const note = LN.editor.note;
    if (C.peer && C.role !== 'sync') {
      LN.panel(`<div id="live-panel">
        <h3>${LN.icon('users')} Live collaboration</h3>
        <p id="live-status" class="muted"></p>
        ${C.role === 'host' ? `<label class="field-label">Invite link</label><div class="copy-row"><input id="live-link" readonly value="${LN.esc(linkFor(C.peer.id))}"><button class="btn btn-primary btn-sm" data-live="copy">${LN.icon('copy')} Copy</button></div>
        <p class="muted small">Anyone with this link can edit this note while the session is open. Edits sync instantly, including ink.</p>` : ''}
        <div class="dlg-actions"><button class="btn btn-danger" data-live="stop">${C.role === 'host' ? 'End session' : 'Leave session'}</button><button class="btn btn-ghost" data-close>Close</button></div></div>`);
      renderLivePanel();
    } else {
      if (!note) return;
      LN.panel(`<div id="live-panel">
        <h3>${LN.icon('users')} Collaborate live</h3>
        <p>Share a link and edit “${LN.esc(note.title || 'Untitled note')}” together in real time: typing, handwriting and drawings. Free, with no account.</p>
        <ul class="muted small"><li>Changes go directly between your browsers, peer to peer.</li><li>Keep this tab open while others are editing.</li><li>Everyone keeps their own copy afterwards.</li></ul>
        <div class="dlg-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-live="start">${LN.icon('send')} Start live session</button></div></div>`);
    }
    $('#panel-body').onclick = async (e) => {
      const b = e.target.closest('[data-live]'); if (!b) return;
      if (b.dataset.live === 'start') { b.disabled = true; b.textContent = 'Starting…'; await C.host(); }
      else if (b.dataset.live === 'copy') {
        const v = $('#live-link').value;
        try { await navigator.clipboard.writeText(v); LN.toast('Invite link copied.'); } catch (_) { $('#live-link').select(); }
        if (navigator.share && /Mobi/.test(navigator.userAgent)) navigator.share({ title: 'Edit my LataNote note', url: v }).catch(() => {});
      } else if (b.dataset.live === 'stop') { C.stop(); LN.closePanel(); }
    };
  };

  C.host = async () => {
    const note = LN.editor.note; if (!note) return;
    try {
      C.peer = await makePeer('latanote-' + randId(12));
    } catch (e) {
      LN.toast('Couldn’t start a live session. Check your internet connection.');
      LN.closePanel(); return;
    }
    C.role = 'host'; C.noteId = note.id; C.conns = []; lastShape = shapeOf(note);
    C.peer.on('connection', wire);
    C.peer.on('disconnected', () => { try { C.peer && C.peer.reconnect(); } catch (e) { /* noop */ } });
    setChip();
    C.openLivePanel();
  };

  C.join = async (id) => {
    LN.toast('Joining live note…');
    try { C.peer = await makePeer(); } catch (e) { LN.toast('Couldn’t connect. Check your internet connection.'); return; }
    C.role = 'guest'; C.conns = [];
    setChip();
    const conn = C.peer.connect(id, { reliable: true });
    wire(conn);
    conn.on('data', (msg) => { if (msg && msg.note && !C.noteId) C.noteId = msg.note.id; });
    setTimeout(() => { if (C.role === 'guest' && !C.conns.length) { LN.toast('Couldn’t reach that live note. The session may have ended.'); C.stop(true); } }, 15000);
  };

  C.stop = (quiet) => {
    try { C.conns.forEach((c) => c.close()); } catch (e) { /* noop */ }
    try { C.peer && C.peer.destroy(); } catch (e) { /* noop */ }
    C.peer = null; C.conns = []; C.role = null; C.noteId = null;
    setChip();
    if (!quiet) LN.toast('Live session ended.');
  };

  /* ======================= DEVICE SYNC ======================= */
  const packState = () => ({
    customPapers: LN.state.customPapers || [], pageTemplates: LN.state.pageTemplates || [],
    notebooks: LN.state.notebooks, events: LN.state.events, trash: (LN.state.trash || []).map((n) => ({ id: n.id, deletedAt: n.deletedAt, updated: n.updated })),
    notes: LN.state.notes.map((n) => Object.assign(pack(n, true), { notebookId: n.notebookId, pinned: !!n.pinned, recordings: [] })),
  });

  C.merge = (remote) => {
    const S = LN.state;
    let added = 0, updated = 0;
    // notebooks: union by id
    remote.notebooks.forEach((nb) => { if (!LN.getNotebook(nb.id)) S.notebooks.push(nb); });
    // notes trashed on either side stay in the trash if deleted after their last edit
    const trashed = new Map();
    (S.trash || []).forEach((n) => trashed.set(n.id, n.deletedAt));
    (remote.trash || []).forEach((n) => trashed.set(n.id, Math.max(trashed.get(n.id) || 0, n.deletedAt)));
    remote.notes.forEach((rn) => {
      const del = trashed.get(rn.id);
      if (del && del >= rn.updated) return;
      const local = LN.getNote(rn.id);
      const full = Object.assign(LN.newNote(rn.notebookId, rn.title), rn, { pages: rn.pages.map((p) => { const q = Object.assign(LN.newPage(), p); delete q.hasBg; return q; }) });
      if (!local) {
        full.recordings = [];
        S.notes.push(full); added++;
        if (S.trash) S.trash = S.trash.filter((t) => t.id !== rn.id);
      } else if (rn.updated > local.updated) {
        full.recordings = local.recordings; // recordings stay on the device that made them
        Object.assign(local, full); updated++;
      }
    });
    S.notes = S.notes.filter((n) => { const del = trashed.get(n.id); if (del && del >= n.updated && !(S.trash || []).some((t) => t.id === n.id)) { (S.trash = S.trash || []).push(Object.assign(n, { deletedAt: del })); return false; } return true; });
    LN.mergePapers(remote.customPapers);
    S.pageTemplates = S.pageTemplates || [];
    (remote.pageTemplates || []).forEach((t) => { if (!S.pageTemplates.some((x) => x.id === t.id)) S.pageTemplates.push(t); });
    // planner: union by id
    remote.events.forEach((ev) => { if (!S.events.some((e) => e.id === ev.id)) S.events.push(ev); });
    S.notes.forEach((n) => { if (n.notebookId && !LN.getNotebook(n.notebookId)) n.notebookId = null; });
    if (LN.lib) LN.lib.migrate();
    LN.save();
    LN.app.renderLibrary();
    const cur = LN.editor.note && LN.getNote(LN.editor.note.id);
    LN.editor.open(cur ? cur.id : LN.app.firstNoteId());
    return { added, updated };
  };

  const syncOver = (conn) => {
    let done = false;
    conn.on('open', () => conn.send({ t: 'state', state: packState() }));
    conn.on('data', (msg) => {
      if (!msg || msg.t !== 'state' || done) return;
      done = true;
      const r = C.merge(msg.state);
      $('#sync-status') && ($('#sync-status').innerHTML = `✅ Synced. ${r.added} new and ${r.updated} updated note${r.added + r.updated === 1 ? '' : 's'} received. The other device received yours too.`);
      LN.toast('Devices synced.');
      setTimeout(() => { try { conn.close(); } catch (e) { /* noop */ } C.stop(true); }, 1500);
    });
    conn.on('error', () => { $('#sync-status') && ($('#sync-status').textContent = 'Connection failed. Try again.'); });
  };

  C.syncDevices = () => {
    const body = LN.panel(`
      <h3>${LN.icon('devices')} Sync with another device</h3>
      <p>Open LataNote on your other device too. Your notes are merged in both directions, directly between the two devices. Newer edits win, and nothing is uploaded to a cloud.</p>
      <div class="sync-grid">
        <div><b>On this device</b><p class="muted small">Show a code, then type it on the other device.</p><button class="btn btn-primary" data-sync="show">Show sync code</button></div>
        <div><b>Have a code?</b><p class="muted small">Enter the code shown on your other device.</p><form class="copy-row" data-sync-form><input name="code" inputmode="numeric" autocomplete="off" placeholder="6-digit code" maxlength="6"><button class="btn btn-primary btn-sm">Sync</button></form></div>
      </div>
      <p id="sync-status" class="sync-status"></p>
      <p class="muted small">Audio recordings stay on the device that recorded them.</p>`, 'wide');
    body.onclick = async (e) => {
      const b = e.target.closest('[data-sync="show"]'); if (!b) return;
      b.disabled = true;
      if (C.peer) C.stop(true);
      const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
      try { C.peer = await makePeer('latanote-sync-' + code); } catch (err) { $('#sync-status').textContent = 'Couldn’t create a code. Check your internet connection.'; b.disabled = false; return; }
      C.role = 'sync';
      $('#sync-status').innerHTML = `Your code: <span class="sync-code">${code.slice(0, 3)} ${code.slice(3)}</span><br><span class="muted small">Waiting for the other device…</span>`;
      C.peer.on('connection', (conn) => { $('#sync-status').textContent = 'Connected. Syncing…'; syncOver(conn); });
    };
    body.onsubmit = async (e) => {
      e.preventDefault();
      const code = e.target.elements.code.value.replace(/\D/g, '');
      if (code.length !== 6) { $('#sync-status').textContent = 'Enter the 6-digit code.'; return; }
      $('#sync-status').textContent = 'Connecting…';
      if (C.peer) C.stop(true);
      try { C.peer = await makePeer(); } catch (err) { $('#sync-status').textContent = 'Couldn’t connect. Check your internet connection.'; return; }
      C.role = 'sync';
      const conn = C.peer.connect('latanote-sync-' + code, { reliable: true });
      syncOver(conn);
      C.peer.on('error', () => { $('#sync-status').textContent = 'That code didn’t work. Check it and try again.'; });
    };
  };

  /* join from an invite link */
  C.checkInvite = () => {
    const m = location.hash.match(/live=([a-z0-9-]+)/i);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    C.join(m[1]);
  };
  window.addEventListener('hashchange', () => C.checkInvite());
  window.addEventListener('beforeunload', (e) => { if (C.role === 'host' && C.conns.length) { e.preventDefault(); e.returnValue = ''; } });
})();

/* LataNote audio: record lessons, sync ink to the recording timeline, playback */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$;

  const A = (LN.audio = {
    rec: null,        // active recording {id, noteId, start, mr, chunks, stream, timer}
    playback: null,   // {id, t} while a recording is loaded in the player
    playingId: null,
  });

  A.supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  A.stamp = () => (A.rec && LN.editor.note && A.rec.noteId === LN.editor.note.id ? { id: A.rec.id, t: Date.now() - A.rec.start } : null);

  A.toggle = () => (A.rec ? A.stop() : A.start());

  A.start = async () => {
    const note = LN.editor.note;
    if (!note) return;
    if (!A.supported()) { LN.toast('Audio recording is not supported in this browser.'); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { LN.toast('Microphone access was blocked.'); return; }
    A.stopPlayback();
    const mr = new MediaRecorder(stream);
    const rec = { id: LN.uid(), noteId: note.id, start: Date.now(), mr, chunks: [], stream };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) rec.chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const mime = mr.mimeType || 'audio/webm';
      const blob = new Blob(rec.chunks, { type: mime });
      const target = LN.getNote(rec.noteId);
      if (!target || !blob.size) return;
      try { await LN.db.set(rec.id, blob, 'blobs'); }
      catch (e) { LN.toast('Could not save the recording.'); return; }
      target.recordings.push({ id: rec.id, name: `Recording ${target.recordings.length + 1}`, duration: Date.now() - rec.start, created: rec.start, mime });
      LN.touch(target);
      if (LN.editor.note && LN.editor.note.id === target.id) A.renderList();
      LN.toast('Recording saved to this note.');
    };
    mr.start(1000);
    A.rec = rec;
    rec.timer = setInterval(() => { $('#rec-time').textContent = LN.fmtDur(Date.now() - rec.start); }, 500);
    $('#rec-time').textContent = '0:00';
    $('#rec-live').hidden = false;
    $('#rec-btn').classList.add('recording');
    document.body.classList.add('has-recbar');
  };

  A.stop = () => {
    if (!A.rec) return;
    clearInterval(A.rec.timer);
    try { A.rec.mr.stop(); } catch (e) { /* noop */ }
    A.rec = null;
    $('#rec-live').hidden = true;
    $('#rec-btn').classList.remove('recording');
    A.renderList();
  };

  const ext = (mime) => (/mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm');

  A.renderList = () => {
    const note = LN.editor.note;
    const list = $('#rec-list');
    const recs = note ? note.recordings : [];
    list.innerHTML = recs.map((r) => `
      <div class="rec-chip ${A.playingId === r.id ? 'on' : ''}" data-id="${r.id}">
        <button class="icon-btn sm" data-rec="play" title="Play with ink replay">${LN.icon(A.playingId === r.id ? 'pause' : 'play')}</button>
        <span class="rc-name" data-rec="rename" title="Rename">${LN.esc(r.name)}</span>
        <span class="rc-dur">${LN.fmtDur(r.duration)}</span>
        <button class="icon-btn sm" data-rec="download" title="Download">${LN.icon('download')}</button>
        <button class="icon-btn sm" data-rec="delete" title="Delete">${LN.icon('trash')}</button>
      </div>`).join('');
    const show = !!(A.rec || recs.length);
    document.body.classList.toggle('has-recbar', show);
  };

  const player = () => $('#player');

  A.play = async (id) => {
    const p = player();
    if (A.playingId === id) { if (p.paused) p.play(); else p.pause(); return; }
    const blob = await LN.db.get(id, 'blobs').catch(() => null);
    if (!blob) { LN.toast('That recording could not be found on this device.'); return; }
    if (p.src) URL.revokeObjectURL(p.src);
    p.src = URL.createObjectURL(blob);
    p.hidden = false;
    A.playingId = id;
    A.playback = { id, t: 0 };
    LN.editor.redrawInk();
    A.renderList();
    p.play().catch(() => {});
  };

  A.stopPlayback = () => {
    const p = player(); if (!p) return;
    p.pause();
    if (p.src) { URL.revokeObjectURL(p.src); p.removeAttribute('src'); p.load(); }
    p.hidden = true;
    A.playingId = null;
    if (A.playback) { A.playback = null; LN.editor.redrawInk(); }
  };

  const onTime = () => {
    const p = player();
    if (!A.playback) return;
    A.playback.t = p.currentTime * 1000;
    LN.editor.redrawInk();
  };

  A.init = () => {
    const p = player();
    p.addEventListener('timeupdate', onTime);
    p.addEventListener('seeked', onTime);
    p.addEventListener('play', () => A.renderList());
    p.addEventListener('pause', () => A.renderList());
    p.addEventListener('ended', () => { A.stopPlayback(); A.renderList(); });
    $('#rec-btn').addEventListener('click', A.toggle);
    $('#rec-stop').addEventListener('click', A.stop);
    $('#rec-list').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-rec]'); if (!b) return;
      const id = b.closest('.rec-chip').dataset.id;
      const note = LN.editor.note;
      const r = note.recordings.find((x) => x.id === id);
      if (!r) return;
      const act = b.dataset.rec;
      if (act === 'play') {
        if (A.playingId === id && !player().paused) player().pause(); else A.play(id);
      } else if (act === 'download') {
        const blob = await LN.db.get(id, 'blobs').catch(() => null);
        if (blob) LN.download(`${LN.safeName(note.title)} - ${LN.safeName(r.name)}.${ext(r.mime || blob.type)}`, blob);
      } else if (act === 'rename') {
        const name = await LN.prompt('Rename recording', r.name);
        if (name) { r.name = name; LN.touch(note); A.renderList(); }
      } else if (act === 'delete') {
        if (!(await LN.confirm('Delete this recording?', `“${r.name}” will be removed. Ink synced to it stays on the page.`))) return;
        if (A.playingId === id) A.stopPlayback();
        note.recordings = note.recordings.filter((x) => x.id !== id);
        LN.db.del(id, 'blobs');
        LN.touch(note); A.renderList();
      }
    });
    LN.on('note-opened', () => A.renderList());
  };
})();

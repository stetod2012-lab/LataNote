/* LataNote extras: full screen, install, focus timer, dictation, read aloud, Markdown, handwriting → text, settings */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;
  const X = (LN.extras = {});

  /* ---------- generic panel dialog ---------- */
  LN.panel = (html, cls = '') => {
    const dlg = $('#panel');
    dlg.className = 'dlg panel ' + cls;
    $('#panel-body').innerHTML = html;
    LN.hydrateIcons($('#panel-body'));
    if (!dlg.open) dlg.showModal();
    return $('#panel-body');
  };
  LN.closePanel = () => { const d = $('#panel'); if (d.open) d.close(); };

  /* ---------- full screen ---------- */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  X.isFullscreen = () => !!fsEl() || document.body.classList.contains('is-fullscreen');
  X.updateFsButton = () => {
    const on = X.isFullscreen();
    document.body.classList.toggle('is-fullscreen', on);
    const l = $('#fs-label'); if (l) l.textContent = on ? 'Exit full screen' : 'Full screen';
    window.dispatchEvent(new Event('resize'));
  };
  const env = () => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return {
      ios,
      safari: ios || (/safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|android/i.test(ua)),
      installed: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || !!navigator.standalone,
    };
  };
  const enterReal = () => {
    const root = document.documentElement;
    if (root.requestFullscreen) return root.requestFullscreen({ navigationUI: 'hide' });
    if (root.webkitRequestFullscreen) return root.webkitRequestFullscreen(window.Element && Element.ALLOW_KEYBOARD_INPUT);
    return Promise.reject(new Error('unsupported'));
  };
  const exitReal = () => (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
  const editable = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));
  X.fsWanted = false;

  X.toggleFullscreen = async () => {
    if (X.fsWanted || fsEl() || document.body.classList.contains('is-fullscreen')) {
      X.fsWanted = false; X.paused = false;
      document.body.classList.remove('is-fullscreen');
      if (fsEl()) { X.leaving = true; try { await exitReal(); } catch (e) { /* noop */ } }
      X.updateFsButton();
      return;
    }
    const E = env();
    X.fsWanted = true;
    document.body.classList.add('is-fullscreen'); // LataNote's own distraction-free layout
    if (!E.installed) {
      try {
        if (editable(document.activeElement) && E.safari) document.activeElement.blur(); // Safari warns if you type in full screen
        await enterReal();                           // hides the browser's address bar and tabs
      } catch (e) { /* e.g. iPhone: only the app layout */ }
    }
    X.updateFsButton();
    let seen = true; try { seen = !!localStorage.getItem('latanote-fs-tip'); } catch (e) { /* noop */ }
    if (E.ios && !E.installed && !seen) X.fsTip();
    else LN.toast('Full screen. Press F or Esc to exit.');
  };

  // Safari shows a "typing in full screen" warning, so step out of browser full screen while you type
  // and hide the browser's bars again as soon as you go back to drawing.
  document.addEventListener('focusin', (e) => {
    if (!X.fsWanted || !fsEl() || !env().safari || !editable(e.target)) return;
    X.paused = true; X.leaving = true;
    exitReal();
  });
  const resume = (e) => {
    if (!X.fsWanted || !X.paused || fsEl() || editable(e.target) || !LN.editor || LN.editor.mode !== 'draw') return;
    X.paused = false;
    enterReal().catch(() => {});
  };
  document.addEventListener('click', resume, true);
  document.addEventListener('touchend', resume, true);

  X.fsTip = () => {
    try { localStorage.setItem('latanote-fs-tip', '1'); } catch (e) { /* noop */ }
    LN.panel(`
      <h3>${LN.icon('maximize')} Get rid of Safari’s bars for good</h3>
      <p>Safari keeps its address bar and tabs while you type. For a true full-screen LataNote, add it to your Home Screen. It then opens like an app, with no Safari bars, and typing works normally.</p>
      <ol class="steps">
        <li>Tap the <b>Share</b> button ${LN.icon('share')} in Safari’s toolbar.</li>
        <li>Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
        <li>Open <b>LataNote</b> from your Home Screen. Your notes are all there.</li>
      </ol>
      <p class="muted small">Until then, full screen hides Safari’s bars while you draw. When you start typing, the bars come back so Safari doesn’t warn you.</p>
      <div class="dlg-actions"><button class="btn btn-primary" data-close>Got it</button></div>`);
  };

  // leaving browser full screen: if we did it on purpose (typing pause / toggle), keep the app's own full-screen
  // layout; if the person left via Safari's own controls or Esc, turn full screen off completely
  const onFsChange = () => {
    if (!fsEl()) {
      if (X.leaving) X.leaving = false;
      else { X.fsWanted = false; X.paused = false; document.body.classList.remove('is-fullscreen'); }
    }
    X.updateFsButton();
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  /* ---------- install as an app (PWA) ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; const b = $('#install-btn'); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { installEvt = null; const b = $('#install-btn'); if (b) b.hidden = true; LN.toast('LataNote installed. Open it from your home screen or app list.'); });
  X.canInstall = () => !!installEvt;
  X.install = async () => {
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('#install-btn').hidden = true; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    LN.toast(ios ? 'In Safari, tap Share → Add to Home Screen.' : 'Use your browser menu → Install app / Add to Home screen.');
  };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- focus timer (Pomodoro) ---------- */
  const T = { total: 25 * 60, left: 25 * 60, running: false, int: null, label: 'Focus' };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const renderTimer = () => {
    $('#tp-time').textContent = fmt(T.left);
    $('#tp-mode').textContent = T.label + (T.running ? ' · running' : '');
    $('#tp-start').textContent = T.running ? 'Pause' : T.left < T.total ? 'Resume' : 'Start';
    $('#timer-label').textContent = T.running || T.left < T.total ? fmt(T.left) : '';
    $('#timer-btn').classList.toggle('active', T.running);
  };
  const chime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((d, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = [660, 880, 990][i]; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.4);
        o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.45);
      });
    } catch (e) { /* no audio */ }
  };
  const tick = () => {
    T.left--;
    if (T.left <= 0) {
      clearInterval(T.int); T.running = false; T.left = 0; renderTimer(); chime();
      LN.toast(T.label === 'Focus' ? 'Focus session done. Time for a break!' : 'Break over. Back to it!');
      if ('Notification' in window && Notification.permission === 'granted') { try { new Notification('LataNote', { body: `${T.label} timer finished` }); } catch (e) { /* noop */ } }
      T.left = T.total;
    }
    renderTimer();
  };
  X.initTimer = () => {
    const pop = $('#timer-pop');
    $('#timer-btn').addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; renderTimer(); });
    document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('#timer-pop, #timer-btn')) pop.hidden = true; });
    pop.addEventListener('click', (e) => {
      const m = e.target.closest('[data-min]');
      if (m) { clearInterval(T.int); T.running = false; T.total = T.left = +m.dataset.min * 60; T.label = +m.dataset.min <= 15 ? 'Break' : 'Focus'; renderTimer(); }
    });
    $('#tp-start').addEventListener('click', () => {
      if (T.running) { clearInterval(T.int); T.running = false; }
      else {
        T.running = true; T.int = setInterval(tick, 1000);
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      }
      renderTimer();
    });
    $('#tp-reset').addEventListener('click', () => { clearInterval(T.int); T.running = false; T.left = T.total; renderTimer(); });
    renderTimer();
  };

  /* ---------- dictation (speech to text) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  X.dictate = () => {
    if (!SR) { LN.toast('Dictation isn’t supported in this browser. Try Chrome, Edge or Safari.'); return; }
    if (rec) { rec.stop(); return; }
    const E = LN.editor; if (!E.note) return;
    if (E.mode !== 'type') E.setMode('type');
    if (!E.restoreRange()) E.focusEnd();
    rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || 'en-US';
    rec.onresult = (ev) => {
      let text = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) text += ev.results[i][0].transcript;
      text = text.trim(); if (!text) return;
      if (!E.restoreRange()) E.focusEnd();
      const before = getSelection().anchorNode ? getSelection().anchorNode.textContent.slice(0, getSelection().anchorOffset) : '';
      const sep = before && !/\s$/.test(before) ? ' ' : '';
      document.execCommand('insertText', false, sep + text.charAt(0).toUpperCase() + text.slice(1));
      E.syncText();
    };
    rec.onerror = (ev) => { if (ev.error === 'not-allowed') LN.toast('Microphone access was blocked.'); };
    rec.onend = () => { rec = null; $('#dictate-btn').classList.remove('active', 'live'); };
    rec.start();
    $('#dictate-btn').classList.add('active', 'live');
    LN.toast('Listening… speak and your words will be typed. Click the mic again to stop.');
  };

  /* ---------- read aloud ---------- */
  X.speak = () => {
    if (!('speechSynthesis' in window)) { LN.toast('Read aloud isn’t supported in this browser.'); return; }
    const synth = window.speechSynthesis;
    if (synth.speaking) { synth.cancel(); return; }
    const note = LN.editor.note; if (!note) return;
    const text = [note.title, LN.noteText(note)].filter(Boolean).join('.\n');
    if (!text.trim()) { LN.toast('There’s no text to read yet.'); return; }
    // speak in sentence-sized chunks (long utterances get cut off in some browsers)
    const parts = text.match(/[^.!?\n]+[.!?]?/g) || [text];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      u.rate = 1;
      if (i === parts.length - 1) u.onend = () => X.updateSpeakLabel();
      synth.speak(u);
    });
    X.updateSpeakLabel(true);
  };
  X.updateSpeakLabel = (on) => { const l = $('#speak-label'); if (l) l.textContent = on || (window.speechSynthesis && speechSynthesis.speaking) ? 'Stop reading' : 'Read aloud'; };

  /* ---------- Markdown export ---------- */
  X.toMarkdown = (html) => {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const inline = (node) => Array.from(node.childNodes).map((n) => {
      if (n.nodeType === 3) return n.textContent.replace(/ /g, ' ');
      if (n.nodeType !== 1) return '';
      const t = n.tagName.toLowerCase(), c = inline(n);
      if (t === 'b' || t === 'strong') return c.trim() ? `**${c}**` : c;
      if (t === 'i' || t === 'em') return c.trim() ? `*${c}*` : c;
      if (t === 's' || t === 'strike' || t === 'del') return c.trim() ? `~~${c}~~` : c;
      if (t === 'a') return `[${c}](${n.getAttribute('href') || ''})`;
      if (t === 'br') return '\n';
      if (t === 'img') return /^data:/.test(n.src) ? '![image]' : `![image](${n.getAttribute('src')})`;
      if (t === 'code') return '`' + c + '`';
      return c;
    }).join('');
    const block = (node, depth = 0) => Array.from(node.childNodes).map((n) => {
      if (n.nodeType === 3) return n.textContent.trim() ? n.textContent.trim() + '\n\n' : '';
      if (n.nodeType !== 1) return '';
      const t = n.tagName.toLowerCase();
      if (/^h[1-6]$/.test(t)) return '#'.repeat(+t[1]) + ' ' + inline(n).trim() + '\n\n';
      if (t === 'p' || t === 'div') { const c = inline(n).trim(); return c ? c + '\n\n' : ''; }
      if (t === 'blockquote') return inline(n).trim().split('\n').map((l) => '> ' + l).join('\n') + '\n\n';
      if (t === 'pre') return '```\n' + n.textContent + '\n```\n\n';
      if (t === 'ul' || t === 'ol') {
        const check = n.classList.contains('checklist');
        return Array.from(n.children).map((li, i) => {
          const sub = Array.from(li.children).filter((c) => /^(ul|ol)$/i.test(c.tagName));
          const clone = li.cloneNode(true); clone.querySelectorAll('ul,ol').forEach((x) => x.remove());
          const mark = check ? `- [${li.classList.contains('done') ? 'x' : ' '}] ` : t === 'ol' ? `${i + 1}. ` : '- ';
          return '  '.repeat(depth) + mark + inline(clone).trim() + '\n' + sub.map((s) => block({ childNodes: [s] }, depth + 1)).join('');
        }).join('') + (depth ? '' : '\n');
      }
      if (t === 'table') {
        const rows = Array.from(n.querySelectorAll('tr')).map((tr) => '| ' + Array.from(tr.children).map((td) => inline(td).trim().replace(/\|/g, '\\|')).join(' | ') + ' |');
        if (rows.length) rows.splice(1, 0, '| ' + rows[0].split(' | ').map(() => '---').join(' | ') + ' |');
        return rows.join('\n') + '\n\n';
      }
      if (t === 'img') return inline({ childNodes: [n] }) + '\n\n';
      return block(n, depth);
    }).join('');
    return block(doc.body.firstChild).replace(/\n{3,}/g, '\n\n').trim();
  };
  X.exportMarkdown = () => {
    const note = LN.editor.note; if (!note) return;
    const body = note.pages.map((p) => [X.toMarkdown(p.html), p.ocr ? `> Handwriting: ${p.ocr.replace(/\n/g, ' ')}` : ''].filter(Boolean).join('\n\n')).filter(Boolean).join('\n\n---\n\n');
    LN.download(`${LN.safeName(note.title)}.md`, `# ${note.title || 'Untitled note'}\n\n${body}\n`, 'text/markdown');
  };

  /* ---------- handwriting → text ---------- */
  const abs = (p) => new URL(p, location.href).href;
  let tessWorker = null;
  const getTesseract = async () => {
    if (tessWorker) return tessWorker;
    if (!window.Tesseract) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'js/vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('load failed')); document.head.appendChild(s); });
    }
    tessWorker = await window.Tesseract.createWorker('eng', 1, {
      workerPath: abs('js/vendor/tesseract/worker.min.js'),
      corePath: abs('js/vendor/tesseract/core'),
      langPath: abs('js/vendor/tesseract/lang'),
      errorHandler: (e) => console.warn('OCR', e),
      logger: (m) => { if (m.status === 'recognizing text' && m.progress) X.ocrProgress(Math.round(m.progress * 100)); },
    });
    return tessWorker;
  };
  X.ocrProgress = (pct) => { const el = $('#ocr-progress'); if (el) el.textContent = `Reading handwriting… ${pct}%`; };

  // Browser handwriting recognizer (stroke-based, on-device) where available
  const nativeRecognize = async (strokes) => {
    if (!navigator.createHandwritingRecognizer) return null;
    try {
      const r = await navigator.createHandwritingRecognizer({ languages: ['en'] });
      const drawing = r.startDrawing({ recognitionType: 'text' });
      let t = 0;
      strokes.forEach((s) => {
        const hs = new window.HandwritingStroke();
        (s.pts || []).forEach((p) => hs.addPoint({ x: p[0], y: p[1], t: (t += 8) }));
        drawing.addStroke(hs);
      });
      const preds = await drawing.getPrediction();
      r.finish();
      return preds && preds[0] ? preds[0].text : null;
    } catch (e) { return null; }
  };

  const renderForOcr = (strokes) => {
    const ink = strokes.filter((s) => s.tool !== 'highlighter');
    if (!ink.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ink.forEach((s) => (s.pts || [s.a, s.b]).forEach((p) => { x1 = Math.min(x1, p[0]); y1 = Math.min(y1, p[1]); x2 = Math.max(x2, p[0]); y2 = Math.max(y2, p[1]); }));
    const pad = 24, scale = 2;
    const w = x2 - x1 + pad * 2, h = y2 - y1 + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.setTransform(scale, 0, 0, scale, (-x1 + pad) * scale, (-y1 + pad) * scale);
    ink.forEach((s) => LN.drawStroke(g, Object.assign({}, s, { color: '#000', size: Math.max(2, s.size) }), null));
    return c;
  };

  X.recognize = async (strokes) => {
    const pen = strokes.filter((s) => s.pts && s.tool !== 'highlighter');
    const native = await nativeRecognize(pen);
    if (native) return native.trim();
    const canvas = renderForOcr(strokes);
    if (!canvas) return '';
    const w = await getTesseract();
    const { data } = await w.recognize(canvas);
    return (data.text || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };

  // targets: [{rec (editor page record), strokes}]
  X.convertHandwriting = async (targets) => {
    targets = targets.filter((t) => t.strokes.some((s) => s.tool !== 'highlighter'));
    if (!targets.length) { LN.toast('There’s no handwriting to convert. Write something in Draw mode first.'); return; }
    LN.panel(`<h3>${LN.icon('scan')} Handwriting to text</h3><p class="muted" id="ocr-progress">Reading handwriting…</p><div class="spinner"></div>`);
    const results = [];
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 120000));
      for (const t of targets) results.push({ t, text: await Promise.race([X.recognize(t.strokes), timeout]) });
    } catch (e) {
      console.error(e);
      LN.panel(`<h3>Handwriting to text</h3><p>Sorry, recognition failed to start in this browser.</p><div class="dlg-actions"><button class="btn btn-primary" data-close>OK</button></div>`);
      return;
    }
    const text = results.map((r) => r.text).filter(Boolean).join('\n\n');
    const body = LN.panel(`
      <h3>${LN.icon('scan')} Handwriting to text</h3>
      <p class="muted">Check and fix the result. Recognition works best on clear, printed handwriting.</p>
      <textarea id="ocr-text" rows="9" placeholder="No text was recognized.">${LN.esc(text)}</textarea>
      <label class="check"><input type="checkbox" id="ocr-remove"> Remove the handwriting after inserting</label>
      <div class="dlg-actions">
        <button class="btn btn-ghost" data-ocr="copy">${LN.icon('copy')} Copy</button>
        <button class="btn btn-ghost" data-ocr="index" title="Keep the ink, and make it searchable">Make searchable only</button>
        <button class="btn btn-primary" data-ocr="insert">Insert as text</button>
      </div>`);
    body.onclick = async (e) => {
      const b = e.target.closest('[data-ocr]'); if (!b) return;
      const val = $('#ocr-text').value.trim();
      const E = LN.editor;
      if (b.dataset.ocr === 'copy') { try { await navigator.clipboard.writeText(val); LN.toast('Copied.'); } catch (_) { LN.toast('Copy failed.'); } return; }
      // always index so handwriting shows up in search and the study assistant
      results.forEach((r) => { r.t.rec.pg.ocr = [r.t.rec.pg.ocr, r.text].filter(Boolean).join('\n'); });
      if (b.dataset.ocr === 'insert' && val) {
        const pg = results[0].t.rec.pg;
        pg.html += val.split(/\n{2,}/).map((para) => `<p>${LN.esc(para).replace(/\n/g, '<br>')}</p>`).join('');
        if ($('#ocr-remove').checked) {
          results.forEach((r) => {
            const before = r.t.rec.pg.strokes.slice();
            r.t.rec.pg.strokes = r.t.rec.pg.strokes.filter((s) => !r.t.strokes.includes(s));
            E.undo.push({ pg: r.t.rec.pg, strokes: before });
          });
          if (LN.inkSel) LN.inkSel.clearSel();
        }
        const y = $('#pages-area').scrollTop; E.renderPages(); $('#pages-area').scrollTop = y;
        E.updateUndoButtons();
        LN.toast('Inserted as typed text.');
      } else LN.toast('Handwriting is now searchable.');
      LN.touch(E.note);
      LN.closePanel();
    };
  };
  X.ocrNote = () => {
    const E = LN.editor; if (!E.note) return;
    X.convertHandwriting(E.pages.map((rec) => ({ rec, strokes: rec.pg.strokes })));
  };
  X.ocrSelection = () => {
    const ink = LN.inkSel; if (!ink) return;
    const rec = LN.editor.pages.find((r) => r.ink === ink);
    if (rec) X.convertHandwriting([{ rec, strokes: ink.sel.slice() }]);
  };

  /* ---------- keyboard shortcuts ---------- */
  X.shortcuts = () => LN.panel(`
    <h3>${LN.icon('keyboard')} Keyboard shortcuts</h3>
    <table class="kbd-table">
      <tr><td><kbd>T</kbd> / <kbd>D</kbd></td><td>Type mode / Draw mode</td></tr>
      <tr><td><kbd>P</kbd> <kbd>N</kbd> <kbd>H</kbd> <kbd>E</kbd> <kbd>L</kbd></td><td>Pen, pencil, highlighter, eraser, lasso (press P or N again for styles)</td></tr>
      <tr><td><kbd>Del</kbd></td><td>Delete lasso selection</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd></td><td>Undo / redo ink</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd> <kbd>I</kbd> <kbd>U</kbd></td><td>Bold, italic, underline</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>Search all notes</td></tr>
      <tr><td><kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd></td><td>New note</td></tr>
      <tr><td><kbd>Ctrl</kbd>+scroll / pinch</td><td>Zoom pages</td></tr>
      <tr><td><kbd>F</kbd></td><td>Full screen</td></tr>
      <tr><td><kbd>\\</kbd></td><td>Minimize or show the toolbar</td></tr>
      <tr><td><kbd>?</kbd></td><td>Show this list</td></tr>
      <tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>L</kbd> <kbd>Esc</kbd></td><td>Presenting: previous, next, laser, exit</td></tr>
      <tr><td><kbd>Space</kbd>, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Flashcards: flip, grade</td></tr>
    </table>`);

  /* ---------- settings ---------- */
  X.settings = async () => {
    let usage = '';
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        usage = `${(e.usage / 1048576).toFixed(1)} MB used${e.quota ? ` of ${(e.quota / 1073741824).toFixed(1)} GB available` : ''}`;
      }
    } catch (_) { /* noop */ }
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
    const dark = document.documentElement.dataset.theme === 'dark';
    const body = LN.panel(`
      <h3>${LN.icon('settings')} Settings</h3>
      <section class="set">
        <h4>Sync &amp; backup</h4>
        <button class="set-row" data-set="sync">${LN.icon('devices')}<span><b>Sync with another device</b><small>Merge notes between your phone, tablet and computer, directly and for free.</small></span></button>
        <button class="set-row" data-set="backup">${LN.icon('download')}<span><b>Download a backup</b><small>Every notebook, note and planner item in one file.</small></span></button>
        <button class="set-row" data-set="import">${LN.icon('upload')}<span><b>Import a backup, note or notebook</b><small>.json or .latanote files</small></span></button>
      </section>
      <section class="set">
        <h4>App</h4>
        <button class="set-row" data-set="install">${LN.icon('install')}<span><b>Install LataNote</b><small>Put it on your home screen or desktop. Opens full screen and works offline.</small></span></button>
        <button class="set-row" data-set="fullscreen">${LN.icon('maximize')}<span><b>Full screen</b><small>Shortcut: F</small></span></button>
        <button class="set-row" data-set="appearance">${LN.icon('palette')}<span><b>Themes &amp; text size</b><small>12 themes, including animated ones · larger text for easier reading</small></span></button>
        <label class="set-row"><input type="checkbox" data-set="penonly" ${LN.state.settings.penOnly ? 'checked' : ''}><span><b>Stylus only (palm rejection)</b><small>Fingers scroll; only a pen draws.</small></span></label>
        <button class="set-row" data-set="shortcuts">${LN.icon('keyboard')}<span><b>Keyboard shortcuts</b></span></button>
      </section>
      <section class="set">
        <h4>Storage</h4>
        <p class="muted">${usage || 'Notes are stored in this browser.'} ${persisted ? '· Protected from automatic clean-up ✓' : ''}</p>
        ${persisted ? '' : `<button class="set-row" data-set="persist">${LN.icon('lock')}<span><b>Protect my notes from clean-up</b><small>Asks the browser not to clear LataNote’s storage when space runs low.</small></span></button>`}
        <button class="set-row danger" data-set="wipe">${LN.icon('trash')}<span><b>Delete all data on this device</b><small>Notebooks, notes, recordings and planner. This can’t be undone.</small></span></button>
      </section>
      <p class="muted center">LataNote is free. Every feature, for everyone.</p>`, 'wide');
    body.onclick = async (e) => {
      const b = e.target.closest('[data-set]'); if (!b || b.tagName === 'INPUT') return;
      const k = b.dataset.set;
      if (k === 'sync') LN.collab.syncDevices();
      else if (k === 'backup') { LN.app.backup(); }
      else if (k === 'import') { LN.closePanel(); $('#file-import').click(); }
      else if (k === 'install') { LN.closePanel(); X.install(); }
      else if (k === 'fullscreen') { LN.closePanel(); X.toggleFullscreen(); }
      else if (k === 'shortcuts') X.shortcuts();
      else if (k === 'appearance') LN.appearance.open();
      else if (k === 'persist') {
        const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist().catch(() => false) : false;
        LN.toast(ok ? 'Your notes are protected from automatic clean-up.' : 'The browser didn’t allow it. Installing LataNote usually helps.');
        X.settings();
      } else if (k === 'wipe') {
        LN.closePanel();
        if (!(await LN.confirm('Delete everything?', 'All notebooks, notes, recordings and planner items on this device will be erased. Download a backup first if you want to keep them.', 'Delete everything'))) return;
        const ids = LN.state.notes.concat(LN.state.trash || []).flatMap((n) => n.recordings.map((r) => r.id));
        ids.forEach((id) => LN.db.del(id, 'blobs'));
        LN.state = { notebooks: [], notes: [], events: [], trash: [], settings: { penOnly: false }, ui: { samplesRemoved: true } };
        LN.save();
        LN.editor.open(null); LN.app.renderLibrary();
        LN.toast('All data deleted.');
      }
    };
    body.onchange = (e) => {
      const k = e.target.dataset.set;
      if (k === 'dark') LN.app.setTheme(e.target.checked ? 'dark' : 'light');
      if (k === 'penonly') LN.app.setPenOnly(e.target.checked);
    };
  };

  X.init = () => {
    $('#panel-x').addEventListener('click', LN.closePanel);
    $('#panel').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) LN.closePanel();
      if (e.target === $('#panel')) LN.closePanel(); // backdrop click
    });
    $('#panel').addEventListener('close', () => { $('#panel-body').onclick = null; $('#panel-body').onchange = null; if (window.speechSynthesis) X.updateSpeakLabel(); });

    $('#install-btn').addEventListener('click', X.install);
    $('#settings-btn').addEventListener('click', X.settings);
    X.initTimer();
    X.updateFsButton();
  };
})();

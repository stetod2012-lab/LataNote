/* LataNote study assistant: on-device summaries, key terms, flashcards (spaced repetition), quizzes, Q&A */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;

  const STOP = new Set(('a about above after again against all also am an and any are aren as at be because been before being below between both but by can cannot could did do does doing down during each either else even ever every few for from further get gets got had has have having he her here hers herself him himself his how however i if in into is isn it its itself just least less let like made make many may me might more most much must my myself near need neither no nor not now of off often on once one only or other others our ours ourselves out over own per rather same she should since so some such than that the their theirs them themselves then there these they this those though through thus to too toward under until up upon us use used uses using very via was we were what when where whether which while who whom whose why will with within without would yet you your yours yourself also called often usually include includes including known well much each two three first second new way ways').split(' '));
  const INTERVALS = [0, 10 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 16 * 24 * 3600e3];

  const S = (LN.study = { tab: 'summary', open: false, summary: null, quiz: null, session: null, ask: { q: '', scope: 'note', results: null } });

  /* ---------- text analysis ---------- */
  const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(sses)$/, 'ss').replace(/([^s])s$/, '$1').replace(/(ing|ed)$/, '');
  const words = (t) => (t.toLowerCase().match(/[a-z0-9][a-z0-9'\-]*/g) || []).map((w) => w.replace(/'s$/, ''));
  const tokens = (t) => words(t).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

  const sentences = (text, min = 25) => {
    const out = [];
    text.split('\n').forEach((line) => {
      line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).forEach((s) => {
        s = s.trim();
        if (s.length >= min && s.split(/\s+/).length >= 4) out.push(s);
      });
    });
    return out;
  };

  S.keyTerms = (text, n = 10) => {
    const ws = words(text);
    const uni = {}, bi = {};
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      if (w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w)) {
        uni[w] = (uni[w] || 0) + 1;
        const nx = ws[i + 1];
        if (nx && nx.length > 2 && !STOP.has(nx) && !/^\d+$/.test(nx)) { const k = w + ' ' + nx; bi[k] = (bi[k] || 0) + 1; }
      }
    }
    const cand = [];
    Object.entries(bi).forEach(([k, c]) => { if (c >= 2) cand.push([k, c * 1.6]); });
    Object.entries(uni).forEach(([k, c]) => cand.push([k, c + (k.length > 7 ? 0.5 : 0)]));
    cand.sort((a, b) => b[1] - a[1]);
    const picked = [];
    for (const [k] of cand) {
      if (picked.length >= n) break;
      if (picked.some((p) => p.includes(k) || k.includes(p))) continue;
      picked.push(k);
    }
    return picked;
  };

  S.summarize = (text) => {
    const sents = sentences(text);
    if (sents.length <= 2) return sents;
    const freq = {};
    tokens(text).forEach((w) => { const s = stem(w); freq[s] = (freq[s] || 0) + 1; });
    const max = Math.max(1, ...Object.values(freq));
    const scored = sents.map((s, i) => {
      const tk = tokens(s).map(stem);
      const sc = tk.reduce((a, w) => a + (freq[w] || 0) / max, 0) / Math.pow(Math.max(tk.length, 1), 0.55);
      return { s, i, sc: sc + (i === 0 ? 0.25 : 0) + (/[:—]/.test(s) ? 0.1 : 0) };
    });
    const n = Math.min(6, Math.max(2, Math.round(sents.length * 0.3)));
    return scored.sort((a, b) => b.sc - a.sc).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
  };

  S.extractCards = (text) => {
    const out = [], seen = new Set();
    const add = (front, back) => {
      front = front.replace(/^(the|a|an)\s+/i, '').replace(/[\s*•\-–]+$/, '').trim();
      back = back.trim().replace(/^\w/, (c) => c.toUpperCase());
      const key = front.toLowerCase();
      if (!front || front.length < 2 || back.length < 8 || seen.has(key) || front.split(/\s+/).length > 7) return;
      seen.add(key); out.push({ front, back });
    };
    text.split('\n').forEach((line) => {
      const m = line.match(/^\s*(?:[-•*]\s*)?([^:=–—]{2,60}?)\s*(?::|=|\s–\s|\s—\s|\s-\s)\s*(.{8,})$/);
      if (m && !/https?$/i.test(m[1])) { add(m[1], m[2]); return; }
      sentences(line, 15).forEach((s) => {
        const d = s.match(/^(?:The |An? )?([A-Z][\w\s\-'’]{1,48}?)\s+(?:is|are|refers to|means|was|were)\s+(?:the |an? )?(.{10,})$/);
        if (d && !/^(it|this|these|those|they|there|that|he|she|we|you|i|all|some|many|most|each|every|both|such|other|one)\b/i.test(d[1])) add(d[1], d[2]);
      });
    });
    return out;
  };

  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  S.buildQuiz = (note) => {
    const text = LN.noteText(note);
    const cards = note.cards || [];
    const qs = [];
    if (cards.length >= 4) {
      shuffle(cards).slice(0, 6).forEach((c) => {
        const distract = shuffle(cards.filter((x) => x !== c)).slice(0, 3).map((x) => x.front);
        qs.push({ kind: 'Definition', prompt: c.back, options: shuffle([c.front, ...distract]), answer: c.front });
      });
    }
    const terms = S.keyTerms(text, 16).filter((t) => !t.includes(' ') && t.length >= 5);
    if (terms.length >= 4) {
      const sents = shuffle(sentences(text, 30));
      for (const s of sents) {
        if (qs.length >= 8) break;
        const term = terms.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(s));
        if (!term || qs.some((q) => q.prompt.includes(s.slice(0, 20)))) continue;
        const prompt = s.replace(new RegExp(`\\b${term}\\b`, 'ig'), '_____');
        const distract = shuffle(terms.filter((t) => t !== term)).slice(0, 3);
        qs.push({ kind: 'Fill in the blank', prompt, options: shuffle([term, ...distract]), answer: term });
      }
    }
    return shuffle(qs).slice(0, 8);
  };

  S.answer = (q, scope) => {
    const notes = scope === 'all' ? LN.state.notes : [LN.editor.note].filter(Boolean);
    const qt = [...new Set(tokens(q).map(stem))];
    if (!qt.length) return { results: [], def: null };
    const pool = [];
    notes.forEach((n) => sentences(LN.noteText(n), 12).forEach((s) => pool.push({ s, note: n, st: new Set(tokens(s).map(stem)) })));
    const df = {}; qt.forEach((t) => { df[t] = pool.filter((p) => p.st.has(t)).length; });
    pool.forEach((p) => { p.score = qt.reduce((a, t) => a + (p.st.has(t) ? Math.log(1 + pool.length / (df[t] || 1)) : 0), 0); });
    const results = pool.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);
    // definition lookup
    let def = null;
    const m = q.match(/(?:what\s+(?:is|are|was|were)|define|definition of|meaning of|explain)\s+(?:the\s+|an?\s+)?(.+?)\??$/i);
    if (m) {
      const target = m[1].toLowerCase().trim();
      for (const n of notes) {
        const c = (n.cards || []).find((c) => c.front.toLowerCase() === target) || S.extractCards(LN.noteText(n)).find((c) => c.front.toLowerCase() === target || stem(c.front.toLowerCase()) === stem(target));
        if (c) { def = { term: c.front, text: c.back, note: n }; break; }
      }
    }
    return { results, def, qt };
  };

  /* ---------- rendering ---------- */
  const body = () => $('#study-body');
  const noNote = '<div class="st-empty">Open a note to use the study assistant.</div>';
  const highlight = (s, qt) => LN.esc(s).replace(/[A-Za-z][A-Za-z'\-]*/g, (w) => (qt.includes(stem(w.toLowerCase())) ? `<mark>${w}</mark>` : w));

  S.render = () => {
    if (!S.open) return;
    $$('#study .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === S.tab));
    const note = LN.editor.note;
    if (!note) { body().innerHTML = noNote; return; }
    ({ summary: renderSummary, cards: renderCards, quiz: renderQuiz, ask: renderAsk })[S.tab](note);
  };

  function renderSummary(note) {
    const text = LN.noteText(note);
    const wc = (text.match(/\S+/g) || []).length;
    const sm = S.summary && S.summary.noteId === note.id ? S.summary : null;
    body().innerHTML = `
      <div class="st-stats"><div><b>${wc}</b><span>words</span></div><div><b>${Math.max(1, Math.round(wc / 220))} min</b><span>reading</span></div><div><b>${note.pages.length}</b><span>page${note.pages.length > 1 ? 's' : ''}</span></div></div>
      ${wc < 25 ? '<div class="st-empty">Type a few sentences into this note and the assistant can summarize it. Handwriting isn’t analyzed yet.</div>' : `
      <button class="btn btn-primary st-wide" data-act="summarize">${LN.icon('sparkles')} ${sm ? 'Summarize again' : 'Summarize this note'}</button>
      ${sm ? `
        <h4>Summary</h4>
        <ul class="st-summary">${sm.points.map((p) => `<li>${LN.esc(p)}</li>`).join('')}</ul>
        <h4>Key terms</h4>
        <div class="st-terms">${sm.terms.map((t) => `<button class="chip" data-act="ask-term" data-term="${LN.esc(t)}">${LN.esc(t)}</button>`).join('')}</div>
        <div class="st-row">
          <button class="btn btn-soft btn-sm" data-act="insert-summary">${LN.icon('plus')} Add to note</button>
          <button class="btn btn-ghost btn-sm" data-act="copy-summary">${LN.icon('copy')} Copy</button>
        </div>` : '<p class="st-hint">Picks out the most important sentences and key terms from what you’ve typed.</p>'}`}`;
  }

  function dueCards(note) { const now = Date.now(); return (note.cards || []).filter((c) => (c.due || 0) <= now); }

  function renderCards(note) {
    note.cards = note.cards || [];
    const cards = note.cards;
    const ses = S.session && S.session.noteId === note.id ? S.session : null;
    if (ses && ses.queue.length) {
      const c = ses.queue[0];
      body().innerHTML = `
        <div class="st-progress"><span>${ses.done} reviewed · ${ses.queue.length} left</span><button class="link-btn" data-act="end-session">End</button></div>
        <button class="flashcard ${ses.flipped ? 'flipped' : ''}" data-act="flip" aria-label="Flip card">
          <span class="fc-inner">
            <span class="fc-face fc-front"><small>Term</small>${LN.esc(c.front)}<em>Tap to reveal</em></span>
            <span class="fc-face fc-back"><small>${LN.esc(c.front)}</small>${LN.esc(c.back)}</span>
          </span>
        </button>
        <div class="st-row grade ${ses.flipped ? '' : 'invisible'}">
          <button class="btn btn-ghost" data-act="grade" data-g="0">Again</button>
          <button class="btn btn-ghost" data-act="grade" data-g="1">Hard</button>
          <button class="btn btn-primary" data-act="grade" data-g="2">Got it</button>
        </div>
        <p class="st-hint center">Space to flip · 1/2/3 to grade</p>`;
      return;
    }
    const due = dueCards(note).length;
    body().innerHTML = `
      ${ses && !ses.queue.length ? `<div class="st-done">🎉 Session complete: ${ses.done} card${ses.done === 1 ? '' : 's'} reviewed.</div>` : ''}
      <div class="st-row">
        <button class="btn btn-primary" data-act="study-cards" ${cards.length ? '' : 'disabled'}>${LN.icon('cards')} ${due ? `Study ${due} due` : 'Study all'}</button>
        <button class="btn btn-soft" data-act="gen-cards">${LN.icon('sparkles')} Generate from note</button>
      </div>
      <p class="st-hint">Cards are generated from definitions in your notes, such as “Term: definition” or “X is …”. Cards you miss come back sooner.</p>
      <form class="st-add" data-form="add-card">
        <input name="front" placeholder="Term" required aria-label="Card front">
        <input name="back" placeholder="Definition" required aria-label="Card back">
        <button class="btn btn-ghost btn-sm" type="submit">${LN.icon('plus')} Add</button>
      </form>
      <h4>${cards.length} card${cards.length === 1 ? '' : 's'}</h4>
      <ul class="st-cards">${cards.map((c) => `
        <li><div><b>${LN.esc(c.front)}</b><span>${LN.esc(c.back)}</span></div>
        <span class="box" title="Mastery level">${'●'.repeat(c.box || 0)}${'○'.repeat(5 - (c.box || 0))}</span>
        <button class="icon-btn sm" data-act="del-card" data-id="${c.id}" aria-label="Delete card">${LN.icon('trash')}</button></li>`).join('') || '<li class="st-empty">No cards yet.</li>'}
      </ul>`;
  }

  function renderQuiz(note) {
    const qz = S.quiz && S.quiz.noteId === note.id ? S.quiz : null;
    if (!qz) {
      body().innerHTML = `
        <div class="st-quiz-intro">${LN.icon('sparkles')}<h4>Practice quiz</h4><p>Multiple-choice and fill-in-the-blank questions built from this note${(note.cards || []).length >= 4 ? ' and its flashcards' : ''}.</p>
        <button class="btn btn-primary" data-act="start-quiz">Start quiz</button></div>`;
      return;
    }
    if (!qz.qs.length) {
      body().innerHTML = `<div class="st-empty">There isn’t enough material for a quiz yet. Add more typed notes, or generate at least four flashcards.</div><button class="btn btn-ghost st-wide" data-act="reset-quiz">Back</button>`;
      return;
    }
    if (qz.i >= qz.qs.length) {
      const pct = Math.round((qz.score / qz.qs.length) * 100);
      body().innerHTML = `
        <div class="st-result"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
        <h4>${qz.score} of ${qz.qs.length} correct</h4><p>${pct === 100 ? 'Perfect score!' : pct >= 70 ? 'Nice work. Review the ones you missed.' : 'Keep going. Practice makes progress.'}</p></div>
        ${qz.missed.length ? `<h4>Review</h4><ul class="st-summary">${qz.missed.map((q) => `<li>${LN.esc(q.prompt.replace('_____', q.answer))}</li>`).join('')}</ul>` : ''}
        <button class="btn btn-primary st-wide" data-act="start-quiz">Try another quiz</button>`;
      return;
    }
    const q = qz.qs[qz.i];
    body().innerHTML = `
      <div class="st-progress"><span>Question ${qz.i + 1} of ${qz.qs.length}</span><span class="ok">${qz.score} ✓</span></div>
      <div class="bar"><span style="width:${(qz.i / qz.qs.length) * 100}%"></span></div>
      <small class="q-kind">${q.kind}</small>
      <p class="q-prompt">${LN.esc(q.prompt)}</p>
      <div class="q-opts">${q.options.map((o) => {
        let cls = '';
        if (qz.picked != null) cls = o === q.answer ? 'right' : o === qz.picked ? 'wrong' : 'dim';
        return `<button class="q-opt ${cls}" data-act="answer" data-o="${LN.esc(o)}" ${qz.picked != null ? 'disabled' : ''}>${LN.esc(o)}</button>`;
      }).join('')}</div>
      ${qz.picked != null ? `<button class="btn btn-primary st-wide" data-act="next-q">${qz.i + 1 === qz.qs.length ? 'See results' : 'Next question'}</button>` : ''}`;
  }

  function renderAsk(note) {
    const a = S.ask;
    const r = a.results;
    body().innerHTML = `
      <form class="st-ask" data-form="ask">
        <input name="q" value="${LN.esc(a.q)}" placeholder="Ask about your notes…" aria-label="Question" autocomplete="off">
        <button class="btn btn-primary btn-sm" type="submit">Ask</button>
      </form>
      <div class="st-scope">
        <label><input type="radio" name="scope" value="note" ${a.scope === 'note' ? 'checked' : ''}> This note</label>
        <label><input type="radio" name="scope" value="all" ${a.scope === 'all' ? 'checked' : ''}> All notebooks</label>
      </div>
      ${!r ? `<p class="st-hint">Try “What is the Calvin cycle?” or “Where are proteins made?” Answers are drawn from passages in your own notes.</p>
        <div class="st-terms">${S.keyTerms(LN.noteText(note), 6).map((t) => `<button class="chip" data-act="ask-term" data-term="${LN.esc(t)}">${LN.esc(t)}</button>`).join('')}</div>` : ''}
      ${r && r.def ? `<div class="st-def"><small>Definition from “${LN.esc(r.def.note.title || 'Untitled')}”</small><b>${LN.esc(r.def.term)}</b><p>${LN.esc(r.def.text)}</p></div>` : ''}
      ${r ? (r.results.length ? `<h4>From your notes</h4><ul class="st-answers">${r.results.map((x) => `
          <li><p>${highlight(x.s, r.qt)}</p>${a.scope === 'all' ? `<button class="link-btn" data-act="open-note" data-id="${x.note.id}">${LN.icon('note')} ${LN.esc(x.note.title || 'Untitled')}</button>` : ''}</li>`).join('')}</ul>`
        : (r.def ? '' : '<div class="st-empty">I couldn’t find anything about that in your notes. Try different words, or search all notebooks.</div>')) : ''}`;
  }

  /* ---------- actions ---------- */
  const startSession = (note, all) => {
    const now = Date.now();
    let q = (note.cards || []).filter((c) => all || (c.due || 0) <= now);
    q = shuffle(q).sort((a, b) => (a.box || 0) - (b.box || 0));
    S.session = { noteId: note.id, queue: q, done: 0, flipped: false };
  };

  const grade = (g) => {
    const ses = S.session; const note = LN.editor.note;
    if (!ses || !ses.queue.length) return;
    const c = ses.queue.shift();
    if (g === 0) { c.box = 0; c.due = Date.now(); ses.queue.splice(Math.min(3, ses.queue.length), 0, c); }
    else { c.box = Math.min(5, (c.box || 0) + (g === 2 ? 1 : 0)); c.due = Date.now() + INTERVALS[c.box] * (g === 1 ? 0.5 : 1); ses.done++; }
    ses.flipped = false;
    LN.touch(note);
    S.render();
  };

  const act = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const note = LN.editor.note; if (!note) return;
    const a = b.dataset.act;
    if (a === 'summarize') {
      const text = LN.noteText(note);
      S.summary = { noteId: note.id, points: S.summarize(text), terms: S.keyTerms(text, 10) };
    } else if (a === 'insert-summary' && S.summary) {
      const last = note.pages[note.pages.length - 1];
      last.html += `<h2>Summary</h2><ul>${S.summary.points.map((p) => `<li>${LN.esc(p)}</li>`).join('')}</ul><p><b>Key terms:</b> ${S.summary.terms.map(LN.esc).join(', ')}</p>`;
      LN.touch(note);
      LN.editor.renderPages();
      const rec = LN.editor.pages[LN.editor.pages.length - 1];
      requestAnimationFrame(() => rec.text.lastElementChild && rec.text.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      LN.toast('Summary added to the end of your note.');
      return;
    } else if (a === 'copy-summary' && S.summary) {
      const t = S.summary.points.map((p) => '• ' + p).join('\n');
      try { await navigator.clipboard.writeText(t); LN.toast('Summary copied.'); } catch (_) { LN.toast('Copy failed.'); }
      return;
    } else if (a === 'ask-term') {
      S.tab = 'ask'; S.ask.q = 'What is ' + b.dataset.term + '?'; S.ask.results = S.answer(S.ask.q, S.ask.scope);
    } else if (a === 'gen-cards') {
      const found = S.extractCards(LN.noteText(note));
      const have = new Set(note.cards.map((c) => c.front.toLowerCase()));
      const fresh = found.filter((c) => !have.has(c.front.toLowerCase()));
      fresh.forEach((c) => note.cards.push({ id: LN.uid(), front: c.front, back: c.back, box: 0, due: 0 }));
      LN.touch(note);
      LN.toast(fresh.length ? `Added ${fresh.length} new card${fresh.length > 1 ? 's' : ''}.` : found.length ? 'All definitions are already cards.' : 'No definitions found. Try lines like “Term: definition”.');
    } else if (a === 'study-cards') {
      startSession(note, dueCards(note).length === 0);
    } else if (a === 'flip') {
      if (S.session) S.session.flipped = !S.session.flipped;
    } else if (a === 'grade') { grade(+b.dataset.g); return; }
    else if (a === 'end-session') { S.session = null; }
    else if (a === 'del-card') { note.cards = note.cards.filter((c) => c.id !== b.dataset.id); LN.touch(note); }
    else if (a === 'start-quiz') { S.quiz = { noteId: note.id, qs: S.buildQuiz(note), i: 0, score: 0, picked: null, missed: [] }; }
    else if (a === 'reset-quiz') { S.quiz = null; }
    else if (a === 'answer') {
      const qz = S.quiz; const q = qz.qs[qz.i];
      qz.picked = b.dataset.o;
      if (qz.picked === q.answer) qz.score++; else qz.missed.push(q);
    } else if (a === 'next-q') { S.quiz.i++; S.quiz.picked = null; }
    else if (a === 'open-note') { LN.app.openNote(b.dataset.id); return; }
    S.render();
  };

  const submit = (e) => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const note = LN.editor.note; if (!note) return;
    if (f.dataset.form === 'add-card') {
      note.cards.push({ id: LN.uid(), front: f.elements.front.value.trim(), back: f.elements.back.value.trim(), box: 0, due: 0 });
      LN.touch(note); S.render();
      $('#study-body input[name=front]').focus();
    } else if (f.dataset.form === 'ask') {
      S.ask.q = f.elements.q.value.trim();
      S.ask.results = S.ask.q ? S.answer(S.ask.q, S.ask.scope) : null;
      S.render();
      const inp = $('#study-body input[name=q]'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  };

  S.toggle = (force) => {
    S.open = force ?? !S.open;
    $('#study').hidden = !S.open;
    document.body.classList.toggle('study-open', S.open);
    $('#study-btn').classList.toggle('active', S.open);
    S.render();
    setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  };

  S.init = () => {
    $('#study-btn').addEventListener('click', () => S.toggle());
    $('#study-close').addEventListener('click', () => S.toggle(false));
    $('#study .tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) { S.tab = t.dataset.tab; S.render(); } });
    body().addEventListener('click', act);
    body().addEventListener('submit', submit);
    body().addEventListener('change', (e) => {
      if (e.target.name === 'scope') { S.ask.scope = e.target.value; if (S.ask.q) S.ask.results = S.answer(S.ask.q, S.ask.scope); S.render(); }
    });
    document.addEventListener('keydown', (e) => {
      if (!S.open || S.tab !== 'cards' || !S.session || !S.session.queue.length) return;
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === ' ') { e.preventDefault(); S.session.flipped = !S.session.flipped; S.render(); }
      else if (S.session.flipped && ['1', '2', '3'].includes(e.key)) grade(+e.key - 1);
    });
    LN.on('note-opened', () => { S.render(); });
  };
})();

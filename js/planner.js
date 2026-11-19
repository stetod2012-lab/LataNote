/* LataNote planner: month calendar, day agenda, upcoming list */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$;
  const TYPES = { class: { label: 'Class', color: '#6366f1' }, task: { label: 'Task', color: '#10b981' }, exam: { label: 'Exam', color: '#e11d48' }, event: { label: 'Event', color: '#f59e0b' } };

  const Pl = (LN.planner = { month: null, selected: LN.ymd(new Date()) });

  const sortItems = (a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'));
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  Pl.render = () => {
    if (!Pl.month) { const d = new Date(); Pl.month = new Date(d.getFullYear(), d.getMonth(), 1); }
    const m = Pl.month;
    $('#cal-title').textContent = m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const start = new Date(m); start.setDate(1 - m.getDay());
    const today = LN.ymd(new Date());
    const byDate = {};
    LN.state.events.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push(e));
    let html = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = LN.ymd(d);
      const items = (byDate[key] || []).sort(sortItems);
      const cls = ['cal-day', d.getMonth() !== m.getMonth() ? 'out' : '', key === today ? 'today' : '', key === Pl.selected ? 'sel' : ''].join(' ');
      html += `<button class="${cls}" data-date="${key}" aria-label="${d.toDateString()}${items.length ? ', ' + items.length + ' items' : ''}">
        <span class="cd-num">${d.getDate()}</span>
        <span class="cd-items">${items.slice(0, 3).map((e) => `<span class="cd-item ${e.done ? 'done' : ''}" style="--c:${TYPES[e.type].color}">${LN.esc(e.title)}</span>`).join('')}${items.length > 3 ? `<span class="cd-more">+${items.length - 3} more</span>` : ''}</span>
      </button>`;
    }
    $('#cal-grid').innerHTML = html;
    Pl.renderDay();
    Pl.renderUpcoming();
    Pl.renderNoteOptions();
  };

  const itemHTML = (e, showDate) => {
    const note = e.noteId && LN.getNote(e.noteId);
    const t = TYPES[e.type];
    const date = showDate ? LN.parseYmd(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    return `<li class="item ${e.done ? 'done' : ''}" data-id="${e.id}" style="--c:${t.color}">
      ${e.type === 'task' ? `<input type="checkbox" class="it-check" ${e.done ? 'checked' : ''} aria-label="Done">` : '<span class="it-bar"></span>'}
      <div class="it-body">
        <div class="it-title">${LN.esc(e.title)}</div>
        <div class="it-meta"><span class="it-type">${t.label}</span>${date ? ' · ' + date : ''}${e.time ? ' · ' + fmtTime(e.time) : ''}
        ${note ? ` · <a href="#" class="it-note" data-note="${note.id}">${LN.icon('note')} ${LN.esc(note.title || 'Untitled')}</a>` : ''}</div>
      </div>
      <button class="icon-btn sm it-del" title="Delete" aria-label="Delete">${LN.icon('trash')}</button>
    </li>`;
  };

  Pl.renderDay = () => {
    const d = LN.parseYmd(Pl.selected);
    const isToday = Pl.selected === LN.ymd(new Date());
    $('#day-title').textContent = (isToday ? 'Today · ' : '') + d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const items = LN.state.events.filter((e) => e.date === Pl.selected).sort(sortItems);
    $('#day-items').innerHTML = items.length ? items.map((e) => itemHTML(e, false)).join('') : '<li class="items-empty">Nothing planned. Add something above.</li>';
  };

  Pl.renderUpcoming = () => {
    const from = LN.ymd(new Date());
    const end = new Date(); end.setDate(end.getDate() + 14);
    const to = LN.ymd(end);
    const items = LN.state.events.filter((e) => e.date >= from && e.date <= to && !(e.type === 'task' && e.done)).sort(sortItems);
    $('#upcoming').innerHTML = items.length ? items.map((e) => itemHTML(e, true)).join('') : '<li class="items-empty">You’re all clear for the next two weeks.</li>';
  };

  Pl.renderNoteOptions = () => {
    const sel = $('#ef-note');
    const cur = sel.value;
    sel.innerHTML = '<option value="">No linked note</option>' + LN.state.notes
      .slice().sort((a, b) => b.updated - a.updated)
      .map((n) => `<option value="${n.id}">${LN.esc(n.title || 'Untitled note')}</option>`).join('');
    sel.value = cur;
  };

  Pl.init = () => {
    $('#cal-grid').addEventListener('click', (e) => {
      const b = e.target.closest('.cal-day'); if (!b) return;
      Pl.selected = b.dataset.date;
      const d = LN.parseYmd(Pl.selected);
      if (d.getMonth() !== Pl.month.getMonth()) Pl.month = new Date(d.getFullYear(), d.getMonth(), 1);
      Pl.render();
      if (window.innerWidth < 900) $('#event-form').scrollIntoView({ behavior: 'smooth' });
    });
    $('#cal-prev').addEventListener('click', () => { Pl.month = new Date(Pl.month.getFullYear(), Pl.month.getMonth() - 1, 1); Pl.render(); });
    $('#cal-next').addEventListener('click', () => { Pl.month = new Date(Pl.month.getFullYear(), Pl.month.getMonth() + 1, 1); Pl.render(); });
    $('#cal-today').addEventListener('click', () => { const d = new Date(); Pl.month = new Date(d.getFullYear(), d.getMonth(), 1); Pl.selected = LN.ymd(d); Pl.render(); });
    $('#event-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const title = f.elements.title.value.trim(); if (!title) return;
      LN.state.events.push({ id: LN.uid(), date: Pl.selected, time: f.elements.time.value, title, type: f.elements.type.value, noteId: f.elements.noteId.value || null, done: false });
      f.elements.title.value = ''; f.elements.time.value = '';
      LN.save(); Pl.render();
      f.elements.title.focus();
    });
    const onList = (e) => {
      const li = e.target.closest('.item'); if (!li) return;
      const ev = LN.state.events.find((x) => x.id === li.dataset.id); if (!ev) return;
      if (e.target.closest('.it-note')) { e.preventDefault(); LN.app.openNote(e.target.closest('.it-note').dataset.note); return; }
      if (e.target.closest('.it-del')) { LN.state.events = LN.state.events.filter((x) => x !== ev); LN.save(); Pl.render(); return; }
      if (e.target.classList.contains('it-check')) { ev.done = e.target.checked; LN.save(); Pl.render(); }
    };
    $('#day-items').addEventListener('click', onList);
    $('#upcoming').addEventListener('click', onList);
  };
})();

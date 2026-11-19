/* LataNote paper: page backgrounds, line spacing, paper colors, custom papers and page templates */
(function () {
  'use strict';
  const LN = window.LN, $ = LN.$, $$ = LN.$$;

  /* ---------- styles ---------- */
  LN.SPACINGS = {
    narrow: { name: 'Narrow', ls: 24, fs: 15, gs: 16, u: 0.75 },
    normal: { name: 'Normal', ls: 32, fs: 18, gs: 24, u: 1 },
    wide: { name: 'Wide', ls: 40, fs: 21, gs: 32, u: 1.25 },
  };
  LN.PAPER_COLORS = [
    { id: '#ffffff', name: 'White' }, { id: '#fffaf0', name: 'Ivory' }, { id: '#fef9c3', name: 'Yellow' },
    { id: '#ecfeff', name: 'Blue' }, { id: '#f0fdf4', name: 'Green' }, { id: '#fdf2f8', name: 'Pink' },
    { id: '#f5f3ff', name: 'Lavender' }, { id: '#f1f5f9', name: 'Gray' }, { id: '#f5ecd7', name: 'Kraft' },
  ];
  const LINE = '#c9dbf2', MARG = '#f2adad', GRID = '#dfe5ee', DOT = '#b8c1cf';

  const rules = (ls, c = LINE) => ({ img: `linear-gradient(transparent ${ls - 1}px, ${c} ${ls - 1}px, ${c} ${ls}px)`, size: `100% ${ls}px` });
  const vline = (x, c = MARG, w = 2) => ({ img: `linear-gradient(90deg, transparent ${x}px, ${c} ${x}px, ${c} ${x + w}px, transparent ${x + w}px)`, size: '100% 100%' });
  const hgrid = (g, c) => ({ img: `linear-gradient(${c} 1px, transparent 1px)`, size: `${g}px ${g}px` });
  const vgrid = (g, c) => ({ img: `linear-gradient(90deg, ${c} 1px, transparent 1px)`, size: `${g}px ${g}px` });
  const dots = (g, c = DOT, r = 1.3) => ({ img: `radial-gradient(circle, ${c} ${r}px, transparent ${r + 0.3}px)`, size: `${g}px ${g}px`, pos: `${g / 2}px ${g / 2}px` });
  const bands = (period, lines) => ({ // horizontal lines repeating every `period`: lines = [[y, color, width]]
    img: 'linear-gradient(' + ['transparent 0'].concat(lines.flatMap(([y, c, w]) => [`transparent ${y}px`, `${c} ${y}px`, `${c} ${y + w}px`, `transparent ${y + w}px`])).join(', ') + ')',
    size: `100% ${period}px`,
  });

  // each style: layers(spacing) → [{img,size,pos}], text padding, label, group
  LN.PAPERS = {
    blank: { name: 'Blank', layers: () => [] },
    lined: { name: 'Lined', ruled: true, padL: 96, layers: (s) => [vline(79 * s.k), rules(s.ls)] },
    legal: { name: 'Legal pad', ruled: true, padL: 96, color: '#fef9c3', layers: (s) => [vline(74 * s.k, MARG, 1), vline(79 * s.k, MARG, 1), rules(s.ls, '#9ec5ea')] },
    college: { name: 'Lined, no margin', ruled: true, layers: (s) => [rules(s.ls)] },
    cornell: { name: 'Cornell', ruled: true, padL: 236, layers: (s) => [vline(219 * s.k), { img: `linear-gradient(to top, transparent ${220 * s.k}px, ${MARG} ${220 * s.k}px, ${MARG} ${220 * s.k + 2}px, transparent ${220 * s.k + 2}px)`, size: '100% 100%' }, rules(s.ls)] },
    grid: { name: 'Grid', layers: (s) => [hgrid(s.gs, GRID), vgrid(s.gs, GRID)] },
    graph: { name: 'Graph (engineering)', layers: (s) => [hgrid(s.gs * 5, '#b9c6d8'), vgrid(s.gs * 5, '#b9c6d8'), hgrid(s.gs, '#e7ecf3'), vgrid(s.gs, '#e7ecf3')] },
    dot: { name: 'Dotted', layers: (s) => [dots(s.gs, DOT, s.k < 1 ? 0.8 : 1.3)] },
    iso: { name: 'Isometric dots', layers: (s) => { const r = s.gs * 0.866; const d = { img: `radial-gradient(circle, ${DOT} 1.3px, transparent 1.6px)`, size: `${s.gs}px ${2 * r}px` }; return [Object.assign({ pos: '0 0' }, d), Object.assign({ pos: `${s.gs / 2}px ${r}px` }, d)]; } },
    todo: { name: 'Checklist', ruled: true, padL: 96, layers: (s) => {
      const b = Math.max(3, Math.round(s.ls * 0.5)), y = Math.round(s.ls * 0.42);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${b + 2}" height="${s.ls}"><rect x="1" y="${y}" width="${b}" height="${b}" rx="3" fill="none" stroke="#94a3b8" stroke-width="1.5"/></svg>`;
      return [{ img: `url('data:image/svg+xml,${encodeURIComponent(svg)}')`, size: `${b + 2}px ${s.ls}px`, pos: `${76 * s.k - b}px 0`, rep: 'repeat-y' }, rules(s.ls)];
    } },
    primary: { name: 'Handwriting practice', ruled: true, padL: 72, layers: (s) => { const p = s.ls * 2.5; return [bands(p, [[s.ls * 0.5, '#7aa7e0', 1.5], [s.ls * 1.25, '#f0a8b8', 1], [s.ls * 2, '#7aa7e0', 1.5]])]; } },
    music: { name: 'Music staff', layers: (s) => { const g = Math.max(2, 9 * s.u), top = 40 * s.u; return [bands(Math.max(30, Math.round(120 * s.u)), [0, 1, 2, 3, 4].map((i) => [top + i * g, '#94a3b8', 1]))]; } },
    storyboard: { name: 'Storyboard', layers: (s) => [
      { img: 'linear-gradient(#94a3b8 2px, transparent 2px), linear-gradient(90deg, #94a3b8 2px, transparent 2px)', size: `${360 * s.k}px ${300 * s.k}px`, pos: `${36 * s.k}px ${40 * s.k}px` }] },
  };
  LN.PAPER_ORDER = ['lined', 'college', 'legal', 'cornell', 'todo', 'primary', 'grid', 'graph', 'dot', 'iso', 'music', 'storyboard', 'blank'];

  LN.customPaper = (id) => (LN.state.customPapers || []).find((c) => c.id === id);

  /** effective {paper, spacing, color} → { style (inline CSS), minH } */
  // k scales the pattern (used to draw small previews with crisp 1px lines)
  LN.paperStyle = (eff, k = 1) => {
    const base = LN.SPACINGS[eff.spacing] || LN.SPACINGS.normal;
    const s = Object.assign({}, base, { ls: Math.max(4, base.ls * k), gs: Math.max(4, base.gs * k), u: base.u * k, k });
    const color = eff.color || '#ffffff';
    if (eff.paper && eff.paper.startsWith('custom:')) {
      const c = LN.customPaper(eff.paper.slice(7));
      if (c) {
        return {
          style: `--ls:${s.ls}px;--fs:${s.fs}px;--pad-l:56px;--pad-t:40px;background-color:${color};background-image:url(${c.bg});background-size:100% auto;background-repeat:no-repeat;background-position:0 0`,
          minH: Math.max(LN.PAGE_H, Math.round(c.h || 0)),
        };
      }
    }
    const P = LN.PAPERS[eff.paper] || LN.PAPERS.lined;
    const L = P.layers(s);
    const padL = P.padL || 56;
    const padT = P.ruled ? Math.round(s.ls * 1.19) : 40;
    const style = `--ls:${s.ls}px;--fs:${s.fs}px;--pad-l:${padL}px;--pad-t:${padT}px;background-color:${color};` +
      (L.length ? `background-image:${L.map((l) => l.img).join(', ')};background-size:${L.map((l) => l.size).join(', ')};background-position:${L.map((l) => l.pos || '0 0').join(', ')};background-repeat:${L.map((l) => l.rep || 'repeat').join(', ')}` : 'background-image:none');
    return { style, minH: LN.PAGE_H };
  };

  /** the paper a page actually uses (page override → note → defaults) */
  LN.effPaper = (note, pg) => ({
    paper: (pg && pg.paper) || note.paper || 'lined',
    spacing: (pg && pg.spacing) || note.spacing || 'normal',
    color: (pg && pg.color) || note.color || '#ffffff',
  });
  LN.paperName = (paper) => (paper && paper.startsWith('custom:') ? ((LN.customPaper(paper.slice(7)) || {}).name || 'Custom') : (LN.PAPERS[paper] || LN.PAPERS.lined).name);

  /* ---------- picker ---------- */
  const thumb = (eff, label, attrs, active) => {
    const ps = LN.paperStyle(eff, 0.25);
    return `<button class="pp-tile ${active ? 'on' : ''}" ${attrs} title="${LN.esc(label)}"><span class="pp-thumb"><span class="pp-sheet" style="${ps.style}"></span></span><span class="pp-name">${LN.esc(label)}</span></button>`;
  };

  // scope: 'all' | page index
  LN.openPaperPicker = (scope = 'all') => {
    const E = LN.editor, note = E.note; if (!note) return;
    let target = scope;
    const render = () => {
      const pg = target === 'all' ? null : note.pages[target];
      const eff = LN.effPaper(note, pg);
      const customs = LN.state.customPapers || [];
      const body = LN.panel(`
        <h3>${LN.icon('layout')} Page background</h3>
        <div class="pp-scope seg">
          <button class="seg-btn ${target === 'all' ? 'active' : ''}" data-pp-scope="all">Whole note</button>
          ${note.pages.length > 1 || target !== 'all' ? `<button class="seg-btn ${target !== 'all' ? 'active' : ''}" data-pp-scope="${target === 'all' ? E.visiblePage() : target}">Page ${(target === 'all' ? E.visiblePage() : target) + 1} only</button>` : ''}
        </div>
        ${pg && pg.bg ? '<p class="muted small">This page is an imported PDF or image, so its background can’t be changed. You can still change its color for any blank space below.</p>' : ''}
        <h4 class="pp-h">Paper</h4>
        <div class="pp-grid">${LN.PAPER_ORDER.map((k) => thumb({ paper: k, spacing: eff.spacing, color: eff.color === '#ffffff' && LN.PAPERS[k].color ? LN.PAPERS[k].color : eff.color }, LN.PAPERS[k].name, `data-pp-paper="${k}"`, eff.paper === k)).join('')}</div>
        <h4 class="pp-h">Line spacing</h4>
        <div class="seg pp-spacing">${Object.entries(LN.SPACINGS).map(([k, v]) => `<button class="seg-btn ${eff.spacing === k ? 'active' : ''}" data-pp-spacing="${k}"><span class="sp-ico sp-${k}"></span>${v.name}</button>`).join('')}</div>
        <h4 class="pp-h">Paper color</h4>
        <div class="pp-colors">${LN.PAPER_COLORS.map((c) => `<button class="pp-color ${eff.color === c.id ? 'on' : ''}" data-pp-color="${c.id}" style="background:${c.id}" title="${c.name}" aria-label="${c.name}"></button>`).join('')}
          <label class="pp-color custom" title="Custom color"><input type="color" data-pp-colorpick value="${eff.color}"></label></div>
        <h4 class="pp-h">Your custom papers</h4>
        <div class="pp-grid">
          ${customs.map((c) => `<div class="pp-custom">${thumb({ paper: 'custom:' + c.id, spacing: eff.spacing, color: eff.color }, c.name, `data-pp-paper="custom:${c.id}"`, eff.paper === 'custom:' + c.id)}<button class="pp-del" data-pp-delcustom="${c.id}" title="Delete this paper" aria-label="Delete ${LN.esc(c.name)}">${LN.icon('x')}</button></div>`).join('')}
          <button class="pp-tile pp-upload" data-pp-upload><span class="pp-thumb">${LN.icon('upload')}</span><span class="pp-name">Upload image or PDF</span></button>
        </div>
        <p class="muted small">Upload any image or PDF page, such as a planner layout, worksheet or letterhead, to use as reusable paper.</p>
        <label class="check"><input type="checkbox" data-pp-default> Use this style for new notes</label>
        <div class="dlg-actions"><button class="btn btn-primary" data-close>Done</button></div>`, 'wide');
      body.onclick = onClick;
      body.onchange = onChange;
      body.oninput = (e) => { if (e.target.matches('[data-pp-colorpick]')) apply({ color: e.target.value }, true); };
    };
    const apply = (patch, quiet) => {
      if (target === 'all') {
        Object.assign(note, patch);
        // a whole-note change clears matching per-page overrides
        note.pages.forEach((p) => Object.keys(patch).forEach((k) => delete p[k]));
      } else Object.assign(note.pages[target], patch);
      LN.touch(note);
      E.refreshPaper();
      if (!quiet) render();
    };
    const onClick = async (e) => {
      const b = e.target.closest('button, [data-pp-upload]'); if (!b) return;
      if (b.dataset.ppScope) { target = b.dataset.ppScope === 'all' ? 'all' : +b.dataset.ppScope; render(); return; }
      if (b.dataset.ppPaper) {
        const patch = { paper: b.dataset.ppPaper };
        const P = LN.PAPERS[b.dataset.ppPaper];
        const cur = LN.effPaper(note, target === 'all' ? null : note.pages[target]);
        if (P && P.color && cur.color === '#ffffff') patch.color = P.color;
        else if (P && !P.color && cur.color === '#fef9c3' && cur.paper === 'legal') patch.color = '#ffffff';
        apply(patch); return;
      }
      if (b.dataset.ppSpacing) { apply({ spacing: b.dataset.ppSpacing }); return; }
      if (b.dataset.ppColor) { apply({ color: b.dataset.ppColor }); return; }
      if (b.dataset.ppDelcustom != null) {
        const id = b.dataset.ppDelcustom;
        const used = LN.state.notes.filter((n) => n.paper === 'custom:' + id || n.pages.some((p) => p.paper === 'custom:' + id)).length;
        if (!(await LN.confirm('Delete this custom paper?', used ? `${used} note${used > 1 ? 's use' : ' uses'} it. Those pages will switch to lined paper.` : 'It isn’t used by any note.'))) { render(); return; }
        LN.state.customPapers = LN.state.customPapers.filter((c) => c.id !== id);
        LN.state.notes.forEach((n) => { if (n.paper === 'custom:' + id) n.paper = 'lined'; n.pages.forEach((p) => { if (p.paper === 'custom:' + id) delete p.paper; }); });
        LN.save(); E.refreshPaper(); LN.openPaperPicker(target); return;
      }
      if (b.hasAttribute('data-pp-upload')) {
        pickFile('image/*,application/pdf', async (file) => {
          const c = await LN.addCustomPaper(file);
          if (c) { apply({ paper: 'custom:' + c.id }, true); LN.openPaperPicker(target); }
        });
      }
    };
    const onChange = (e) => {
      if (e.target.matches('[data-pp-default]') && e.target.checked) {
        const eff = LN.effPaper(note, target === 'all' ? null : note.pages[target]);
        LN.state.settings.paperDefault = eff; LN.save();
        LN.toast(`New notes will use ${LN.paperName(eff.paper)}, ${LN.SPACINGS[eff.spacing].name.toLowerCase()} spacing.`);
      }
    };
    render();
  };

  const pickFile = (accept, cb) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (f) cb(f); };
    inp.click();
  };

  /* ---------- custom papers (from images or PDFs) ---------- */
  LN.addCustomPaper = async (file) => {
    try {
      let pages;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) { LN.toast('Reading PDF…'); pages = await LN.editor.renderPdf(file, 1); }
      else pages = [await LN.editor.imageToPage(file)];
      if (!pages.length) return null;
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Custom paper';
      const c = { id: LN.uid(), name, bg: pages[0].url, h: Math.round(pages[0].h), created: Date.now() };
      (LN.state.customPapers = LN.state.customPapers || []).push(c);
      LN.save();
      LN.toast(`Added “${name}” to your papers.`);
      return c;
    } catch (e) {
      console.error(e); LN.toast('Couldn’t read that file. Use an image (PNG, JPG) or a PDF.'); return null;
    }
  };

  /* ---------- page templates (saved from your own pages) ---------- */
  LN.savePageTemplate = async (note, pg) => {
    const name = await LN.prompt('Save page as template', note.title ? `${note.title}: page ${note.pages.indexOf(pg) + 1}` : 'My template', 'Template name');
    if (!name) return;
    const eff = LN.effPaper(note, pg);
    const t = { id: LN.uid(), name, html: pg.html, strokes: JSON.parse(JSON.stringify(pg.strokes)).map((s) => { delete s.rec; return s; }), bg: pg.bg, bgH: pg.bgH, paper: eff.paper, spacing: eff.spacing, color: eff.color, created: Date.now() };
    (LN.state.pageTemplates = LN.state.pageTemplates || []).push(t);
    LN.save();
    LN.toast(`Saved “${name}”. Find it under Add page, or when you start a new note.`);
  };
  LN.pageFromTemplate = (t) => Object.assign(LN.newPage(t.html), { strokes: JSON.parse(JSON.stringify(t.strokes || [])), bg: t.bg || null, bgH: t.bgH || 0, paper: t.paper, spacing: t.spacing, color: t.color });

  /* ---------- add page panel ---------- */
  LN.openAddPage = () => {
    const E = LN.editor, note = E.note; if (!note) return;
    const tpls = LN.state.pageTemplates || [];
    const others = LN.state.notes.filter((n) => n.id !== note.id).sort((a, b) => b.updated - a.updated);
    const cur = LN.effPaper(note, note.pages[E.visiblePage()]);
    const body = LN.panel(`
      <h3>${LN.icon('pageplus')} Add a page</h3>
      <div class="ap-grid">
        <button class="ap-opt" data-ap="blank">${LN.icon('note')}<span><b>Blank page</b><small>${LN.esc(LN.paperName(cur.paper))}, ${LN.SPACINGS[cur.spacing].name.toLowerCase()} spacing</small></span></button>
        <button class="ap-opt" data-ap="dup">${LN.icon('copy')}<span><b>Duplicate current page</b><small>Copy page ${E.visiblePage() + 1} with its writing</small></span></button>
        <button class="ap-opt" data-ap="file">${LN.icon('filepdf')}<span><b>From a PDF or image</b><small>Every page becomes paper you can write on</small></span></button>
        <button class="ap-opt" data-ap="paper">${LN.icon('layout')}<span><b>Choose a different paper</b><small>Add a page, then pick its background</small></span></button>
      </div>
      ${tpls.length ? `<h4 class="pp-h">Your page templates</h4><div class="ap-list">${tpls.map((t) => `<div class="ap-row"><button class="ap-item" data-ap-tpl="${t.id}">${LN.icon('bookmark')} ${LN.esc(t.name)}</button><button class="icon-btn sm" data-ap-deltpl="${t.id}" title="Delete template">${LN.icon('trash')}</button></div>`).join('')}</div>` :
        '<p class="muted small">Tip: save any page as a reusable template with the bookmark button above that page.</p>'}
      ${others.length ? `<h4 class="pp-h">Copy a page from another note</h4>
        <div class="copy-row"><select data-ap-note>${others.map((n) => `<option value="${n.id}">${LN.esc(n.title || 'Untitled note')} (${n.pages.length} page${n.pages.length > 1 ? 's' : ''})</option>`).join('')}</select>
        <select data-ap-page></select><button class="btn btn-primary btn-sm" data-ap="copy">Copy page</button></div>` : ''}`, 'wide');
    const fillPages = () => {
      const sel = $('[data-ap-note]'); if (!sel) return;
      const n = LN.getNote(sel.value);
      $('[data-ap-page]').innerHTML = `<option value="all">All pages</option>` + n.pages.map((p, i) => `<option value="${i}">Page ${i + 1}${LN.htmlToText(p.html) ? ': ' + LN.esc(LN.htmlToText(p.html).slice(0, 24)) : ''}</option>`).join('');
    };
    fillPages();
    body.onchange = (e) => { if (e.target.matches('[data-ap-note]')) fillPages(); };
    const insert = (pages) => {
      const at = E.visiblePage() + 1;
      note.pages.splice(at, 0, ...pages);
      LN.touch(note); LN.closePanel();
      E.renderPages();
      requestAnimationFrame(() => E.pages[at] && E.pages[at].block.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return at;
    };
    body.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.apDeltpl) {
        if (!(await LN.confirm('Delete this template?', 'Pages you already made from it are not affected.'))) { LN.openAddPage(); return; }
        LN.state.pageTemplates = tpls.filter((t) => t.id !== b.dataset.apDeltpl); LN.save(); LN.openAddPage(); return;
      }
      if (b.dataset.apTpl) { const t = tpls.find((x) => x.id === b.dataset.apTpl); if (t) { insert([LN.pageFromTemplate(t)]); LN.toast(`Added a page from “${t.name}”.`); } return; }
      const a = b.dataset.ap;
      if (a === 'blank') insert([LN.newPage()].map((p) => (note.pages[E.visiblePage()] && note.pages[E.visiblePage()].paper ? Object.assign(p, { paper: cur.paper, spacing: cur.spacing, color: cur.color }) : p)));
      else if (a === 'dup') {
        const src = note.pages[E.visiblePage()];
        const copy = JSON.parse(JSON.stringify(src)); copy.id = LN.uid(); copy.strokes.forEach((s) => delete s.rec);
        insert([copy]);
      } else if (a === 'file') { LN.closePanel(); $('#file-pdf').click(); }
      else if (a === 'paper') { const at = insert([LN.newPage()]); setTimeout(() => LN.openPaperPicker(at), 50); }
      else if (a === 'copy') {
        const n = LN.getNote($('[data-ap-note]').value), which = $('[data-ap-page]').value;
        const src = which === 'all' ? n.pages : [n.pages[+which]];
        const copies = src.map((p) => {
          const c = JSON.parse(JSON.stringify(p)); c.id = LN.uid(); c.strokes.forEach((s) => delete s.rec);
          const eff = LN.effPaper(n, p); c.paper = eff.paper; c.spacing = eff.spacing; c.color = eff.color; // keep its look
          return c;
        });
        insert(copies);
        LN.toast(`Copied ${copies.length} page${copies.length > 1 ? 's' : ''} from “${n.title || 'Untitled note'}”.`);
      }
    };
  };

  /* custom papers & templates that a note depends on (for sharing / collaboration) */
  LN.papersUsedBy = (notes) => {
    const ids = new Set();
    notes.forEach((n) => [n.paper].concat(n.pages.map((p) => p.paper)).forEach((k) => { if (k && k.startsWith('custom:')) ids.add(k.slice(7)); }));
    return (LN.state.customPapers || []).filter((c) => ids.has(c.id));
  };
  LN.mergePapers = (papers) => {
    if (!papers || !papers.length) return;
    LN.state.customPapers = LN.state.customPapers || [];
    papers.forEach((c) => { if (!LN.customPaper(c.id)) LN.state.customPapers.push(c); });
  };
})();

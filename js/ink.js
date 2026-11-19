/* LataNote ink engine: pressure-sensitive pen, highlighter, shapes, stroke eraser */
(function () {
  'use strict';
  const LN = window.LN;
  const SHAPES = ['line', 'arrow', 'rect', 'ellipse'];
  LN.tool = { name: 'pen', color: '#1f2937', size: 3 };
  LN.toolStyles = { pen: 'fountain', pencil: '2b' };

  const r1 = (n) => Math.round(n * 10) / 10;

  function distToSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function shapePolyline(s) {
    const [x1, y1] = s.a, [x2, y2] = s.b;
    if (s.tool === 'rect') return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
    if (s.tool === 'ellipse') {
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
      const pts = [];
      for (let i = 0; i <= 36; i++) { const t = (i / 36) * Math.PI * 2; pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
      return pts;
    }
    return [s.a, s.b];
  }

  function hit(s, p, r) {
    const pts = s.pts || shapePolyline(s);
    const wide = s.tool === 'highlighter' || ['brush', 'marker', 'calligraphy', '6b'].includes(s.style);
    const tol = r + (wide ? s.size * 2 : s.size / 2);
    if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= tol;
    for (let i = 1; i < pts.length; i++) if (distToSeg(p, pts[i - 1], pts[i]) <= tol) return true;
    return false;
  }

  function strokePts(s) { return s.pts || shapePolyline(s); }
  function bbox(strokes) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    strokes.forEach((s) => {
      const pad = (s.tool === 'highlighter' ? s.size * 2 : s.size / 2) + 2;
      strokePts(s).forEach((p) => { x1 = Math.min(x1, p[0] - pad); y1 = Math.min(y1, p[1] - pad); x2 = Math.max(x2, p[0] + pad); y2 = Math.max(y2, p[1] + pad); });
    });
    return [x1, y1, x2, y2];
  }
  function inPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function translate(s, dx, dy) {
    if (s.pts) s.pts.forEach((p) => { p[0] += dx; p[1] += dy; });
    else { s.a = [s.a[0] + dx, s.a[1] + dy]; s.b = [s.b[0] + dx, s.b[1] + dy]; }
  }
  const clone = (s) => JSON.parse(JSON.stringify(s));
  LN.inkSel = null; // the Ink instance that currently holds a lasso selection

  /* ---------- pen & pencil styles ---------- */
  LN.PEN_STYLES = [
    { id: 'fountain', name: 'Fountain pen', hint: 'Responds to pressure and speed' },
    { id: 'ballpoint', name: 'Ballpoint', hint: 'Even, steady line' },
    { id: 'brush', name: 'Brush pen', hint: 'Tapered, expressive strokes' },
    { id: 'calligraphy', name: 'Calligraphy', hint: 'Angled nib: thick and thin' },
    { id: 'marker', name: 'Felt marker', hint: 'Bold, smooth and flat' },
  ];
  LN.PENCIL_STYLES = [
    { id: 'hb', name: 'Sharp (HB)', hint: 'Light, fine graphite' },
    { id: '2b', name: 'Soft (2B)', hint: 'Darker everyday pencil' },
    { id: '6b', name: 'Sketch (6B)', hint: 'Broad, dark shading' },
  ];
  const PENCIL = { hb: { w: 0.85, a: 0.66, layers: 1 }, '2b': { w: 1.1, a: 0.8, layers: 2 }, '6b': { w: 1.75, a: 0.92, layers: 3 } };

  // grainy graphite texture, cached per colour
  const grain = new Map();
  function pencilPattern(g, color) {
    let pat = grain.get(color);
    if (!pat) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, 1, 1);
      const [r, gg, b] = x.getImageData(0, 0, 1, 1).data;
      const img = x.createImageData(64, 64);
      let seed = 1234567;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = rnd();
        img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b;
        img.data[i + 3] = v < 0.42 ? 0 : Math.round(255 * (0.35 + (v - 0.42) * 1.12));
      }
      x.putImageData(img, 0, 0);
      pat = g.createPattern(c, 'repeat');
      if (pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
      grain.set(color, pat);
    }
    return pat;
  }

  function smoothPath(g, P) {
    g.beginPath(); g.moveTo(P[0][0], P[0][1]);
    if (P.length < 3) { g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); return; }
    for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    const L = P[P.length - 1]; g.lineTo(L[0], L[1]);
  }
  // draws the stroke as short curved segments, each with its own width
  function segmented(g, P, widthAt) {
    if (P.length < 3) {
      g.lineWidth = widthAt(0);
      g.beginPath(); g.moveTo(P[0][0], P[0][1]); g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.stroke();
      return;
    }
    let sx = P[0][0], sy = P[0][1];
    for (let i = 1; i < P.length - 1; i++) {
      const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
      g.lineWidth = widthAt(i);
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(P[i][0], P[i][1], mx, my); g.stroke();
      sx = mx; sy = my;
    }
    const L = P[P.length - 1];
    g.lineWidth = widthAt(P.length - 1);
    g.beginPath(); g.moveTo(sx, sy); g.lineTo(L[0], L[1]); g.stroke();
  }
  const segLen = (P, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; return Math.hypot(b[0] - a[0], b[1] - a[1]) / 2; };

  function drawPen(g, s, P) {
    const st = s.style || 'fountain', n = P.length;
    if (st === 'ballpoint') {
      g.globalAlpha *= 0.95;
      segmented(g, P, (i) => Math.max(0.6, s.size * (0.78 + P[i][2] * 0.3)));
    } else if (st === 'marker') {
      g.globalAlpha *= 0.9;
      g.lineWidth = s.size * 2.3;
      smoothPath(g, P); g.stroke();
    } else if (st === 'brush') {
      segmented(g, P, (i) => {
        const t = n > 1 ? i / (n - 1) : 0.5;
        const taper = Math.min(1, t * 7 + 0.15, (1 - t) * 5 + 0.15);
        return Math.max(0.5, s.size * (0.3 + P[i][2] * 2.3) * taper);
      });
    } else if (st === 'calligraphy') {
      const hw = s.size * 1.7, nx = Math.cos(-Math.PI / 4), ny = Math.sin(-Math.PI / 4);
      g.lineWidth = Math.max(0.8, s.size * 0.35);
      for (let i = 1; i < n; i++) {
        const a = P[i - 1], b = P[i], w = hw * (0.55 + b[2] * 0.9);
        g.beginPath();
        g.moveTo(a[0] + nx * w, a[1] + ny * w); g.lineTo(b[0] + nx * w, b[1] + ny * w);
        g.lineTo(b[0] - nx * w, b[1] - ny * w); g.lineTo(a[0] - nx * w, a[1] - ny * w);
        g.closePath(); g.fill(); g.stroke();
      }
      if (n === 1) { g.beginPath(); g.moveTo(P[0][0] + nx * hw, P[0][1] + ny * hw); g.lineTo(P[0][0] - nx * hw, P[0][1] - ny * hw); g.stroke(); }
    } else { // fountain: pressure + speed (faster = thinner)
      segmented(g, P, (i) => {
        const speed = Math.max(0.62, Math.min(1.15, 1.2 - segLen(P, i) / 28));
        return Math.max(0.6, s.size * (0.35 + P[i][2] * 1.3) * speed);
      });
    }
  }

  function drawPencil(g, s, P) {
    const k = PENCIL[s.style] || PENCIL['2b'];
    const avg = P.reduce((a, p) => a + p[2], 0) / P.length;
    g.strokeStyle = pencilPattern(g, s.color);
    g.globalAlpha *= Math.min(1, k.a * (0.65 + avg * 0.7));
    g.lineWidth = Math.max(0.8, s.size * k.w * (0.75 + avg * 0.5));
    smoothPath(g, P);
    for (let i = 0; i < k.layers; i++) g.stroke(); // softer leads lay down more graphite
    // a fainter, slightly wider pass gives the soft graphite edge
    g.globalAlpha *= 0.35;
    g.lineWidth *= 1.6;
    smoothPath(g, P); g.stroke();
  }

  LN.drawStroke = function (g, s, playback) {
    let alpha = 1;
    if (playback && s.rec && s.rec.id === playback.id && s.rec.t > playback.t) alpha = 0.1;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = s.color; g.fillStyle = s.color;
    const P = s.pts;
    if (s.tool === 'highlighter') {
      g.globalAlpha = 0.38 * alpha;
      g.lineWidth = s.size * 4;
      g.lineCap = 'butt';
      g.beginPath(); g.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length; i++) g.lineTo(P[i][0], P[i][1]);
      g.stroke();
    } else if (P) {
      g.globalAlpha = alpha;
      if (s.tool === 'pencil') drawPencil(g, s, P);
      else drawPen(g, s, P);
    } else {
      g.globalAlpha = alpha;
      g.lineWidth = s.size;
      const [x1, y1] = s.a, [x2, y2] = s.b;
      g.beginPath();
      if (s.tool === 'rect') g.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      else if (s.tool === 'ellipse') g.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
      else { g.moveTo(x1, y1); g.lineTo(x2, y2); }
      g.stroke();
      if (s.tool === 'arrow') {
        const ang = Math.atan2(y2 - y1, x2 - x1), head = 10 + s.size * 2.5;
        g.beginPath();
        g.moveTo(x2, y2); g.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45));
        g.moveTo(x2, y2); g.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45));
        g.stroke();
      }
    }
    g.restore();
  };

  LN.renderStrokes = function (canvas, strokes, w, h, res, playback, extra) {
    const g = canvas.getContext('2d');
    g.setTransform(res, 0, 0, res, 0, 0);
    g.clearRect(0, 0, w, h);
    for (const s of strokes) LN.drawStroke(g, s, playback);
    if (extra) LN.drawStroke(g, extra, null);
  };

  /**
   * host: { isDraw(): bool, commit(page, beforeStrokes): void }
   */
  class Ink {
    constructor(canvas, page, host) {
      this.c = canvas; this.page = page; this.host = host;
      this.w = 0; this.h = 0; this.res = 0;
      this.cur = null; this.erasing = false; this.raf = 0; this.pid = null;
      canvas.addEventListener('pointerdown', (e) => this.down(e));
      canvas.addEventListener('pointermove', (e) => this.move(e));
      canvas.addEventListener('pointerup', (e) => this.up(e));
      canvas.addEventListener('pointercancel', (e) => this.up(e));
      canvas.addEventListener('lostpointercapture', (e) => this.up(e));
    }
    resize(w, h, res) {
      if (w === this.w && h === this.h && res === this.res && this.c.width) return;
      this.w = w; this.h = h; this.res = res;
      this.c.width = Math.round(w * res); this.c.height = Math.round(h * res);
      this.render();
    }
    pos(e) {
      const r = this.c.getBoundingClientRect();
      const pr = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
      return [(e.clientX - r.left) / r.width * this.w, (e.clientY - r.top) / r.height * this.h, pr];
    }
    accepts(e) {
      if (!this.host.isDraw()) return false;
      if (LN.state.settings.penOnly && e.pointerType === 'touch') return false;
      if (e.pointerType === 'mouse' && e.button !== 0) return false;
      return true;
    }
    down(e) {
      if (this.host.isDraw() && LN.state.settings.penOnly && e.pointerType === 'touch') {
        // stylus-only mode: fingers scroll instead of drawing (palm rejection)
        this.pan = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { this.c.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        return;
      }
      if (LN.pinching || this.pid !== null || !this.accepts(e)) return;
      e.preventDefault();
      this.pid = e.pointerId;
      try { this.c.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      const t = LN.tool, p = this.pos(e);
      if (t.name === 'eraser') {
        this.clearSel();
        this.before = this.page.strokes.slice(); this.erasing = true; this.erase(p); return;
      }
      if (t.name === 'lasso') {
        if (this.sel && this.sel.length) {
          const [x1, y1, x2, y2] = bbox(this.sel);
          if (p[0] >= x1 - 8 && p[0] <= x2 + 8 && p[1] >= y1 - 8 && p[1] <= y2 + 8) {
            // start moving the selection; swap in copies so undo keeps the originals
            const before = this.page.strokes.slice();
            const orig = this.sel, copies = orig.map(clone);
            this.page.strokes = this.page.strokes.map((st) => { const i = orig.indexOf(st); return i >= 0 ? copies[i] : st; });
            this.sel = copies;
            this.drag = { before, orig, last: p, moved: false };
            return;
          }
        }
        this.clearSel();
        this.lasso = [p];
        this.schedule();
        return;
      }
      this.clearSel();
      this.cur = SHAPES.includes(t.name)
        ? { tool: t.name, color: t.color, size: t.size, a: p.slice(0, 2), b: p.slice(0, 2) }
        : { tool: t.name, color: t.color, size: t.size, pts: [p] };
      if ((t.name === 'pen' || t.name === 'pencil') && LN.toolStyles) this.cur.style = LN.toolStyles[t.name];
      const st = LN.audio && LN.audio.stamp(); if (st) this.cur.rec = st;
      this.schedule();
    }
    move(e) {
      if (this.pan && e.pointerId === this.pan.id) {
        if (LN.pinching) return;
        const area = this.c.closest('.pages-area');
        if (area) area.scrollBy(this.pan.x - e.clientX, this.pan.y - e.clientY);
        this.pan.x = e.clientX; this.pan.y = e.clientY;
        return;
      }
      if (e.pointerId !== this.pid) return;
      if (this.erasing) { this.erase(this.pos(e)); return; }
      if (this.drag) {
        const p = this.pos(e), dx = p[0] - this.drag.last[0], dy = p[1] - this.drag.last[1];
        this.sel.forEach((st) => translate(st, dx, dy));
        this.drag.last = p; this.drag.moved = true;
        this.schedule(); return;
      }
      if (this.lasso) { this.lasso.push(this.pos(e)); this.schedule(); return; }
      if (!this.cur) return;
      e.preventDefault();
      if (this.cur.pts) {
        const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        for (const ev of (evs.length ? evs : [e])) {
          const p = this.pos(ev), l = this.cur.pts[this.cur.pts.length - 1];
          if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.7) this.cur.pts.push(p);
        }
        if (this.cur.tool === 'highlighter' && e.shiftKey) { // straight highlight
          const a = this.cur.pts[0], b = this.cur.pts[this.cur.pts.length - 1];
          this.cur.pts = [a, [b[0], a[1], b[2]]];
        }
      } else {
        let [x, y] = this.pos(e);
        if (e.shiftKey) {
          const [ax, ay] = this.cur.a;
          if (this.cur.tool === 'rect' || this.cur.tool === 'ellipse') {
            const d = Math.max(Math.abs(x - ax), Math.abs(y - ay));
            x = ax + Math.sign(x - ax || 1) * d; y = ay + Math.sign(y - ay || 1) * d;
          } else {
            const ang = Math.round(Math.atan2(y - ay, x - ax) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x - ax, y - ay);
            x = ax + Math.cos(ang) * len; y = ay + Math.sin(ang) * len;
          }
        }
        this.cur.b = [x, y];
      }
      this.schedule();
    }
    up(e) {
      if (this.pan && e.pointerId === this.pan.id) { this.pan = null; return; }
      if (e.pointerId !== this.pid) return;
      this.pid = null;
      if (this.erasing) {
        this.erasing = false;
        if (this.before.length !== this.page.strokes.length) this.host.commit(this.page, this.before);
        return;
      }
      if (this.drag) {
        const d = this.drag; this.drag = null;
        this.sel.forEach((st) => { if (st.pts) st.pts.forEach((q) => { q[0] = r1(q[0]); q[1] = r1(q[1]); }); else { st.a = st.a.map(r1); st.b = st.b.map(r1); } });
        if (d.moved) this.host.commit(this.page, d.before); else { this.page.strokes = d.before; this.sel = d.orig; }
        this.render(); return;
      }
      if (this.lasso) {
        const poly = this.lasso; this.lasso = null;
        if (poly.length > 3) {
          const sel = this.page.strokes.filter((st) => {
            const pts = strokePts(st);
            const inside = pts.filter((q) => inPoly(q, poly)).length;
            return inside / pts.length >= 0.6;
          });
          this.setSel(sel);
        }
        this.render(); return;
      }
      if (!this.cur) return;
      const s = this.cur; this.cur = null;
      if (s.pts) {
        if (s.pts.length === 1) { const p = s.pts[0]; s.pts.push([p[0] + 0.3, p[1] + 0.3, p[2]]); }
        s.pts = s.pts.map((p) => [r1(p[0]), r1(p[1]), Math.round(p[2] * 100) / 100]);
      } else {
        if (Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 3) { this.render(); return; }
        s.a = s.a.map(r1); s.b = s.b.map(r1);
      }
      const before = this.page.strokes.slice();
      this.page.strokes.push(s);
      this.host.commit(this.page, before);
      this.render();
    }
    erase(p) {
      const r = 4 + LN.tool.size * 1.5;
      const keep = this.page.strokes.filter((s) => !hit(s, p, r));
      if (keep.length !== this.page.strokes.length) { this.page.strokes = keep; this.render(); }
    }
    // abandon whatever the pointer was doing (used when a pinch-zoom starts)
    cancel() {
      if (this.pid === null && !this.pan) return;
      if (this.erasing) this.page.strokes = this.before;
      if (this.drag) { this.page.strokes = this.drag.before; this.sel = this.drag.orig; }
      this.cur = null; this.lasso = null; this.erasing = false; this.drag = null; this.pid = null; this.pan = null;
      this.render();
    }
    setSel(sel) {
      if (LN.inkSel && LN.inkSel !== this) LN.inkSel.clearSel();
      this.sel = sel.length ? sel : null;
      LN.inkSel = this.sel ? this : null;
      LN.emit('ink-selection', !!this.sel);
      this.render();
    }
    clearSel() {
      if (!this.sel) return;
      this.sel = null;
      if (LN.inkSel === this) { LN.inkSel = null; LN.emit('ink-selection', false); }
      this.render();
    }
    deleteSel() {
      if (!this.sel) return;
      const before = this.page.strokes.slice();
      this.page.strokes = this.page.strokes.filter((st) => !this.sel.includes(st));
      this.host.commit(this.page, before);
      this.clearSel();
    }
    duplicateSel() {
      if (!this.sel) return;
      const before = this.page.strokes.slice();
      const copies = this.sel.map(clone);
      copies.forEach((st) => { delete st.rec; translate(st, 24, 24); });
      this.page.strokes = this.page.strokes.concat(copies);
      this.host.commit(this.page, before);
      this.setSel(copies);
    }
    recolorSel(color) {
      if (!this.sel) return;
      const before = this.page.strokes.slice();
      const copies = this.sel.map((st) => Object.assign(clone(st), { color }));
      this.page.strokes = this.page.strokes.map((st) => { const i = this.sel.indexOf(st); return i >= 0 ? copies[i] : st; });
      this.sel = copies;
      this.host.commit(this.page, before);
      this.render();
    }
    schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }
    render() {
      LN.renderStrokes(this.c, this.page.strokes, this.w, this.h, this.res, LN.audio && LN.audio.playback, this.cur);
      if (!this.sel && !this.lasso) return;
      const g = this.c.getContext('2d');
      g.save();
      g.setLineDash([6, 5]); g.lineWidth = 1.5; g.strokeStyle = '#4f46e5'; g.fillStyle = 'rgba(79,70,229,.07)';
      if (this.lasso) {
        g.beginPath(); this.lasso.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.stroke();
      }
      if (this.sel) {
        const [x1, y1, x2, y2] = bbox(this.sel);
        g.fillRect(x1 - 6, y1 - 6, x2 - x1 + 12, y2 - y1 + 12);
        g.strokeRect(x1 - 6, y1 - 6, x2 - x1 + 12, y2 - y1 + 12);
      }
      g.restore();
    }
  }
  LN.Ink = Ink;
})();

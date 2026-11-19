/* LataNote ink engine: pressure-sensitive pen, highlighter, shapes, stroke eraser */
(function () {
  'use strict';
  const LN = window.LN;
  const SHAPES = ['line', 'arrow', 'rect', 'ellipse'];
  LN.tool = { name: 'pen', color: '#1f2937', size: 3 };

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
    const tol = r + (s.tool === 'highlighter' ? s.size * 2 : s.size / 2);
    if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= tol;
    for (let i = 1; i < pts.length; i++) if (distToSeg(p, pts[i - 1], pts[i]) <= tol) return true;
    return false;
  }

  function penWidth(s, pr) { return s.tool === 'pen' ? Math.max(0.6, s.size * (0.35 + pr * 1.3)) : s.size; }

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
      if (P.length < 3) {
        g.lineWidth = penWidth(s, P[0][2]);
        g.beginPath(); g.moveTo(P[0][0], P[0][1]); g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.stroke();
      } else {
        // quadratic smoothing through midpoints, width varies per segment with pressure
        let sx = P[0][0], sy = P[0][1];
        for (let i = 1; i < P.length - 1; i++) {
          const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
          g.lineWidth = penWidth(s, P[i][2]);
          g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(P[i][0], P[i][1], mx, my); g.stroke();
          sx = mx; sy = my;
        }
        const L = P[P.length - 1];
        g.lineWidth = penWidth(s, L[2]);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(L[0], L[1]); g.stroke();
      }
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
      if (this.pid !== null || !this.accepts(e)) return;
      e.preventDefault();
      this.pid = e.pointerId;
      try { this.c.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      const t = LN.tool, p = this.pos(e);
      if (t.name === 'eraser') {
        this.before = this.page.strokes.slice(); this.erasing = true; this.erase(p); return;
      }
      this.cur = SHAPES.includes(t.name)
        ? { tool: t.name, color: t.color, size: t.size, a: p.slice(0, 2), b: p.slice(0, 2) }
        : { tool: t.name, color: t.color, size: t.size, pts: [p] };
      const st = LN.audio && LN.audio.stamp(); if (st) this.cur.rec = st;
      this.schedule();
    }
    move(e) {
      if (this.pan && e.pointerId === this.pan.id) {
        const area = this.c.closest('.pages-area');
        if (area) area.scrollBy(this.pan.x - e.clientX, this.pan.y - e.clientY);
        this.pan.x = e.clientX; this.pan.y = e.clientY;
        return;
      }
      if (e.pointerId !== this.pid) return;
      if (this.erasing) { this.erase(this.pos(e)); return; }
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
    schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); }
    render() { LN.renderStrokes(this.c, this.page.strokes, this.w, this.h, this.res, LN.audio && LN.audio.playback, this.cur); }
  }
  LN.Ink = Ink;
})();

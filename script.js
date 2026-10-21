/* =========================================================
   Origineer · 个人主页
   1. 工具
   2. 背景星场
   3. 时钟（首屏与星系中心共用）
   4. 星图：等边三角行星 + 星尘环带
   5. 行星详情弹窗
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  /* ===== 1. 工具 ===== */
  function setupCanvas(canvas, maxDpr) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function observeSize(el, cb) {
    if (!el) return;
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => cb());
      ro.observe(el);
      return ro;
    }
    window.addEventListener('resize', cb);
    return null;
  }

  /* ===== 2. 背景星场 ===== */
  class Backdrop {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.stars = [];
      this.px = 0;
      this.py = 0;
      this.tx = 0;
      this.ty = 0;
      this.frame = 0;
      this.neb = [
        { x: 0.22, y: 0.24, r: 0.62, c: '74, 58, 150', a: 0.3, sp: 0.014, ph: 0 },
        { x: 0.82, y: 0.58, r: 0.5, c: '16, 74, 96', a: 0.24, sp: 0.011, ph: 2.1 },
        { x: 0.55, y: 0.9, r: 0.46, c: '104, 66, 44', a: 0.2, sp: 0.017, ph: 4.2 }
      ];

      /* 蓝色科幻立方粒子 */
      this.cubes = Array.from({ length: 24 }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        s: 12 + Math.random() * 22,
        sp: 0.15 + Math.random() * 0.4,
        ph: Math.random() * TAU,
        rot: Math.random() * TAU,
        rotSp: (Math.random() - 0.5) * 0.5,
        fl: 0.6 + Math.random() * 1.8,
        depth: 6 + Math.random() * 18,
        hue: i % 3 === 0 ? '120, 200, 255' : '80, 150, 255'
      }));

      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('pointermove', (e) => {
        this.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        this.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.w = w;
      this.h = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(70, Math.round((w * h) / 11500));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.3 + Math.random() * 1.15,
        a: 0.12 + Math.random() * 0.5,
        tw: Math.random() * TAU,
        sp: 0.2 + Math.random() * 0.9,
        d: 1 + Math.floor(Math.random() * 3)
      }));
      const hues = ['201, 168, 106', '124, 112, 208', '86, 156, 168', '206, 150, 120'];
      this.bokeh = Array.from({ length: 7 }, (_, i) => {
        const near = i < 2;
        return {
          x: Math.random(),
          y: Math.random(),
          r: (near ? 0.14 : 0.06) + Math.random() * 0.09,
          a: near ? 0.05 : 0.075,
          hue: hues[i % hues.length],
          sp: 0.015 + Math.random() * 0.03,
          ph: Math.random() * TAU,
          depth: near ? 26 : 7,
          near
        };
      });
      this.buildBackground();
      if (reduceMotion) this.render(2);
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        if (this.frame++ % 2 === 0) this.render(now / 1000);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    render(t) {
      const { ctx, w, h } = this;
      if (!w || !h) return;
      this.px += (this.tx - this.px) * 0.035;
      this.py += (this.ty - this.py) * 0.035;

      ctx.clearRect(0, 0, w, h);
      if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);

      this.stars.forEach((s) => {
        const a = s.a * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw));
        ctx.beginPath();
        ctx.arc(s.x + this.px * s.d * 5, s.y + this.py * s.d * 5, s.r, 0, TAU);
        ctx.fillStyle = `rgba(238, 231, 214, ${Math.max(a, 0.04)})`;
        ctx.fill();
      });

      this.drawCubes(t);
      this.drawBokeh(t, true);
    }

    /* 蓝色线框立方体，缓慢自转并闪烁 */
    drawCubes(t) {
      const { ctx, w, h } = this;
      const EDGES = [
        [0, 1], [2, 3], [4, 5], [6, 7],
        [0, 2], [1, 3], [4, 6], [5, 7],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
      (this.cubes || []).forEach((c) => {
        const cx = c.x * w + this.px * c.depth + Math.sin(t * c.sp + c.ph) * 14;
        const cy = c.y * h + this.py * c.depth + Math.cos(t * c.sp * 1.2 + c.ph) * 12;
        const flick = 0.25 + 0.75 * Math.abs(Math.sin(t * c.fl + c.ph));
        const rot = c.rot + t * c.rotSp;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const pts = [];
        for (let i = 0; i < 8; i++) {
          const dx = i & 1 ? c.s : -c.s;
          const dy = i & 2 ? c.s : -c.s;
          const dz = i & 4 ? c.s : -c.s;
          const X = dx * cos - dz * sin;
          const Z = dx * sin + dz * cos;
          const k = 1 / (1 + Z / (c.s * 8));
          pts.push([cx + X * k, cy + dy * k]);
        }
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.s * 2.4);
        halo.addColorStop(0, `rgba(${c.hue}, ${0.10 * flick})`);
        halo.addColorStop(1, `rgba(${c.hue}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, c.s * 2.4, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(${c.hue}, ${0.14 * flick})`;
        ctx.lineWidth = 4;
        EDGES.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(pts[a][0], pts[a][1]);
          ctx.lineTo(pts[b][0], pts[b][1]);
          ctx.stroke();
        });
        ctx.strokeStyle = `rgba(${c.hue}, ${0.62 * flick})`;
        ctx.lineWidth = 1.2;
        EDGES.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(pts[a][0], pts[a][1]);
          ctx.lineTo(pts[b][0], pts[b][1]);
          ctx.stroke();
        });
        ctx.fillStyle = `rgba(${c.hue}, ${0.5 * flick})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 1.9, 0, TAU);
        ctx.fill();
      });
    }

    /* 星云与远景散景变化很慢，预渲染一次，避免每帧铺满屏幕的渐变 */
    buildBackground() {
      const { w, h } = this;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.neb.forEach((n) => {
        const px = w * n.x;
        const py = h * n.y;
        const rg = x.createRadialGradient(px, py, 0, px, py, Math.min(w, h) * n.r);
        rg.addColorStop(0, `rgba(${n.c}, ${n.a * 0.9})`);
        rg.addColorStop(0.45, `rgba(${n.c}, ${n.a * 0.34})`);
        rg.addColorStop(1, `rgba(${n.c}, 0)`);
        x.fillStyle = rg;
        x.fillRect(0, 0, w, h);
      });

      (this.bokeh || []).forEach((b) => {
        if (b.near) return;
        const R = Math.min(w, h) * b.r;
        const px = b.x * w;
        const py = b.y * h;
        const g = x.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, `rgba(${b.hue}, ${b.a})`);
        g.addColorStop(0.55, `rgba(${b.hue}, ${b.a * 0.45})`);
        g.addColorStop(1, `rgba(${b.hue}, 0)`);
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, R, 0, TAU);
        x.fill();
      });

      this.bg = c;
    }

    drawBokeh(t, near) {
      const { ctx, w, h } = this;
      (this.bokeh || []).forEach((b) => {
        if (b.near !== near) return;
        const R = Math.min(w, h) * b.r;
        const x = b.x * w + Math.sin(t * b.sp + b.ph) * 34 + this.px * b.depth;
        const y = b.y * h + Math.cos(t * b.sp * 1.2 + b.ph) * 26 + this.py * b.depth;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(${b.hue}, ${b.a})`);
        g.addColorStop(0.55, `rgba(${b.hue}, ${b.a * 0.45})`);
        g.addColorStop(1, `rgba(${b.hue}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.fill();
      });
    }
  }

  /* ===== 3. 时钟（公用绘制） ===== */
  const RINGS = [
    { r: 292, tx: 1.29, tz: 0.0, speed: 0.22, beads: [0.4, 3.1] },
    { r: 244, tx: 1.06, tz: 0.5, speed: -0.17, beads: [1.6, 4.6] }
  ];

  const DUST = Array.from({ length: 24 }, () => ({
    a: Math.random() * TAU,
    r: 0.28 + Math.random() * 0.72,
    s: 0.15 + Math.random() * 0.5,
    o: Math.random() * TAU
  }));

  function ringPoint(r, th, tiltX, tiltZ) {
    const x0 = Math.cos(th) * r;
    const y0 = Math.sin(th) * r;
    const c1 = Math.cos(tiltX), s1 = Math.sin(tiltX);
    const y1 = y0 * c1;
    const z1 = y0 * s1;
    const c2 = Math.cos(tiltZ), s2 = Math.sin(tiltZ);
    return [x0 * c2 - y1 * s2, x0 * s2 + y1 * c2, z1];
  }

  function projectPoint(p, cx, cy, zoom, ax, ay) {
    const cyaw = Math.cos(ay), syaw = Math.sin(ay);
    const X = p[0] * cyaw + p[2] * syaw;
    const Z = -p[0] * syaw + p[2] * cyaw;
    const cp = Math.cos(ax), sp = Math.sin(ax);
    const Y = p[1] * cp - Z * sp;
    const Z2 = p[1] * sp + Z * cp;
    const F = 2100;
    const k = F / (F + Z2);
    return [cx + X * zoom * k, cy + Y * zoom * k, k];
  }

  /* 在给定画布区域内画一座浑天仪时钟 */
  function drawOrrery(ctx, w, h, t, opts) {
    const o = opts || {};
    const px = o.px || 0;
    const py = o.py || 0;
    const drawBg = o.bg === true;
    const cheap = !!o.cheap;

    const cx = w / 2 + px * 16;
    const cy = h / 2 + Math.sin(t * 0.45) * 5 + py * 16;
    const zoom = Math.min(w, h) / 780;
    const ax = 0.36 + Math.sin(t * 0.16) * 0.04 + py * 0.05;
    const ay = t * 0.11 + px * 0.12;

    if (drawBg) {
      const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * 0.62);
      bg.addColorStop(0, 'rgba(214, 178, 112, 0.16)');
      bg.addColorStop(0.42, 'rgba(140, 108, 60, 0.06)');
      bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    const P = (p) => projectPoint(p, cx, cy, zoom, ax, ay);

    /* 背面的环 */
    strokeRing(ctx, P, t, false);

    /* 表盘 */
    drawDial(ctx, cx, cy, zoom, ax, t);

    /* 正面的环 */
    strokeRing(ctx, P, t, true);

    /* 光尘 */
    if (!cheap) {
      DUST.forEach((d) => {
      const ang = d.a + t * d.s * 0.12;
      const rad = d.r * Math.min(w, h) * 0.48;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad * 0.62;
      const tw = 0.35 + 0.35 * Math.sin(t * 0.9 + d.o);
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + d.r * 1.2, 0, TAU);
      ctx.fillStyle = `rgba(236, 219, 186, ${0.1 + tw * 0.18})`;
      ctx.fill();
      });
    }

    function strokeRing(c, P2, time, front) {
      RINGS.forEach((ring, idx) => {
        const spin = time * ring.speed + idx;
        c.beginPath();
        let pen = false;
        const N = cheap ? 108 : 168;
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * TAU;
          const p = ringPoint(ring.r, th, ring.tx, ring.tz + spin);
          const pts = P2(p);
          const isFront = p[2] > 0;
          if (isFront !== front) { pen = false; continue; }
          if (!pen) { c.moveTo(pts[0], pts[1]); pen = true; }
          else c.lineTo(pts[0], pts[1]);
        }
        if (front) {
          /* 不用 shadowBlur（很贵），改用两层描边模拟辉光 */
          c.strokeStyle = 'rgba(214, 178, 112, 0.10)';
          c.lineWidth = 4.5;
          c.stroke();
          c.strokeStyle = 'rgba(246, 230, 200, 0.72)';
          c.lineWidth = 1.1;
          c.stroke();
        } else {
          c.strokeStyle = 'rgba(196, 163, 104, 0.13)';
          c.lineWidth = 0.9;
          c.stroke();
        }

        if (cheap) return;

        ring.beads.forEach((offset) => {
          const th = time * ring.speed * 1.4 + offset;
          const p = ringPoint(ring.r, th, ring.tx, ring.tz + spin);
          if ((p[2] > 0) !== front) return;
          const pts = P2(p);
          const r = 4.6 * pts[2] * (front ? 1 : 0.75);
          const g = c.createRadialGradient(pts[0] - r * 0.3, pts[1] - r * 0.3, 0.4, pts[0], pts[1], r);
          g.addColorStop(0, 'rgba(255, 246, 220, 0.95)');
          g.addColorStop(0.55, 'rgba(230, 199, 141, 0.9)');
          g.addColorStop(1, 'rgba(150, 114, 60, 0.15)');
          c.beginPath();
          c.arc(pts[0], pts[1], r, 0, TAU);
          c.fillStyle = g;
          c.fill();
        });
      });
    }

    function drawDial(c, cx2, cy2, zoom2, ax2, time) {
      /* 表盘基本正对镜头：只留极小的倾斜，保证看上去是正圆 */
      const tiltX = 0.1 + Math.sin(time * 0.4) * 0.008;
      const P2 = (p) => projectPoint(p, cx2, cy2, zoom2, 0, 0);

      const dp = (r, th) => {
        const x0 = Math.cos(th) * r;
        const y0 = Math.sin(th) * r;
        const cc = Math.cos(tiltX), ss = Math.sin(tiltX);
        return [x0, y0 * cc, y0 * ss];
      };

      const R = 205;

      /* 柔光 */
      const glow = c.createRadialGradient(cx2, cy2, R * zoom2 * 0.55, cx2, cy2, R * zoom2 * 1.7);
      glow.addColorStop(0, 'rgba(214, 178, 112, 0.1)');
      glow.addColorStop(0.55, 'rgba(214, 178, 112, 0.045)');
      glow.addColorStop(1, 'rgba(214, 178, 112, 0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(cx2, cy2, R * zoom2 * 1.7, 0, TAU);
      c.fill();

      /* 盘面 */
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P2(dp(R, (i / 120) * TAU));
        i === 0 ? c.moveTo(pts[0], pts[1]) : c.lineTo(pts[0], pts[1]);
      }
      c.closePath();
      const fill = c.createRadialGradient(cx2 - R * zoom2 * 0.35, cy2 - R * zoom2 * 0.4, R * zoom2 * 0.1,
        cx2, cy2, R * zoom2 * 1.08);
      fill.addColorStop(0, 'rgba(38, 52, 84, 0.97)');
      fill.addColorStop(0.5, 'rgba(17, 24, 40, 0.98)');
      fill.addColorStop(1, 'rgba(6, 8, 14, 0.99)');
      c.fillStyle = fill;
      c.fill();

      /* 玻璃高光 */
      const sheen = c.createLinearGradient(cx2 - R * zoom2, cy2 - R * zoom2, cx2 + R * zoom2 * 0.6, cy2 + R * zoom2);
      sheen.addColorStop(0, 'rgba(255, 245, 220, 0.07)');
      sheen.addColorStop(0.4, 'rgba(255, 245, 220, 0.015)');
      sheen.addColorStop(1, 'rgba(255, 245, 220, 0)');
      c.fillStyle = sheen;
      c.fill();

      /* 内圈 */
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P2(dp(R * 0.62, (i / 120) * TAU));
        i === 0 ? c.moveTo(pts[0], pts[1]) : c.lineTo(pts[0], pts[1]);
      }
      c.closePath();
      c.strokeStyle = 'rgba(232, 208, 160, 0.12)';
      c.lineWidth = 1;
      c.stroke();

      /* 外沿：先一圈柔光，再一圈实边，让表盘从背景里浮出来 */
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P2(dp(R * 1.06, (i / 120) * TAU));
        i === 0 ? c.moveTo(pts[0], pts[1]) : c.lineTo(pts[0], pts[1]);
      }
      c.closePath();
      c.strokeStyle = 'rgba(214, 178, 112, 0.16)';
      c.lineWidth = 7;
      c.stroke();

      c.strokeStyle = 'rgba(244, 226, 190, 0.9)';
      c.lineWidth = 2.2;
      c.stroke();

      /* 刻度 */
      for (let i = 0; i < 60; i++) {
        const th = (i / 60) * TAU - Math.PI / 2;
        const major = i % 5 === 0;
        const a = P2(dp(R * (major ? 0.8 : 0.86), th));
        const b = P2(dp(R * 0.9, th));
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.lineTo(b[0], b[1]);
        c.strokeStyle = major ? 'rgba(242, 226, 194, 0.55)' : 'rgba(242, 226, 194, 0.18)';
        c.lineWidth = major ? 1.3 : 0.7;
        c.stroke();
      }

      /* 罗马数字 */
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(238, 226, 202, 0.62)';
      const marks = [['XII', 0], ['III', 0.25], ['VI', 0.5], ['IX', 0.75]];
      marks.forEach(([label, frac]) => {
        const th = frac * TAU - Math.PI / 2;
        const pts = P2(dp(R * 0.66, th));
        c.font = `${Math.round(21 * pts[2] * zoom2 * 1.6)}px Georgia, "Times New Roman", serif`;
        c.fillText(label, pts[0], pts[1]);
      });

      /* 指针 */
      const now = new Date();
      const secs = now.getSeconds() + now.getMilliseconds() / 1000;
      const mins = now.getMinutes() + secs / 60;
      const hours = (now.getHours() % 12) + mins / 60;

      const center = P2([0, 0, 0]);
      const hand = (frac, len, width, color, alpha) => {
        const th = frac * TAU - Math.PI / 2;
        const tip = P2(dp(len, th));
        const tail = P2(dp(-len * 0.12, th));
        c.beginPath();
        c.moveTo(tail[0], tail[1]);
        c.lineTo(tip[0], tip[1]);
        c.strokeStyle = color;
        c.globalAlpha = alpha;
        c.lineWidth = width * zoom2 * 1.6;
        c.lineCap = 'round';
        c.shadowColor = 'rgba(255, 232, 190, 0.45)';
        c.shadowBlur = 8;
        c.stroke();
        c.shadowBlur = 0;
        c.globalAlpha = 1;
      };

      hand(hours / 12, R * 0.5, 2.1, '#f5e6c6', 0.95);
      hand(mins / 60, R * 0.74, 1.5, '#f7ecd4', 0.95);
      hand(secs / 60, R * 0.82, 0.7, '#e6a887', 0.9);

      /* 中心轴 */
      const capR = 5.2 * zoom2 * 1.6;
      const cap = c.createRadialGradient(center[0] - capR * 0.4, center[1] - capR * 0.4, 0.5, center[0], center[1], capR);
      cap.addColorStop(0, '#fff6dc');
      cap.addColorStop(0.6, '#c9a86a');
      cap.addColorStop(1, '#4a3517');
      c.beginPath();
      c.arc(center[0], center[1], capR, 0, TAU);
      c.fillStyle = cap;
      c.fill();
    }
  }

  class Orrery {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.px = 0;
      this.py = 0;
      this.tx = 0;
      this.ty = 0;
      this.resize();
      window.addEventListener('pointermove', (e) => {
        this.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        this.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    resize() {
      const { ctx, w, h } = setupCanvas(this.canvas, 1.5);
      this.ctx = ctx;
      this.w = w;
      this.h = h;
      if (reduceMotion) this.render(2.4);
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        this.render(now / 1000);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    render(t) {
      const { ctx, w, h } = this;
      if (!w || !h) return;
      this.px += (this.tx - this.px) * 0.04;
      this.py += (this.ty - this.py) * 0.04;
      ctx.clearRect(0, 0, w, h);
      drawOrrery(ctx, w, h, t, { px: this.px, py: this.py });
    }
  }

  /* ===== 4. 星图 ===== */
  const TILT = -0.18;

  const PLANETS = [
    {
      key: 'data', r: 44,
      lit: '#efe9ff', mid: '#9a86ff', dark: '#4a30b8', edge: '#1a0f45', glow: '150, 130, 255'
    },
    {
      key: 'self', r: 56, bands: true,
      lit: '#6a6a72', mid: '#1b1b20', dark: '#08080a', edge: '#000000', glow: '120, 150, 210'
    },
    {
      key: 'finance', r: 42, ring: true,
      lit: '#fff6d8', mid: '#f0c979', dark: '#a9711f', edge: '#3d2606', glow: '240, 205, 138'
    }
  ];

  class Galaxy {
    constructor(root, canvas, planets) {
      this.root = root;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.planets = planets;
      this.w = 0;
      this.h = 0;
      this.stars = [];
      this.nebula = [];
      this.belt = [];
      this.paused = false;
      this.bg = null;

      /* 每颗行星的表面斑块，构造时固定，避免逐帧闪烁 */
      planets.forEach((p) => {
        p.patches = Array.from({ length: 7 }, () => ({
          a: Math.random() * TAU,
          d: 0.2 + Math.random() * 0.62,
          s: 0.12 + Math.random() * 0.22,
          al: 0.04 + Math.random() * 0.08
        }));
      });

      this.resize();
    }

    resize() {
      const { ctx, w, h } = setupCanvas(this.canvas, 1.75);
      this.ctx = ctx;
      this.w = w;
      this.h = h;
      this.fit = clamp(w / 1080, 0.62, 1.1);
      this.cx = w / 2;
      this.cy = h / 2;

      const RATIO = 0.96;
      const tiltK = Math.abs(Math.cos(TILT)) + RATIO * Math.abs(Math.sin(TILT));
      this.A = Math.min((h * 0.42) / RATIO, (w * 0.5 - 58) / tiltK);
      this.B = this.A * RATIO;

      this.seed();
      this.buildBackground();
      if (reduceMotion) this.render(3);
    }

    seed() {
      const { w, h } = this;
      const count = Math.max(80, Math.round((w * h) / 9000));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.25,
        a: Math.random() * 0.5 + 0.18,
        tw: Math.random() * TAU,
        sp: 0.4 + Math.random() * 1.6
      }));

      this.nebula = [
        { x: 0.28, y: 0.3, r: 0.5, c: '92, 74, 176', a: 0.16 },
        { x: 0.74, y: 0.66, r: 0.46, c: '24, 94, 112', a: 0.12 }
      ];

      /* 星尘环带：主带 + 两道稀疏外带 */
      const palette = ['238, 228, 206', '244, 210, 146', '182, 164, 255', '220, 196, 156'];
      this.belt = Array.from({ length: 420 }, (_, i) => {
        const outer = i > 300;
        const far = i > 380;
        return {
          ang: Math.random() * TAU,
          rad: outer
            ? (far ? 1.3 + Math.random() * 0.28 : 1.14 + Math.random() * 0.12)
            : 0.975 + Math.random() * 0.19,
          size: 0.6 + Math.random() * 2.1,
          alpha: 0.14 + Math.random() * 0.55,
          color: palette[Math.floor(Math.random() * palette.length)],
          speed: 0.05 + (Math.random() - 0.5) * 0.02
        };
      });
    }

    /* 星云、银河带、静态星点、轨道线 → 预渲染到离屏画布 */
    buildBackground() {
      const { w, h, cx, cy, A, B } = this;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* 星云 */
      this.nebula.forEach((n) => {
        const px = w * n.x;
        const py = h * n.y;
        const rg = x.createRadialGradient(px, py, 0, px, py, Math.min(w, h) * n.r);
        rg.addColorStop(0, `rgba(${n.c}, ${n.a})`);
        rg.addColorStop(0.55, `rgba(${n.c}, ${n.a * 0.35})`);
        rg.addColorStop(1, `rgba(${n.c}, 0)`);
        x.fillStyle = rg;
        x.fillRect(0, 0, w, h);
      });

      /* 银河带：沿轨道平面的一条亮带 */
      x.save();
      x.translate(cx, cy);
      x.rotate(TILT);
      const band = x.createLinearGradient(-A * 1.45, 0, A * 1.45, 0);
      band.addColorStop(0, 'rgba(150, 140, 210, 0)');
      band.addColorStop(0.22, 'rgba(176, 160, 220, 0.1)');
      band.addColorStop(0.5, 'rgba(244, 222, 184, 0.18)');
      band.addColorStop(0.78, 'rgba(176, 160, 220, 0.1)');
      band.addColorStop(1, 'rgba(150, 140, 210, 0)');
      x.fillStyle = band;
      x.beginPath();
      x.ellipse(0, 0, A * 1.55, B * 1.5, 0, 0, TAU);
      x.fill();
      x.restore();

      /* 银河颗粒：沿椭圆密集分布的小星，垂直方向散开 */
      const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      for (let i = 0; i < 1600; i++) {
        const ang = Math.random() * TAU;
        const rad = 0.52 + Math.random() * 0.92;
        const pts = this.orbit(ang, A * rad, B * rad, cx, cy);
        const px = pts[0];
        const py = pts[1] + gauss() * 20;
        const size = 0.3 + Math.random() * 1.1;
        const a = 0.05 + Math.random() * 0.35;
        x.beginPath();
        x.arc(px, py, size, 0, TAU);
        x.fillStyle = Math.random() > 0.72
          ? `rgba(238, 216, 180, ${a})`
          : `rgba(214, 218, 255, ${a})`;
        x.fill();
      }

      /* 少量亮星，带十字光芒 */
      for (let i = 0; i < 26; i++) {
        const ang = Math.random() * TAU;
        const rad = 0.5 + Math.random() * 0.9;
        const pts = this.orbit(ang, A * rad, B * rad, cx, cy);
        const px = pts[0];
        const py = pts[1] + gauss() * 24;
        const r = 0.9 + Math.random() * 1.1;
        x.beginPath();
        x.arc(px, py, r, 0, TAU);
        x.fillStyle = 'rgba(255, 248, 232, 0.85)';
        x.fill();
        x.strokeStyle = 'rgba(255, 240, 210, 0.30)';
        x.lineWidth = 0.8;
        x.beginPath();
        x.moveTo(px - r * 4, py);
        x.lineTo(px + r * 4, py);
        x.moveTo(px, py - r * 4);
        x.lineTo(px, py + r * 4);
        x.stroke();
      }

      /* 静态星点 */
      this.stars.forEach((s) => {
        x.beginPath();
        x.arc(s.x, s.y, s.r, 0, TAU);
        x.fillStyle = `rgba(236, 228, 210, ${s.a * 0.55})`;
        x.fill();
      });

      /* 轨道线 */
      [0.72, 1, 1.22, 1.44].forEach((k) => {
        x.beginPath();
        for (let i = 0; i <= 150; i++) {
          const pts = this.orbit((i / 150) * TAU, A * k, B * k, cx, cy);
          i === 0 ? x.moveTo(pts[0], pts[1]) : x.lineTo(pts[0], pts[1]);
        }
        x.closePath();
        x.strokeStyle = k === 1 ? 'rgba(226, 190, 128, 0.16)' : 'rgba(226, 190, 128, 0.06)';
        x.lineWidth = k === 1 ? 1 : 0.8;
        x.setLineDash(k === 1 ? [] : [2, 10]);
        x.stroke();
        x.setLineDash([]);
      });

      this.bg = c;
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        if (!this.paused) this.render(now / 1000);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    /* 椭圆轨道上的点（含视角倾斜） */
    orbit(ang, A, B, cx, cy) {
      const x0 = Math.cos(ang) * A;
      const y0 = Math.sin(ang) * B;
      const c = Math.cos(TILT), s = Math.sin(TILT);
      return [cx + x0 * c - y0 * s, cy + x0 * s + y0 * c];
    }

    render(t) {
      const { ctx, w, h, cx, cy, A, B } = this;
      if (!w || !h) return;

      ctx.clearRect(0, 0, w, h);
      if (this.bg) ctx.drawImage(this.bg, 0, 0, w, h);

      /* 星尘（远侧） */
      this.drawBelt(ctx, cx, cy, A, B, t, false);

      /* 行星位置：等边三角 */
      const base = t * 0.16;
      const objs = this.planets.map((p, i) => {
        const ang = base + (i * TAU) / 3;
        const pts = this.orbit(ang, A, B, cx, cy);
        return { p, ang, x: pts[0], y: pts[1], z: Math.sin(ang) };
      });

      objs.filter((o) => o.z < 0).sort((m, n) => m.z - n.z)
        .forEach((o) => this.drawPlanet(ctx, o, cx, cy, A, B));

      /* 中央时钟 */
      const clockSize = Math.min(w * 0.4, h * 0.52);
      ctx.save();
      ctx.translate(cx - clockSize / 2, cy - clockSize / 2);
      drawOrrery(ctx, clockSize, clockSize, t, { bg: false, cheap: true });
      ctx.restore();

      objs.filter((o) => o.z >= 0).sort((m, n) => m.z - n.z)
        .forEach((o) => this.drawPlanet(ctx, o, cx, cy, A, B));

      /* 星尘（近侧） */
      this.drawBelt(ctx, cx, cy, A, B, t, true);

      /* 同步 DOM 按钮 */
      objs.forEach((o) => {
        const el = o.p.el;
        if (!el) return;
        el.style.transform = `translate(-50%, -50%) translate(${(o.x - cx).toFixed(1)}px, ${(o.y - cy).toFixed(1)}px)`;
        el.style.zIndex = String(3 + Math.round(o.z * 2));
      });
    }

    drawBelt(ctx, cx, cy, A, B, t, front) {
      this.belt.forEach((b) => {
        const ang = b.ang + t * b.speed;
        const z = Math.sin(ang);
        if ((z >= 0) !== front) return;
        const pts = this.orbit(ang, A * b.rad, B * b.rad, cx, cy);
        const depth = (z + 1) / 2;
        const size = b.size * (0.65 + 0.65 * depth);
        const alpha = b.alpha * (0.42 + 0.58 * depth);
        ctx.beginPath();
        ctx.arc(pts[0], pts[1], size, 0, TAU);
        ctx.fillStyle = `rgba(${b.color}, ${alpha})`;
        ctx.fill();
      });
    }

    drawPlanet(ctx, o, cx, cy, A, B) {
      const { p, x, y, z } = o;
      const depth = (z + 1) / 2;
      const r = p.r * this.fit * (0.82 + 0.24 * depth);
      const alpha = 0.72 + 0.28 * depth;

      /* 拖尾 */
      for (let i = 0; i < 5; i++) {
        const a0 = o.ang - (i + 1) * 0.04;
        const a1 = o.ang - i * 0.04;
        const pa = this.orbit(a0, A, B, cx, cy);
        const pb = this.orbit(a1, A, B, cx, cy);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.strokeStyle = `rgba(${p.glow}, ${0.2 - i * 0.035})`;
        ctx.lineWidth = 3 - i * 0.35;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      /* 大气光晕 */
      const halo = ctx.createRadialGradient(x, y, r * 0.92, x, y, r * 1.75);
      halo.addColorStop(0, `rgba(${p.glow}, ${0.34 * alpha})`);
      halo.addColorStop(0.5, `rgba(${p.glow}, ${0.12 * alpha})`);
      halo.addColorStop(1, `rgba(${p.glow}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.75, 0, TAU);
      ctx.fillStyle = halo;
      ctx.fill();

      if (p.ring) this.drawRing(ctx, x, y, r, alpha, false);

      const sunAng = Math.atan2(cy - y, cx - x);
      const lx = Math.cos(sunAng);
      const ly = Math.sin(sunAng);

      /* 球体基底 */
      const g = ctx.createRadialGradient(x + lx * r * 0.55, y + ly * r * 0.55, r * 0.02, x, y, r * 1.04);
      g.addColorStop(0, p.lit);
      g.addColorStop(0.28, p.mid);
      g.addColorStop(0.66, p.dark);
      g.addColorStop(1, p.edge);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();

      /* 终结线：从背光侧压暗 */
      const shade = ctx.createRadialGradient(x - lx * r * 0.75, y - ly * r * 0.75, r * 0.1,
        x - lx * r * 0.18, y - ly * r * 0.18, r * 1.55);
      shade.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
      shade.addColorStop(0.42, 'rgba(0, 0, 0, 0.5)');
      shade.addColorStop(0.72, 'rgba(0, 0, 0, 0.16)');
      shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = shade;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      /* 边缘变暗，强化球感 */
      const limb = ctx.createRadialGradient(x, y, r * 0.58, x, y, r);
      limb.addColorStop(0, 'rgba(0, 0, 0, 0)');
      limb.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
      ctx.fillStyle = limb;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      /* 表面斑块 */
      p.patches.forEach((pt) => {
        const px = x + Math.cos(pt.a) * r * pt.d;
        const py = y + Math.sin(pt.a) * r * pt.d;
        const pr = r * pt.s;
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, `rgba(255, 255, 255, ${pt.al})`);
        pg.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      });

      /* 黑白行星的条带 */
      if (p.bands) {
        for (let i = 0; i < 8; i++) {
          const yy = y - r + (i + 0.5) * (r * 2 / 8);
          const hgt = r * 0.12;
          const curve = Math.sin((i / 8) * Math.PI) * r * 0.1;
          ctx.beginPath();
          ctx.ellipse(x, yy, r * 1.05, hgt, 0, 0, TAU);
          ctx.fillStyle = i % 2 ? 'rgba(0, 0, 0, 0.7)' : 'rgba(170, 190, 225, 0.10)';
          ctx.fill();
          void curve;
        }
      }

      /* 高光 */
      const spec = ctx.createRadialGradient(x + lx * r * 0.42, y + ly * r * 0.42, 0,
        x + lx * r * 0.42, y + ly * r * 0.42, r * 0.55);
      spec.addColorStop(0, `rgba(255, 255, 255, ${0.42 * alpha})`);
      spec.addColorStop(0.4, `rgba(255, 255, 255, ${0.12 * alpha})`);
      spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = spec;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      ctx.restore();

      /* 受光侧轮廓光 */
      ctx.beginPath();
      ctx.arc(x, y, r * 0.975, sunAng - 1.2, sunAng + 1.2);
      ctx.strokeStyle = `rgba(${p.glow}, ${0.6 * alpha})`;
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.stroke();

      if (p.ring) this.drawRing(ctx, x, y, r, alpha, true);

      ctx.globalAlpha = 1;
    }

    drawRing(ctx, x, y, r, alpha, front) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.34);
      ctx.scale(1, 0.3);
      ctx.beginPath();
      if (front) ctx.arc(0, 0, r * 1.72, 0, Math.PI);
      else ctx.arc(0, 0, r * 1.72, Math.PI, TAU);
      const g = ctx.createLinearGradient(-r * 1.7, 0, r * 1.7, 0);
      g.addColorStop(0, `rgba(240, 205, 138, ${0.06 * alpha})`);
      g.addColorStop(0.3, `rgba(248, 224, 176, ${0.6 * alpha})`);
      g.addColorStop(0.7, `rgba(240, 205, 138, ${0.55 * alpha})`);
      g.addColorStop(1, `rgba(200, 160, 90, ${0.08 * alpha})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ===== 5. 页面初始化 ===== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const nav = document.querySelector('.nav');
  const syncNav = () => nav && nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', syncNav, { passive: true });
  syncNav();

  const backdropEl = document.getElementById('backdrop');
  if (backdropEl) {
    const backdrop = new Backdrop(backdropEl);
    backdrop.start();
  }

  const orreryEl = document.getElementById('orrery');
  if (orreryEl) {
    let paraTick = false;
    window.addEventListener('scroll', () => {
      if (paraTick) return;
      paraTick = true;
      requestAnimationFrame(() => {
        orreryEl.style.setProperty('--py', `${clamp(window.scrollY * 0.07, 0, 40).toFixed(1)}px`);
        paraTick = false;
      });
    }, { passive: true });
  }

  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  let orrery = null;
  if (orreryEl) {
    orrery = new Orrery(orreryEl);
    orrery.start();
    observeSize(orreryEl, () => orrery.resize());
  }

  const solar = document.getElementById('solar');
  const galaxyCanvas = document.getElementById('galaxy-canvas');
  let galaxy = null;
  if (solar && galaxyCanvas) {
    PLANETS.forEach((p) => {
      p.el = solar.querySelector(`[data-planet="${p.key}"]`);
    });
    galaxy = new Galaxy(solar, galaxyCanvas, PLANETS);
    galaxy.start();
    galaxy.paused = true;
    observeSize(solar, () => galaxy.resize());
  }

  /* ===== 整屏翻页 ===== */
  const deck = document.getElementById('deck');
  const pages = Array.from(document.querySelectorAll('.page'));
  let pageIndex = 0;

  function setPage(n) {
    const next = clamp(n, 0, pages.length - 1);
    if (next === pageIndex) return;
    pageIndex = next;
    pages.forEach((p, i) => {
      p.classList.toggle('is-active', i === next);
      p.classList.toggle('is-past', i < next);
    });
    if (deck) deck.dataset.page = String(next);
    if (galaxy) galaxy.paused = next !== 1;
  }

  pages.forEach((p, i) => {
    p.classList.toggle('is-active', i === 0);
    p.classList.toggle('is-past', false);
  });

  document.querySelectorAll('[data-page]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      setPage(Number(el.dataset.page));
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') setPage(pageIndex + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPage(pageIndex - 1);
  });

  /* ===== 6. 弹窗 ===== */
  class PlanetFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.mode = 'notes';
      this.raf = 0;
      this.t = 0;
      this.w = 0;
      this.h = 0;
      this.notes = [];
      this.candles = [];
      this.offset = 0;
      this.resize = this.resize.bind(this);
      window.addEventListener('resize', () => { if (this.raf) this.resize(); });
    }

    resize() {
      if (!this.canvas) return;
      const w = this.canvas.offsetWidth;
      const h = this.canvas.offsetHeight;
      if (!w || !h) return;
      this.w = w;
      this.h = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.seed();
    }

    seed() {
      if (this.mode === 'notes') {
        const glyphs = ['♪', '♫', '♩', '♬', '𝄞', '♭'];
        this.notes = Array.from({ length: 26 }, () => ({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          vy: 0.22 + Math.random() * 0.55,
          size: 16 + Math.random() * 34,
          char: glyphs[Math.floor(Math.random() * glyphs.length)],
          alpha: 0.08 + Math.random() * 0.22,
          rot: (Math.random() - 0.5) * 0.6,
          ph: Math.random() * TAU
        }));
      } else if (this.mode === 'candles') {
        this.candles = [];
        let price = 0.5;
        for (let i = 0; i < 90; i++) {
          price = clamp(price + (Math.random() - 0.47) * 0.06, 0.08, 0.92);
          const open = price;
          const close = clamp(open + (Math.random() - 0.5) * 0.055, 0.06, 0.94);
          this.candles.push({ open, close });
          price = close;
        }
        this.offset = 0;
      }
    }

    nextCandle() {
      const last = this.candles[this.candles.length - 1] || { close: 0.5 };
      const open = last.close;
      const close = clamp(open + (Math.random() - 0.5) * 0.06, 0.06, 0.94);
      this.candles.push({ open, close });
      if (this.candles.length > 130) this.candles.shift();
    }

    start(mode) {
      if (!this.ctx) return;
      this.mode = mode;
      this.t = 0;
      this.resize();
      cancelAnimationFrame(this.raf);
      if (reduceMotion) { this.t = 4; this.draw(); return; }
      const step = (ts) => {
        this.t = ts * 0.001;
        this.draw();
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    stop() {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.mode === 'notes') this.drawNotes(ctx);
      else if (this.mode === 'candles') this.drawCandles(ctx);
      else this.drawDNA(ctx);
      this.drawVignette(ctx);
    }

    drawNotes(ctx) {
      const t = this.t;
      ctx.save();
      ctx.strokeStyle = 'rgba(220, 228, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < this.w; x += 46) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke();
      }
      for (let y = 0; y < this.h; y += 46) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke();
      }
      ctx.restore();

      this.notes.forEach((n) => {
        n.y -= n.vy;
        if (n.y < -40) { n.y = this.h + 40; n.x = Math.random() * this.w; }
        const x = n.x + Math.sin(t * 0.7 + n.ph) * 10;
        ctx.save();
        ctx.translate(x, n.y);
        ctx.rotate(n.rot + Math.sin(t * 0.6 + n.ph) * 0.14);
        ctx.globalAlpha = n.alpha;
        ctx.fillStyle = 'rgba(240, 244, 255, 0.95)';
        ctx.font = `${n.size}px "Segoe UI Symbol", "Noto Music", serif`;
        ctx.fillText(n.char, 0, 0);
        ctx.restore();
      });

      ctx.save();
      ctx.font = '12px "JetBrains Mono", Consolas, monospace';
      const glyphs = '0123456789ABCDEFΣπ∫';
      for (let i = 0; i < 10; i++) {
        ctx.globalAlpha = 0.05 + Math.random() * 0.14;
        ctx.fillStyle = Math.random() > 0.5 ? '#9fe8ff' : '#ffffff';
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)],
          Math.random() * this.w, Math.random() * this.h);
      }
      ctx.restore();
    }

    drawCandles(ctx) {
      const w = this.w, h = this.h;
      const step = 13, body = 8, padTop = 40, padBottom = 50;
      const plotH = h - padTop - padBottom;

      ctx.save();
      ctx.strokeStyle = 'rgba(242, 199, 106, 0.07)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const y = padTop + (plotH / 6) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();

      if (!reduceMotion) this.offset += 0.42;
      while (this.offset >= step) { this.offset -= step; this.nextCandle(); }

      const total = Math.floor(w / step) + 2;
      const start = Math.max(0, this.candles.length - total);
      const list = this.candles.slice(start);

      list.forEach((c, i) => {
        const x = w - (list.length - i) * step + this.offset + step;
        const up = c.close >= c.open;
        const yOpen = padTop + (1 - c.open) * plotH;
        const yClose = padTop + (1 - c.close) * plotH;
        const top = Math.min(yOpen, yClose);
        const height = Math.max(1.6, Math.abs(yClose - yOpen));
        const color = up ? 'rgba(120, 240, 200, 0.85)' : 'rgba(255, 130, 150, 0.85)';
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        const mid = (c.open + c.close) / 2;
        const yMid = padTop + (1 - mid) * plotH;
        const wick = 6 + Math.abs(c.close - c.open) * 120;
        ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(x + body / 2, yMid - wick); ctx.lineTo(x + body / 2, yMid + wick); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillRect(x, top, body, height);
      });

      ctx.save();
      ctx.beginPath();
      list.forEach((c, i) => {
        const x = w - (list.length - i) * step + this.offset + step + body / 2;
        const y = padTop + (1 - (c.open + c.close) / 2) * plotH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(255, 224, 150, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(242, 199, 106, 0.5)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }

    drawDNA(ctx) {
      const t = this.t, w = this.w, h = this.h;
      const cx = w * 0.72;
      const amp = Math.min(96, w * 0.1);
      const step = 15;
      const turns = 3.4;
      const phase = t * 0.5;

      const nodes = [];
      for (let y = -20; y < h + 20; y += step) {
        const p = (y / h) * TAU * turns + phase;
        nodes.push({
          y,
          x1: cx + Math.sin(p) * amp,
          x2: cx + Math.sin(p + Math.PI) * amp,
          d: (Math.cos(p) + 1) / 2
        });
      }

      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.moveTo(n.x1, n.y);
        ctx.lineTo(n.x2, n.y);
        ctx.strokeStyle = `rgba(157, 140, 255, ${0.08 + n.d * 0.24})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });

      [0, 1].forEach((s) => {
        ctx.beginPath();
        nodes.forEach((n, i) => {
          const x = s === 0 ? n.x1 : n.x2;
          i === 0 ? ctx.moveTo(x, n.y) : ctx.lineTo(x, n.y);
        });
        ctx.strokeStyle = s === 0 ? 'rgba(130, 225, 255, 0.5)' : 'rgba(160, 140, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.shadowColor = s === 0 ? 'rgba(130, 225, 255, 0.6)' : 'rgba(160, 140, 255, 0.6)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      nodes.forEach((n) => {
        const r = 1.2 + n.d * 2.4;
        ctx.beginPath(); ctx.arc(n.x1, n.y, r, 0, TAU);
        ctx.fillStyle = `rgba(180, 240, 255, ${0.25 + n.d * 0.65})`; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x2, n.y, r, 0, TAU);
        ctx.fillStyle = `rgba(190, 175, 255, ${0.25 + (1 - n.d) * 0.65})`; ctx.fill();
      });

      ctx.save();
      ctx.font = '11px "JetBrains Mono", Consolas, monospace';
      const glyphs = 'ATCG0123456789';
      for (let i = 0; i < 12; i++) {
        ctx.globalAlpha = 0.04 + Math.random() * 0.16;
        ctx.fillStyle = Math.random() > 0.5 ? '#8fd8ff' : '#b6a8ff';
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)],
          Math.random() * w * 0.6, Math.random() * h);
      }
      ctx.restore();
    }

    drawVignette(ctx) {
      const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.45, this.h * 0.2,
        this.w * 0.5, this.h * 0.5, this.h * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  const modal = document.getElementById('modal');
  const stage = document.getElementById('modal-stage');
  const content = document.getElementById('modal-content');
  const fxCanvas = document.getElementById('modal-fx');
  const fx = new PlanetFX(fxCanvas);
  let lastFocus = null;

  /* 弹窗内容滚动时，背景的 DNA / K 线跟着缓慢位移，制造视差 */
  if (content && fxCanvas) {
    let fxTick = false;
    content.addEventListener('scroll', () => {
      if (fxTick) return;
      fxTick = true;
      requestAnimationFrame(() => {
        const y = content.scrollTop;
        fxCanvas.style.transform = `translateY(${(-y * 0.16).toFixed(1)}px)`;
        fxTick = false;
      });
    }, { passive: true });
  }

  function openPlanet(key) {
    const tpl = document.getElementById(`tpl-${key}`);
    if (!tpl || !modal) return;

    lastFocus = document.activeElement;
    content.innerHTML = '';
    content.appendChild(tpl.content.cloneNode(true));
    content.scrollTop = 0;
    if (fxCanvas) fxCanvas.style.transform = 'translateY(0px)';
    stage.dataset.theme = key;

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (galaxy) galaxy.paused = true;

    const view = content.querySelector('.planet-view');
    fx.start(view ? view.dataset.mode : 'notes');

    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) window.setTimeout(() => closeBtn.focus({ preventScroll: true }), 140);
  }

  function closeModal() {
    if (!modal || !modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (galaxy) galaxy.paused = false;
    fx.stop();
    window.setTimeout(() => {
      if (!modal.classList.contains('open')) content.innerHTML = '';
    }, 420);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll('[data-planet]').forEach((btn) => {
    btn.addEventListener('click', () => openPlanet(btn.dataset.planet));
  });

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }
})();

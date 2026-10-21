/* =========================================================
   Origineer · 个人主页
   1. 工具
   2. 浑天仪时钟（Canvas 3D）
   3. 星图（Canvas）
   4. 行星详情弹窗 + 背景动画
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const TAU = Math.PI * 2;

  /* ===== 1. 工具 ===== */
  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
        { x: 0.22, y: 0.24, r: 0.62, c: '74, 58, 150', a: 0.30, sp: 0.014, ph: 0 },
        { x: 0.82, y: 0.58, r: 0.5, c: '16, 74, 96', a: 0.24, sp: 0.011, ph: 2.1 },
        { x: 0.55, y: 0.9, r: 0.46, c: '104, 66, 44', a: 0.2, sp: 0.017, ph: 4.2 }
      ];
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
      if (reduceMotion) this.render(2);
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        // 背景 30fps 足够，省电
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

      /* 星云 */
      this.neb.forEach((n) => {
        const x = w * n.x + Math.sin(t * n.sp + n.ph) * w * 0.015 + this.px * 12;
        const y = h * n.y + Math.cos(t * n.sp * 1.2 + n.ph) * h * 0.015 + this.py * 12;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * n.r);
        rg.addColorStop(0, `rgba(${n.c}, ${n.a * 0.9})`);
        rg.addColorStop(0.45, `rgba(${n.c}, ${n.a * 0.34})`);
        rg.addColorStop(1, `rgba(${n.c}, 0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });

      /* 星点（按视差分层） */
      this.stars.forEach((s) => {
        const a = s.a * (0.5 + 0.5 * Math.sin(t * s.sp + s.tw));
        const ox = this.px * s.d * 5;
        const oy = this.py * s.d * 5;
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, TAU);
        ctx.fillStyle = `rgba(238, 231, 214, ${Math.max(a, 0.04)})`;
        ctx.fill();
      });
    }
  }

  /* ===== 3. 浑天仪时钟 ===== */
  const ORRERY_CENTER = 0;
  const RINGS = [
    { r: 292, tx: 1.29, tz: 0.0, speed: 0.22, beads: [0.4, 3.1] },
    { r: 244, tx: 1.06, tz: 0.5, speed: -0.17, beads: [1.6, 4.6] }
  ];

  class Orrery {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.raf = 0;
      this.px = 0;
      this.py = 0;
      this.tx = 0;
      this.ty = 0;
      this.resize();
      this.bindPointer();
    }

    bindPointer() {
      window.addEventListener('pointermove', (e) => {
        this.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        this.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }

    resize() {
      const { ctx, w, h } = setupCanvas(this.canvas);
      this.ctx = ctx;
      this.w = w;
      this.h = h;
      if (reduceMotion) this.render(2.4);
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        this.render(now / 1000);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    /* 圆环上的点 → 世界坐标 */
    ringPoint(r, th, tiltX, tiltZ) {
      const x0 = Math.cos(th) * r;
      const y0 = Math.sin(th) * r;
      const z0 = 0;
      const c1 = Math.cos(tiltX), s1 = Math.sin(tiltX);
      const y1 = y0 * c1 - z0 * s1;
      const z1 = y0 * s1 + z0 * c1;
      const c2 = Math.cos(tiltZ), s2 = Math.sin(tiltZ);
      const x2 = x0 * c2 - y1 * s2;
      const y2 = x0 * s2 + y1 * c2;
      return [x2, y2, z1];
    }

    /* 整体旋转 + 透视 */
    project(p, cx, cy, zoom, ax, ay) {
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

    render(t) {
      const { ctx, w, h } = this;
      if (!w || !h) return;

      this.px += (this.tx - this.px) * 0.04;
      this.py += (this.ty - this.py) * 0.04;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2 + this.px * 16;
      const cy = h / 2 + Math.sin(t * 0.45) * 5 + this.py * 16;
      const zoom = Math.min(w, h) / 780;
      const ax = 0.36 + Math.sin(t * 0.16) * 0.04 + this.py * 0.05;
      const ay = t * 0.11 + this.px * 0.12;

      /* 环境光 */
      const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.min(w, h) * 0.62);
      bg.addColorStop(0, 'rgba(214, 178, 112, 0.16)');
      bg.addColorStop(0.42, 'rgba(140, 108, 60, 0.06)');
      bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const P = (p) => this.project(p, cx, cy, zoom, ax, ay);

      /* --- 背面的环 --- */
      this.strokeRing(ctx, P, t, false);

      /* --- 表盘 --- */
      this.drawDial(ctx, cx, cy, zoom, ax, t);

      /* --- 正面的环 --- */
      this.strokeRing(ctx, P, t, true);

      /* --- 光尘 --- */
      this.drawDust(ctx, cx, cy, w, h, t);
    }

    strokeRing(ctx, P, t, front) {
      RINGS.forEach((ring, idx) => {
        const spin = t * ring.speed + idx;
        ctx.beginPath();
        let pen = false;
        const N = 180;
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * TAU;
          const p = this.ringPoint(ring.r, th, ring.tx, ring.tz + spin);
          const pts = P(p);
          const isFront = p[2] > 0;
          if (isFront !== front) { pen = false; continue; }
          if (!pen) { ctx.moveTo(pts[0], pts[1]); pen = true; }
          else ctx.lineTo(pts[0], pts[1]);
        }
        if (front) {
          ctx.strokeStyle = 'rgba(240, 219, 181, 0.78)';
          ctx.lineWidth = 1.5;
          ctx.shadowColor = 'rgba(214, 178, 112, 0.55)';
          ctx.shadowBlur = 9;
        } else {
          ctx.strokeStyle = 'rgba(196, 163, 104, 0.20)';
          ctx.lineWidth = 1.1;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* 环上的黄铜珠 */
        ring.beads.forEach((offset) => {
          const th = t * ring.speed * 1.4 + offset;
          const p = this.ringPoint(ring.r, th, ring.tx, ring.tz + spin);
          if ((p[2] > 0) !== front) return;
          const pts = P(p);
          const r = 4.6 * pts[2] * (front ? 1 : 0.75);
          const g = ctx.createRadialGradient(pts[0] - r * 0.3, pts[1] - r * 0.3, 0.4, pts[0], pts[1], r);
          g.addColorStop(0, 'rgba(255, 246, 220, 0.95)');
          g.addColorStop(0.55, 'rgba(230, 199, 141, 0.9)');
          g.addColorStop(1, 'rgba(150, 114, 60, 0.15)');
          ctx.beginPath();
          ctx.arc(pts[0], pts[1], r, 0, TAU);
          ctx.fillStyle = g;
          ctx.shadowColor = 'rgba(240, 200, 130, 0.8)';
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      });
    }

    drawDial(ctx, cx, cy, zoom, ax, t) {
      const tiltX = 0.30 + Math.sin(t * 0.4) * 0.015;
      const P = (p) => this.project(p, cx, cy, zoom, ax, 0);

      const dp = (r, th) => {
        const x0 = Math.cos(th) * r;
        const y0 = Math.sin(th) * r;
        const c = Math.cos(tiltX), s = Math.sin(tiltX);
        return [x0, y0 * c, y0 * s];
      };

      const R = 205;

      /* 盘面 */
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P(dp(R, (i / 120) * TAU));
        i === 0 ? ctx.moveTo(pts[0], pts[1]) : ctx.lineTo(pts[0], pts[1]);
      }
      ctx.closePath();
      const fill = ctx.createRadialGradient(cx - R * zoom * 0.35, cy - R * zoom * 0.4, R * zoom * 0.1,
        cx, cy, R * zoom * 1.08);
      fill.addColorStop(0, 'rgba(38, 52, 84, 0.97)');
      fill.addColorStop(0.5, 'rgba(17, 24, 40, 0.98)');
      fill.addColorStop(1, 'rgba(6, 8, 14, 0.99)');
      ctx.fillStyle = fill;
      ctx.fill();

      /* 盘面高光：像一层玻璃 */
      const sheen = ctx.createLinearGradient(cx - R * zoom, cy - R * zoom, cx + R * zoom * 0.6, cy + R * zoom);
      sheen.addColorStop(0, 'rgba(255, 245, 220, 0.07)');
      sheen.addColorStop(0.4, 'rgba(255, 245, 220, 0.015)');
      sheen.addColorStop(1, 'rgba(255, 245, 220, 0)');
      ctx.fillStyle = sheen;
      ctx.fill();

      /* 内圈 */
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P(dp(R * 0.62, (i / 120) * TAU));
        i === 0 ? ctx.moveTo(pts[0], pts[1]) : ctx.lineTo(pts[0], pts[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(232, 208, 160, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      /* 外沿 */
      ctx.strokeStyle = 'rgba(232, 208, 160, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const pts = P(dp(R * 0.94, (i / 120) * TAU));
        i === 0 ? ctx.moveTo(pts[0], pts[1]) : ctx.lineTo(pts[0], pts[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(232, 208, 160, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      /* 刻度 */
      for (let i = 0; i < 60; i++) {
        const th = (i / 60) * TAU - Math.PI / 2;
        const major = i % 5 === 0;
        const a = P(dp(R * (major ? 0.80 : 0.86), th));
        const b = P(dp(R * 0.9, th));
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = major ? 'rgba(240, 222, 186, 0.72)' : 'rgba(240, 222, 186, 0.28)';
        ctx.lineWidth = major ? 1.6 : 0.9;
        ctx.stroke();
      }

      /* 罗马数字 */
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(238, 226, 202, 0.62)';
      const marks = [['XII', 0], ['III', 0.25], ['VI', 0.5], ['IX', 0.75]];
      marks.forEach(([label, frac]) => {
        const th = frac * TAU - Math.PI / 2;
        const pts = P(dp(R * 0.66, th));
        ctx.font = `${Math.round(21 * pts[2] * Math.min(this.w, this.h) / 780 * 1.6)}px Georgia, "Times New Roman", serif`;
        ctx.fillText(label, pts[0], pts[1]);
      });

      /* 指针：真实时间 */
      const now = new Date();
      const sec = now.getSeconds() + now.getMilliseconds() / 1000;
      const min = now.getMinutes() + sec / 60;
      const hour = (now.getHours() % 12) + min / 60;

      const center = P([0, 0, 0]);
      const hand = (frac, len, width, color, alpha) => {
        const th = frac * TAU - Math.PI / 2;
        const tip = P(dp(len, th));
        const tail = P(dp(-len * 0.12, th));
        ctx.beginPath();
        ctx.moveTo(tail[0], tail[1]);
        ctx.lineTo(tip[0], tip[1]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width * zoom * 1.6;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255, 232, 190, 0.45)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      };

      hand(hour / 12, R * 0.5, 2.1, '#f5e6c6', 0.95);
      hand(min / 60, R * 0.74, 1.5, '#f7ecd4', 0.95);
      hand(sec / 60, R * 0.82, 0.7, '#e6a887', 0.9);

      /* 中心轴 */
      const capR = 5.2 * zoom * 1.6;
      const cap = ctx.createRadialGradient(center[0] - capR * 0.4, center[1] - capR * 0.4, 0.5, center[0], center[1], capR);
      cap.addColorStop(0, '#fff6dc');
      cap.addColorStop(0.6, '#c9a86a');
      cap.addColorStop(1, '#4a3517');
      ctx.beginPath();
      ctx.arc(center[0], center[1], capR, 0, TAU);
      ctx.fillStyle = cap;
      ctx.fill();
    }

    drawDust(ctx, cx, cy, w, h, t) {
      if (!this.dust) {
        this.dust = Array.from({ length: 26 }, () => ({
          a: Math.random() * TAU,
          r: 0.25 + Math.random() * 0.75,
          s: 0.15 + Math.random() * 0.5,
          o: Math.random() * TAU
        }));
      }
      this.dust.forEach((d) => {
        const ang = d.a + t * d.s * 0.12;
        const rad = d.r * Math.min(w, h) * 0.48;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad * 0.62;
        const tw = 0.35 + 0.35 * Math.sin(t * 0.9 + d.o);
        ctx.beginPath();
        ctx.arc(x, y, 1.1 + d.r * 1.2, 0, TAU);
        ctx.fillStyle = `rgba(236, 219, 186, ${0.10 + tw * 0.18})`;
        ctx.fill();
      });
    }
  }

  /* ===== 3. 星图 ===== */
  const PLANET_DATA = [
    {
      key: 'data', a: 0.27, b: 0.20, period: 38, phase: 4.6, r: 46,
      lit: '#efe9ff', mid: '#9a86ff', dark: '#4a30b8', edge: '#1a0f45', glow: '150, 130, 255'
    },
    {
      key: 'self', a: 0.35, b: 0.24, period: 52, phase: 0.7, r: 58, bands: true,
      lit: '#ffffff', mid: '#e6e4dc', dark: '#6b6b6b', edge: '#141416', glow: '226, 230, 240'
    },
    {
      key: 'finance', a: 0.44, b: 0.28, period: 68, phase: 2.8, r: 44, ring: true,
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
      this.raf = 0;
      this.paused = false;
      this.resize();
      this.seed();
    }

    resize() {
      const { ctx, w, h } = setupCanvas(this.canvas);
      this.ctx = ctx;
      this.w = w;
      this.h = h;
      this.fit = clamp(w / 1080, 0.62, 1.1);
      this.seed();
      if (reduceMotion) this.render(3);
    }

    seed() {
      const { w, h } = this;
      const count = Math.max(90, Math.round((w * h) / 7000));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.25 + 0.25,
        a: Math.random() * 0.5 + 0.18,
        tw: Math.random() * TAU,
        sp: 0.4 + Math.random() * 1.6
      }));
      this.nebula = [
        { x: 0.26, y: 0.32, r: 0.44, c: '86, 70, 170', a: 0.13, sp: 0.05, ph: 0 },
        { x: 0.76, y: 0.62, r: 0.4, c: '20, 90, 110', a: 0.1, sp: 0.04, ph: 1.8 },
        { x: 0.52, y: 0.16, r: 0.34, c: '150, 110, 70', a: 0.08, sp: 0.06, ph: 3.4 }
      ];
    }

    start() {
      if (reduceMotion) return;
      const loop = (now) => {
        if (!this.paused) this.render(now / 1000);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    render(t) {
      const { ctx, w, h } = this;
      if (!w || !h) return;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      /* 星云 */
      this.nebula.forEach((n) => {
        const x = w * n.x + Math.sin(t * n.sp + n.ph) * w * 0.02;
        const y = h * n.y + Math.cos(t * n.sp * 1.3 + n.ph) * h * 0.02;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * n.r);
        rg.addColorStop(0, `rgba(${n.c}, ${n.a})`);
        rg.addColorStop(0.55, `rgba(${n.c}, ${n.a * 0.35})`);
        rg.addColorStop(1, `rgba(${n.c}, 0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      });

      /* 星点 */
      this.stars.forEach((s) => {
        const a = s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fillStyle = `rgba(236, 228, 210, ${Math.max(a, 0.05)})`;
        ctx.fill();
      });

      /* 轨道 */
      this.planets.forEach((p) => this.drawOrbit(ctx, p, cx, cy));

      /* 位置 */
      const objs = this.planets.map((p) => {
        const ang = p.phase + t * (TAU / p.period);
        const x = cx + Math.cos(ang) * p.a * w;
        const y = cy + Math.sin(ang) * p.b * h;
        return { p, ang, x, y, z: Math.sin(ang) };
      });

      /* 恒星后面 */
      objs.filter((o) => o.z < 0).sort((m, n) => m.z - n.z)
        .forEach((o) => this.drawPlanet(ctx, o, cx, cy));

      /* 恒星 */
      this.drawStar(ctx, cx, cy, t);

      /* 恒星前面 */
      objs.filter((o) => o.z >= 0).sort((m, n) => m.z - n.z)
        .forEach((o) => this.drawPlanet(ctx, o, cx, cy));

      /* 同步按钮位置 */
      objs.forEach((o) => {
        const el = o.p.el;
        if (!el) return;
        el.style.transform = `translate(-50%, -50%) translate(${(o.x - cx).toFixed(1)}px, ${(o.y - cy).toFixed(1)}px)`;
        el.style.zIndex = String(3 + Math.round(o.z * 2));
      });
    }

    drawOrbit(ctx, p, cx, cy) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, p.a * this.w, p.b * this.h, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(201, 168, 106, 0.13)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 9]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawStar(ctx, cx, cy, t) {
      const fit = this.fit;
      const R = 44 * fit;

      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 5);
      halo.addColorStop(0, 'rgba(255, 226, 170, 0.42)');
      halo.addColorStop(0.2, 'rgba(255, 190, 110, 0.2)');
      halo.addColorStop(0.5, 'rgba(240, 150, 60, 0.07)');
      halo.addColorStop(1, 'rgba(240, 150, 60, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 5, 0, TAU);
      ctx.fill();

      /* 光芒 */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.05);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        const len = R * (2.4 + Math.sin(i * 1.7 + t * 0.6) * 0.5);
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, 'rgba(255, 224, 170, 0.32)');
        g.addColorStop(1, 'rgba(255, 200, 120, 0)');
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();

      /* 核心 */
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      core.addColorStop(0, '#fffdf6');
      core.addColorStop(0.32, '#fff0c8');
      core.addColorStop(0.62, '#ffcf78');
      core.addColorStop(0.85, '#f09a34');
      core.addColorStop(1, 'rgba(200, 110, 30, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fillStyle = core;
      ctx.fill();

      /* 十字光斑 */
      ctx.save();
      ctx.translate(cx, cy);
      const flare = ctx.createLinearGradient(-R * 6, 0, R * 6, 0);
      flare.addColorStop(0, 'rgba(255, 230, 180, 0)');
      flare.addColorStop(0.5, 'rgba(255, 240, 205, 0.35)');
      flare.addColorStop(1, 'rgba(255, 230, 180, 0)');
      ctx.fillStyle = flare;
      ctx.fillRect(-R * 6, -0.8, R * 12, 1.6);
      ctx.rotate(Math.PI / 2);
      const flare2 = ctx.createLinearGradient(-R * 3, 0, R * 3, 0);
      flare2.addColorStop(0, 'rgba(255, 230, 180, 0)');
      flare2.addColorStop(0.5, 'rgba(255, 240, 205, 0.22)');
      flare2.addColorStop(1, 'rgba(255, 230, 180, 0)');
      ctx.fillStyle = flare2;
      ctx.fillRect(-R * 3, -0.7, R * 6, 1.4);
      ctx.restore();
    }

    drawPlanet(ctx, o, cx, cy) {
      const { p, x, y, z } = o;
      const depth = (z + 1) / 2;                 // 0 远 → 1 近
      const r = p.r * this.fit * (0.84 + 0.16 * depth);
      const alpha = 0.72 + 0.28 * depth;

      /* 拖尾 */
      const trailN = 3;
      for (let i = 0; i < trailN; i++) {
        const a0 = o.ang - (i + 1) * 0.05;
        const a1 = o.ang - i * 0.05;
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.a * this.w, p.b * this.h, 0, a0, a1);
        ctx.strokeStyle = `rgba(${p.glow}, ${0.16 - i * 0.045})`;
        ctx.lineWidth = 2.4 - i * 0.6;
        ctx.stroke();
      }

      /* 大气 */
      const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.6);
      halo.addColorStop(0, `rgba(${p.glow}, ${0.3 * alpha})`);
      halo.addColorStop(0.55, `rgba(${p.glow}, ${0.1 * alpha})`);
      halo.addColorStop(1, `rgba(${p.glow}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, TAU);
      ctx.fillStyle = halo;
      ctx.fill();

      /* 光环（后半） */
      if (p.ring) this.drawRing(ctx, x, y, r, alpha, false);

      /* 球体 */
      const sunAng = Math.atan2(cy - y, cx - x);
      const lx = Math.cos(sunAng);
      const ly = Math.sin(sunAng);

      const g = ctx.createRadialGradient(x + lx * r * 0.42, y + ly * r * 0.42, r * 0.04, x, y, r * 1.02);
      g.addColorStop(0, p.lit);
      g.addColorStop(0.36, p.mid);
      g.addColorStop(0.72, p.dark);
      g.addColorStop(1, p.edge);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();

      /* 暗面 */
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.clip();
      const sh = ctx.createRadialGradient(x - lx * r * 0.55, y - ly * r * 0.55, r * 0.05,
        x - lx * r * 0.1, y - ly * r * 0.1, r * 1.3);
      sh.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
      sh.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
      sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sh;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);

      /* 条纹 */
      if (p.bands) {
        for (let i = 0; i < 7; i++) {
          const yy = y - r + (i + 0.5) * (r * 2 / 7);
          const hgt = r * 0.13;
          ctx.fillStyle = i % 2 ? 'rgba(10, 10, 12, 0.55)' : 'rgba(255, 255, 255, 0.10)';
          ctx.fillRect(x - r, yy, r * 2, hgt);
        }
      }
      ctx.restore();

      /* 边缘反光 */
      ctx.beginPath();
      ctx.arc(x, y, r * 0.985, 0, TAU);
      ctx.strokeStyle = `rgba(${p.glow}, ${0.42 * alpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      /* 光环（前半） */
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
      g.addColorStop(0.3, `rgba(248, 224, 176, ${0.55 * alpha})`);
      g.addColorStop(0.7, `rgba(240, 205, 138, ${0.5 * alpha})`);
      g.addColorStop(1, `rgba(200, 160, 90, ${0.08 * alpha})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 页面初始化 */
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

  /* 首屏视差：钟比文字走得慢一点 */
  const orreryEl = document.getElementById('orrery');
  if (orreryEl) {
    let paraTick = false;
    const parallax = () => {
      const y = clamp(window.scrollY * 0.07, 0, 40);
      orreryEl.style.setProperty('--py', `${y.toFixed(1)}px`);
      paraTick = false;
    };
    window.addEventListener('scroll', () => {
      if (paraTick) return;
      paraTick = true;
      requestAnimationFrame(parallax);
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
    PLANET_DATA.forEach((p) => {
      p.el = solar.querySelector(`[data-planet="${p.key}"]`);
    });
    galaxy = new Galaxy(solar, galaxyCanvas, PLANET_DATA);
    galaxy.start();
    observeSize(solar, () => galaxy.resize());
  }

  /* ===== 4. 弹窗 ===== */
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
  const fx = new PlanetFX(document.getElementById('modal-fx'));
  let lastFocus = null;

  function openPlanet(key) {
    const tpl = document.getElementById(`tpl-${key}`);
    if (!tpl || !modal) return;

    lastFocus = document.activeElement;
    content.innerHTML = '';
    content.appendChild(tpl.content.cloneNode(true));
    content.scrollTop = 0;
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

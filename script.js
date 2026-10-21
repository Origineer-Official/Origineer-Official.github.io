/* =========================================================
   Origineer · 个人主页脚本
   1. 通用交互
   2. 星系：星尘 / 轨道 / 行星公转
   3. 行星详情弹窗
   4. 弹窗背景动画（音符 / K 线 / DNA）
   ========================================================= */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== 1. 通用交互 ===== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const nav = document.querySelector('.nav');
  let navTick = false;
  const syncNav = () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (navTick) return;
      navTick = true;
      requestAnimationFrame(() => {
        syncNav();
        navTick = false;
      });
    },
    { passive: true }
  );
  syncNav();

  // 作品卡片跟随鼠标的光晕
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });

  /* ===== 2. 星系 ===== */
  const solar = document.getElementById('solar');
  const starsCv = document.getElementById('stars');

  const PLANETS = [
    // a、b 同时递增，保证三条轨道彼此嵌套、不会相交；b 的下限保证行星不会擦过恒星
    { key: 'data', el: document.querySelector('[data-planet="data"]'), a: 0.27, b: 0.20, period: 38, phase: 4.6 },
    { key: 'self', el: document.querySelector('[data-planet="self"]'), a: 0.35, b: 0.24, period: 52, phase: 0.7 },
    { key: 'finance', el: document.querySelector('[data-planet="finance"]'), a: 0.44, b: 0.28, period: 68, phase: 2.8 }
  ];

  let starCtx = null;
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0;
  let stars = [];
  let galaxyRaf = 0;
  let galaxyPaused = false;

  function seedStars() {
    const count = Math.max(70, Math.round((W * H) / 8200));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.3 + 0.25,
      a: Math.random() * 0.55 + 0.12,
      tw: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 1.6
    }));
  }

  function sizeGalaxy() {
    if (!solar || !starsCv) return;
    const rect = solar.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    starsCv.width = Math.max(1, Math.round(W * DPR));
    starsCv.height = Math.max(1, Math.round(H * DPR));
    starCtx = starsCv.getContext('2d');
    starCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2;
    cy = H / 2;
    seedStars();
  }

  function drawOrbits() {
    PLANETS.forEach((p) => {
      // 外层柔光
      starCtx.beginPath();
      starCtx.ellipse(cx, cy, p.a * W, p.b * H, 0, 0, Math.PI * 2);
      starCtx.strokeStyle = 'rgba(201, 168, 106, 0.05)';
      starCtx.lineWidth = 6;
      starCtx.stroke();

      // 内层细线
      starCtx.beginPath();
      starCtx.ellipse(cx, cy, p.a * W, p.b * H, 0, 0, Math.PI * 2);
      starCtx.strokeStyle = 'rgba(201, 168, 106, 0.2)';
      starCtx.lineWidth = 0.9;
      starCtx.setLineDash([2, 9]);
      starCtx.stroke();
      starCtx.setLineDash([]);
    });
  }

  function drawStars(t) {
    if (!starCtx) return;
    starCtx.clearRect(0, 0, W, H);
    drawOrbits();
    stars.forEach((s) => {
      const alpha = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 * s.sp + s.tw));
      starCtx.beginPath();
      starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      starCtx.fillStyle = `rgba(235, 226, 205, ${Math.max(alpha, 0.04)})`;
      starCtx.fill();
    });
  }

  function layoutPlanets(t) {
    // 行星不能随容器无限缩小：小屏保底 0.75 倍，大屏上限 1.12 倍
    const fit = Math.max(0.75, Math.min(W / 1000, 1.12));
    PLANETS.forEach((p) => {
      if (!p.el) return;
      const angle = p.phase + (t / 1000) * ((Math.PI * 2) / p.period);
      const x = Math.cos(angle) * p.a * W;
      const y = Math.sin(angle) * p.b * H;
      const depth = Math.sin(angle);
      const scale = (0.8 + 0.2 * ((depth + 1) / 2)) * fit;
      p.el.style.transform =
        `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      // 标签反向缩放，抵消行星的 scale，字号在任何屏幕都保持稳定
      p.el.style.setProperty('--inv', (1 / scale).toFixed(3));
      p.el.style.zIndex = depth > 0 ? '5' : '2';
      p.el.style.opacity = depth > 0 ? '1' : '0.82';
    });
  }

  function galaxyLoop(now) {
    if (!galaxyPaused) {
      drawStars(now);
      layoutPlanets(now);
    }
    galaxyRaf = requestAnimationFrame(galaxyLoop);
  }

  if (solar && starsCv) {
    sizeGalaxy();
    if (reduceMotion) {
      drawStars(0);
      layoutPlanets(0);
    } else {
      galaxyRaf = requestAnimationFrame(galaxyLoop);
    }
    window.addEventListener('resize', () => {
      sizeGalaxy();
      if (reduceMotion) {
        drawStars(0);
        layoutPlanets(0);
      }
    });
  }

  /* ===== 3 + 4. 弹窗与背景动画 ===== */
  class PlanetFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas ? canvas.getContext('2d') : null;
      this.mode = 'notes';
      this.raf = 0;
      this.t = 0;
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.notes = [];
      this.candles = [];
      this.offset = 0;
      this.resize = this.resize.bind(this);
      window.addEventListener('resize', () => {
        if (this.raf) this.resize();
      });
    }

    resize() {
      if (!this.canvas) return;
      // 用 offsetWidth/offsetHeight：不受弹窗缩放动画影响，避免画布分辨率偏低
      const w = this.canvas.offsetWidth;
      const h = this.canvas.offsetHeight;
      if (!w || !h) return;
      this.w = w;
      this.h = h;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(w * this.dpr));
      this.canvas.height = Math.max(1, Math.round(h * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
          ph: Math.random() * Math.PI * 2
        }));
      } else if (this.mode === 'candles') {
        this.candles = [];
        let price = 0.5;
        for (let i = 0; i < 90; i++) {
          price = Math.min(0.92, Math.max(0.08, price + (Math.random() - 0.47) * 0.06));
          const open = price;
          const close = Math.min(0.94, Math.max(0.06, open + (Math.random() - 0.5) * 0.055));
          this.candles.push({ open, close });
          price = close;
        }
        this.offset = 0;
      }
    }

    nextCandle() {
      const last = this.candles[this.candles.length - 1] || { close: 0.5 };
      const open = last.close;
      const close = Math.min(0.94, Math.max(0.06, open + (Math.random() - 0.5) * 0.06));
      this.candles.push({ open, close });
      if (this.candles.length > 130) this.candles.shift();
    }

    start(mode) {
      if (!this.ctx) return;
      this.mode = mode;
      this.t = 0;
      this.resize();
      cancelAnimationFrame(this.raf);
      if (reduceMotion) {
        this.t = 4;
        this.draw();
        return;
      }
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

    /* --- 音符 + 数据闪烁 --- */
    drawNotes(ctx) {
      const t = this.t;
      // 数据网格
      ctx.save();
      ctx.strokeStyle = 'rgba(220, 228, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < this.w; x += 46) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.h);
        ctx.stroke();
      }
      for (let y = 0; y < this.h; y += 46) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.w, y);
        ctx.stroke();
      }
      ctx.restore();

      // 音符
      this.notes.forEach((n) => {
        n.y -= n.vy;
        if (n.y < -40) {
          n.y = this.h + 40;
          n.x = Math.random() * this.w;
        }
        const x = n.x + Math.sin(t * 0.7 + n.ph) * 10;
        const y = n.y;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(n.rot + Math.sin(t * 0.6 + n.ph) * 0.14);
        ctx.globalAlpha = n.alpha;
        ctx.fillStyle = 'rgba(240, 244, 255, 0.95)';
        ctx.font = `${n.size}px "Segoe UI Symbol", "Noto Music", serif`;
        ctx.fillText(n.char, 0, 0);
        ctx.restore();
      });

      // 数据闪烁
      ctx.save();
      ctx.font = '12px "JetBrains Mono", Consolas, monospace';
      const glyphs = '0123456789ABCDEFΣπ∫';
      for (let i = 0; i < 10; i++) {
        const gx = Math.random() * this.w;
        const gy = Math.random() * this.h;
        ctx.globalAlpha = 0.05 + Math.random() * 0.14;
        ctx.fillStyle = Math.random() > 0.5 ? '#9fe8ff' : '#ffffff';
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], gx, gy);
      }
      ctx.restore();
    }

    /* --- K 线 --- */
    drawCandles(ctx) {
      const t = this.t;
      const w = this.w;
      const h = this.h;
      const step = 13;
      const body = 8;
      const padTop = 40;
      const padBottom = 50;
      const plotH = h - padTop - padBottom;

      // 网格
      ctx.save();
      ctx.strokeStyle = 'rgba(242, 199, 106, 0.07)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const y = padTop + (plotH / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // 推进
      if (!reduceMotion) this.offset += 0.42;
      while (this.offset >= step) {
        this.offset -= step;
        this.nextCandle();
      }

      const total = Math.floor(w / step) + 2;
      const startIndex = Math.max(0, this.candles.length - total);
      const list = this.candles.slice(startIndex);

      ctx.save();
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
        ctx.lineWidth = 1;

        // 影线
        const mid = (c.open + c.close) / 2;
        const yMid = padTop + (1 - mid) * plotH;
        const wick = 6 + Math.abs(c.close - c.open) * 120;
        ctx.beginPath();
        ctx.moveTo(x + body / 2, yMid - wick);
        ctx.lineTo(x + body / 2, yMid + wick);
        ctx.globalAlpha = 0.55;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 实体
        ctx.fillRect(x, top, body, height);
      });
      ctx.restore();

      // 均线
      ctx.save();
      ctx.beginPath();
      list.forEach((c, i) => {
        const x = w - (list.length - i) * step + this.offset + step + body / 2;
        const y = padTop + (1 - (c.open + c.close) / 2) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(255, 224, 150, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(242, 199, 106, 0.5)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // 光点游走
      const px = w * (0.5 + 0.32 * Math.sin(t * 0.4));
      const py = h * (0.35 + 0.2 * Math.cos(t * 0.55));
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 160);
      grad.addColorStop(0, 'rgba(242, 199, 106, 0.16)');
      grad.addColorStop(1, 'rgba(242, 199, 106, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 160, py - 160, 320, 320);
    }

    /* --- DNA 双螺旋 + 数据闪烁 --- */
    drawDNA(ctx) {
      const t = this.t;
      const w = this.w;
      const h = this.h;
      const cx = w * 0.72;
      const amp = Math.min(96, w * 0.1);
      const step = 15;
      const turns = 3.4;
      const phase = t * 0.5;

      ctx.save();
      const nodes = [];
      for (let y = -20; y < h + 20; y += step) {
        const p = (y / h) * Math.PI * 2 * turns + phase;
        const x1 = cx + Math.sin(p) * amp;
        const x2 = cx + Math.sin(p + Math.PI) * amp;
        const depth = (Math.cos(p) + 1) / 2;
        nodes.push({ y, x1, x2, depth });
      }

      // 横档
      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.moveTo(n.x1, n.y);
        ctx.lineTo(n.x2, n.y);
        ctx.strokeStyle = `rgba(157, 140, 255, ${0.08 + n.depth * 0.24})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });

      // 两条主链
      [0, 1].forEach((strand) => {
        ctx.beginPath();
        nodes.forEach((n, i) => {
          const x = strand === 0 ? n.x1 : n.x2;
          if (i === 0) ctx.moveTo(x, n.y);
          else ctx.lineTo(x, n.y);
        });
        ctx.strokeStyle = strand === 0 ? 'rgba(130, 225, 255, 0.5)' : 'rgba(160, 140, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.shadowColor = strand === 0 ? 'rgba(130, 225, 255, 0.6)' : 'rgba(160, 140, 255, 0.6)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      // 碱基节点
      nodes.forEach((n) => {
        const r = 1.2 + n.depth * 2.4;
        ctx.beginPath();
        ctx.arc(n.x1, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 240, 255, ${0.25 + n.depth * 0.65})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x2, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(190, 175, 255, ${0.25 + (1 - n.depth) * 0.65})`;
        ctx.fill();
      });
      ctx.restore();

      // 数据闪烁
      ctx.save();
      ctx.font = '11px "JetBrains Mono", Consolas, monospace';
      const glyphs = 'ATCG0123456789';
      for (let i = 0; i < 12; i++) {
        ctx.globalAlpha = 0.04 + Math.random() * 0.16;
        ctx.fillStyle = Math.random() > 0.5 ? '#8fd8ff' : '#b6a8ff';
        ctx.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], Math.random() * w * 0.6, Math.random() * h);
      }
      ctx.restore();
    }

    drawVignette(ctx) {
      const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.45, this.h * 0.2, this.w * 0.5, this.h * 0.5, this.h * 0.95);
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
    galaxyPaused = true;

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
    galaxyPaused = false;
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

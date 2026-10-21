// ===== 页脚年份自动更新 =====
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ===== 滚动进入动画（IntersectionObserver）=====
// 核心原则：元素默认可见，只有在 JS 确认支持 IntersectionObserver 时才启用动画，
// 避免任何情况下内容"消失"。另设兜底定时器，1.5 秒后仍未触发的元素强制显示。
const revealTargets = document.querySelectorAll(
  '.section-title, .panel, .tl-item, .card, .hobby, .skill-group'
);

const supportsIO = 'IntersectionObserver' in window;

if (supportsIO) {
  revealTargets.forEach((el) => el.classList.add('reveal'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const siblings = Array.from(entry.target.parentElement.children);
        const i = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${Math.min(i, 5) * 70}ms`;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach((el) => observer.observe(el));

  // 兜底：页面加载 1.5 秒后，把所有还没显现的元素直接显示（例如打印、截图、旧浏览器）
  window.setTimeout(() => {
    revealTargets.forEach((el) => {
      if (!el.classList.contains('in')) el.classList.add('in');
    });
  }, 1500);
}

// ===== 作品卡片跟随鼠标的光晕 =====
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    card.style.setProperty('--my', `${e.clientY - rect.top}px`);
  });
});

// ===== 导航栏滚动时加深背景 =====
const nav = document.querySelector('.nav');
let ticking = false;

window.addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
      ticking = false;
    });
  },
  { passive: true }
);

// ===== 加载后触发一次，确保首屏已滚动时状态正确 =====
window.dispatchEvent(new Event('scroll'));

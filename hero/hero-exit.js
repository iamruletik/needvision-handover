/**
 * Hero exit — scroll-tied progress + lerp smoothing.
 *
 * Прогресс tl напрямую = позиция скролла в зоне 140vw → 200vw.
 * Не моментально: actualProgress лерпает к targetProgress с коэффициентом
 * SMOOTH — даёт scrub-эффект с инерцией.
 *
 * Скролл вниз → прогресс растёт → текст уезжает наверх.
 * Скролл вверх → прогресс падает → текст возвращается.
 * Никакого forward/reverse-стейта, никакого lock'а скролла.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("hero-exit.js: GSAP не загружен");
    return;
  }

  const selectors = [
    ".hero_planet-img",
    ".hero_label",
    ".hero_tag",
    ".hero_title1",
    ".hero_title2",
    ".hero_subtitle1",
    ".hero_subtitle2"
  ];

  const inners = [];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.removeAttribute("data-w-id");
      el.style.willChange = "transform, opacity";
      inners.push(el);
    });
  });

  document.querySelectorAll(
    ".hero_item-mask, .hero_subtitle-wrapper, .hero-top, .hero_tags-group"
  ).forEach(el => el.removeAttribute("data-w-id"));

  if (inners.length === 0) {
    console.error("[hero-exit] нет элементов — проверь классы в Webflow");
    return;
  }

  // Webflow IX2 любит восстанавливать data-w-id — повторно стрипаем.
  setTimeout(() => inners.forEach(el => el.removeAttribute("data-w-id")), 500);

  // Тимлайн как обычно, но paused и duration 1 — играем напрямую через
  // tl.progress(), значение duration здесь не влияет, прогресс [0..1].
  const tl = gsap.timeline({ paused: true });
  tl.to(inners, {
    yPercent: -110,
    y: "-13.89vw",
    opacity: 0,
    duration: 1,
    ease: "power3.inOut"
  });

  // Зона: 140vw → 200vw. На этой дистанции прогресс tl едет 0 → 1.
  const START_VW = 1.4;
  const END_VW = 2.0;

  // SMOOTH — коэффициент лерпа. 0.08 = мягкий scrub с инерцией.
  // Больше = резче, меньше = ленивее.
  const SMOOTH = 0.08;

  let targetProgress = 0;
  let actualProgress = 0;

  function getScroll() {
    if (window.lenis && typeof window.lenis.scroll === "number") {
      return window.lenis.scroll;
    }
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function tick() {
    const scroll = getScroll();
    const startPx = window.innerWidth * START_VW;
    const endPx = window.innerWidth * END_VW;
    const range = Math.max(1, endPx - startPx);

    targetProgress = Math.max(0, Math.min(1, (scroll - startPx) / range));

    // Lerp actualProgress → targetProgress
    actualProgress += (targetProgress - actualProgress) * SMOOTH;

    // Защита от микро-дрожания около крайних значений
    if (Math.abs(actualProgress - targetProgress) < 0.0005) {
      actualProgress = targetProgress;
    }

    tl.progress(actualProgress);

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
});

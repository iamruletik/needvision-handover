/**
 * Секция .partner:
 *   1) «Фонарик» за курсором — двигаем CSS-переменные --mouse-x / --mouse-y
 *      на .spotlight-overlay (радиальный градиент в CSS).
 *      GSAP power3.out 1.8s — фонарик ленится за курсором, не дёргается.
 *   2) Фейд .partner_bg-layer на выходе из кадра — когда секция почти
 *      ушла наверх, бэкграунд-слой становится прозрачным (scrub-привязка
 *      к скроллу).
 *   3) Parallax .bg-parallax-text — фоновый текст уезжает наверх в 2× медленнее
 *      скролла (positive translate y компенсирует scroll → ощущение
 *      «отставания»).
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("partner-spotlight.js: GSAP не загружен");
    return;
  }

  const partnerSection = document.querySelector('.partner');
  const spotlightOverlay = document.querySelector('.spotlight-overlay');
  if (!partnerSection || !spotlightOverlay) return;

  // ---- 1. Фонарик за курсором ----
  const FOLLOW_DURATION = 1.8;

  partnerSection.addEventListener('mousemove', (e) => {
    const rect = partnerSection.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    gsap.to(spotlightOverlay, {
      "--mouse-x": `${x}px`,
      "--mouse-y": `${y}px`,
      duration: FOLLOW_DURATION,
      ease: "power3.out",
      overwrite: "auto"
    });
  });

  // ---- 2. Фейд partner_bg-layer на выходе из кадра ----
  // Стартуем когда низ секции уже прошёл середину экрана (секция
  // больше чем наполовину ушла наверх), доводим до 0 к моменту когда
  // низ касается верха viewport (секция полностью ушла).
  const bgLayer = document.querySelector('.partner_bg-layer');
  if (bgLayer && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    bgLayer.removeAttribute('data-w-id');

    gsap.to(bgLayer, {
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: partnerSection,
        start: "bottom 60%",
        end: "bottom 15%",
        scrub: true
      }
    });
  }

  // ---- 3. Parallax bg-parallax-text ----
  // Текст-фон уезжает наверх в 2× медленнее скролла. Translate y
  // ПОЛОЖИТЕЛЬНЫЙ (text смещается ВНИЗ в документе как scroll растёт) —
  // в viewport это даёт ощущение «отставания» от обычного скролла:
  //   visible_y = (doc_y + translate_y) − scroll
  //   при translate_y = 0.5 × scroll: dvisible/dscroll = 0.5 − 1 = −0.5
  //   → элемент уезжает вверх со скоростью 0.5× = в 2 раза медленнее.
  // Скорость крутится через PARALLAX_RATIO (0.5 = 2×, 0.33 = 3× и т.д.).
  const bgText = document.querySelector('.bg-parallax-text');
  if (bgText && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    bgText.removeAttribute('data-w-id');

    // 0.05 = на 5% медленнее скролла (visible speed = 1 − 0.05 = 0.95×)
    const PARALLAX_RATIO = 0.05;

    gsap.to(bgText, {
      y: () => {
        const scrollRange = partnerSection.offsetHeight + window.innerHeight;
        return scrollRange * PARALLAX_RATIO;
      },
      ease: "none",
      scrollTrigger: {
        trigger: partnerSection,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        invalidateOnRefresh: true
      }
    });
  }
});

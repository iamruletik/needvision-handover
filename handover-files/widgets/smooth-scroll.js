/**
 * Lenis smooth scroll. Inertia вместо нативного wheel — главное что
 * меняет ощущение «резкости» сайта.
 *
 * Lenis крутится в общем gsap.ticker (один rAF на всё) и шлёт updates
 * в ScrollTrigger — иначе scrub-таймлайны отстают за scroll-position'ом.
 *
 * Глобально доступен как window.lenis — другие скрипты могут
 * остановить/возобновить скролл (например при открытом модалке).
 *
 * Якорные ссылки (a[href^="#"]) перехватываются и скроллятся через
 * lenis.scrollTo — иначе браузер делает мгновенный snap.
 */

(() => {
  // duration 2.5 + wheelMultiplier 0.6 — проверенные юзером значения.
  // duration 3.1 давал 'перебрасывает после паузы': Lenis после каждого
  // wheel-tick запускал tween на 3.1с, на паузе ещё тянул к target.
  const SCROLL_DURATION = 2.5;
  const WHEEL_MULTIPLIER = 0.6;
  const ANCHOR_DURATION = 1.4;
  const EXPO_OUT = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

  function alreadyHasLenis() {
    // Стороннее приложение (например встроенная 3D-сцена с Netlify)
    // может уже инициализировать свой Lenis. Признаки:
    //   1. html.lenis класс — Lenis сам его ставит при init;
    //   2. window.lenisVersion — ставится конструктором Lenis.
    // Два Lenis-инстанса на странице конфликтуют scroll-position
    // друг друга → ScrollTrigger ломается, scrub-анимации (bento,
    // stages) перестают работать.
    return document.documentElement.classList.contains("lenis")
        || typeof window.lenisVersion !== "undefined";
  }

  function boot() {
    // Browser native scroll-restoration ловит scroll-position при back/refresh
    // и восстанавливает её после load. Если страница содержит scroll-driven
    // анимации (3D-сцена со scroll-progress, sticky-секции с pin), это
    // вызывает 'прыжок вверх' через ~1 секунду после load — браузер думает
    // 'scroll = 0' пока DOM не догрузился, и потом resync'ит к старой позиции.
    // Manual режим — мы сами решаем где юзер при load (всегда сверху).
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    if (typeof Lenis === "undefined") {
      console.warn("smooth-scroll.js: Lenis не загружен — проверь CDN в footer-code");
      return;
    }

    // Дать стороннему Lenis (если он есть) шанс инициализироваться
    // первым. 50ms незаметно для юзера, но достаточно чтобы класс
    // .lenis появился на html.
    setTimeout(() => {
      if (alreadyHasLenis()) {
        console.log("smooth-scroll.js: внешний Lenis уже работает, свой не запускаем");
        return;
      }
      initLenis();
    }, 50);
  }

  function initLenis() {
    const lenis = new Lenis({
      duration: SCROLL_DURATION,
      easing: EXPO_OUT,
      direction: "vertical",
      gestureDirection: "vertical",
      smooth: true,
      smoothTouch: false,
      wheelMultiplier: WHEEL_MULTIPLIER
    });

    // Sync со ScrollTrigger — без этого scrub-таймлайны (stages,
    // nav compress, partner spotlight) задерживаются за scroll-position.
    if (typeof ScrollTrigger !== "undefined") {
      lenis.on("scroll", ScrollTrigger.update);
    }

    // Свой rAF, НЕ gsap.ticker. gsap.ticker по умолчанию засыпает
    // когда нет активных tween'ов → Lenis не получает rAF → tween
    // зависает на полпути → когда юзер снова скроллит, Lenis резко
    // догоняет к старому target → юзер видит 'перебрасывает после паузы'.
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    window.lenis = lenis;


    // Якорные ссылки — через lenis.scrollTo вместо браузерного snap
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      lenis.scrollTo(target, {
        duration: ANCHOR_DURATION,
        easing: EXPO_OUT
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/**
 * Generic fade-in для элементов с [data-smooth="true"]. Любой блок в
 * Webflow помечается этим атрибутом (Element Settings → Custom Attributes
 * → Name: data-smooth, Value: true) и плавно появляется при попадании
 * во вьюпорт: y 60 → 0, opacity 0 → 1, expo.out 1.2s.
 *
 * Элемент стартует невидимым через CSS (см. custom.css), чтобы не
 * мигал до того как JS отстреляет ScrollTrigger.
 */

(() => {
  const DURATION = 1.2;
  const START_Y = "4.17vw";   // 60px в 1440 = 4.17vw, скейлится
  const START_TRIGGER = "top 85%";

  function boot() {
    if (typeof gsap === "undefined") {
      console.warn("scroll-reveal.js: GSAP не загружен");
      return;
    }
    if (typeof ScrollTrigger === "undefined") {
      console.warn("scroll-reveal.js: ScrollTrigger не загружен");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const elements = document.querySelectorAll('[data-smooth="true"]');
    if (elements.length === 0) return;

    elements.forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: START_Y },
        {
          opacity: 1,
          y: 0,
          duration: DURATION,
          ease: "expo.out",
          scrollTrigger: {
            trigger: el,
            start: START_TRIGGER,
            toggleActions: "play none none none"
          }
        }
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

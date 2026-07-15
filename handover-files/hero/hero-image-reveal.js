/**
 * Hero-картинка раздвигается из узкой полоски в широкое окно — автоплей
 * один раз когда секция .hero-image появилась в кадре. Без привязки к
 * скроллу: гладкий ease отыгрывает сам.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("hero-image-reveal.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("hero-image-reveal.js: ScrollTrigger не загружен");
    return;
  }

  const heroImg = document.querySelector(".hero__img");
  const heroSection = document.querySelector(".hero-image");
  if (!heroImg || !heroSection) return;

  gsap.registerPlugin(ScrollTrigger);

  // Стартовое: тонкая полоска
  gsap.set(".hero__img", {
    width: "0.01vw",
    overflow: "hidden"
  });

  // Триггер привязан к .hero-image-wrapper (контейнер с самой
  // картинкой и подписями), не к .hero-image (которая 1400px высотой
  // и со внутренним padding-top:15vw — её центр оказывался намного
  // ниже физического центра картинки).
  // start "center center" — центр обёртки в центре viewport.
  // toggleActions "play none none none" — один раз, без реверса.
  const trigger = document.querySelector(".hero-image-wrapper") || heroSection;

  gsap.to(".hero__img", {
    width: "40vw",
    duration: 1.4,
    ease: "power2.out",
    scrollTrigger: {
      trigger: trigger,
      start: "center center",
      toggleActions: "play none none none"
    }
  });
});

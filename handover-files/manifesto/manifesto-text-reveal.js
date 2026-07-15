/**
 * Manifesto: строки каскадом поднимаются из размытия (blur 20 → 0).
 * Анимация один-в-один с logo-reveal (y=6.94vw, duration=1, blur=20px),
 * но триггер у каждой строки СВОЙ (на сам элемент) — единый ScrollTrigger
 * на .manifesto не работал из-за sticky-секций выше и Lenis-перерасчётов.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("manifesto-text-reveal.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("manifesto-text-reveal.js: ScrollTrigger не загружен");
    return;
  }

  const manifesto = document.querySelector(".manifesto");
  const texts = document.querySelectorAll(".man-anim__txt");
  if (!manifesto || texts.length === 0) return;

  gsap.registerPlugin(ScrollTrigger);

  // Webflow IX2 (data-w-id) перебивает наш opacity/transform — снимаем
  // со строк, масок (.manifesto_line-mask / .manifesto_p-mask) и обёртки.
  manifesto.removeAttribute("data-w-id");
  texts.forEach(t => {
    t.removeAttribute("data-w-id");
    const mask = t.closest(".manifesto_line-mask, .manifesto_p-mask");
    if (mask) mask.removeAttribute("data-w-id");
  });

  // Каждая строка — самостоятельный fromTo со своим триггером.
  // Параметры анимации (y/opacity/blur/duration/ease) скопированы
  // 1-в-1 с logo-reveal.js.
  // toggleActions "play none none none" — играем один раз при появлении,
  // обратный скролл не реверсит, повторного входа не запускает.
  texts.forEach(text => {
    gsap.fromTo(text,
      {
        y: "6.94vw",
        opacity: 0,
        filter: "blur(20px)"
      },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: text,
          start: "top bottom",
          toggleActions: "play none none none"
        }
      }
    );
  });
});

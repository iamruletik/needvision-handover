/**
 * Тексты в .section-logo каскадом поднимаются из размытия (blur 20 → 0).
 * Тот же эффект что в manifesto, но стартовый сдвиг побольше (y=100).
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("logo-reveal.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("logo-reveal.js: ScrollTrigger не загружен");
    return;
  }

  const logoRevealTexts = document.querySelectorAll('.logo-anim__txt');
  if (logoRevealTexts.length === 0) return;

  gsap.registerPlugin(ScrollTrigger);

  gsap.set(logoRevealTexts, {
    y: "6.94vw",
    opacity: 0,
    filter: "blur(20px)"
  });

  // toggleActions "play none none none" — играем один раз при появлении,
  // обратный скролл не реверсит, повторного входа не запускает.
  gsap.to(logoRevealTexts, {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    duration: 1,
    stagger: 0.2,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".section-logo",
      start: "top 95%",
      toggleActions: "play none none none"
    }
  });
});

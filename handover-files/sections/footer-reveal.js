/**
 * Footer reveal — простой scrub.
 * .footer-wrapper (стартует translateY(-100%)) едет до 0 по мере въезда .footer в кадр.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  const footer = document.querySelector(".footer");
  const wrapper = document.querySelector(".footer-wrapper");
  if (!footer || !wrapper) return;

  gsap.registerPlugin(ScrollTrigger);

  gsap.fromTo(wrapper,
    { yPercent: -100 },
    {
      yPercent: 0,
      ease: "none",
      scrollTrigger: {
        trigger: footer,
        start: "top bottom",
        end: "top top",
        scrub: true
      }
    }
  );
});

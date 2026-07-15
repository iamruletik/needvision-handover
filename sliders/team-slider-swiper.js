/**
 * Старая Swiper-версия слайдера команды. Боевая — sliders/team-slider.js
 * (без Swiper, с замером слотов). Подключать одну из двух, не обе.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Swiper === "undefined") {
    console.warn("team-slider-swiper.js: Swiper не загружен");
    return;
  }
  if (typeof gsap === "undefined") {
    console.warn("team-slider-swiper.js: GSAP не загружен");
    return;
  }

  const sliderEl = document.querySelector('.swiper');
  if (!sliderEl) return;

  const SLIDE_SPEED = 600;
  const SPACE_BETWEEN = 40;

  const teamSwiper = new Swiper('.swiper', {
    slidesPerView: 'auto',
    centeredSlides: true,
    spaceBetween: SPACE_BETWEEN,
    grabCursor: true,
    slideToClickedSlide: true,
    speed: SLIDE_SPEED,
    // navigation: {
    //   nextEl: '.team_nav-next',
    //   prevEl: '.team_nav-prev',
    // },
  });

  // Барабанная смена роли/цитаты при свайпе
  teamSwiper.on('slideChange', function () {
    const activeSlide = teamSwiper.slides[teamSwiper.activeIndex];

    const newRole = activeSlide.querySelector('.hidden-role')?.innerText || '';
    const newQuote = activeSlide.querySelector('.hidden-quote')?.innerText || '';

    const roleMonitor = document.querySelector('.team_role-title');
    const quoteMonitor = document.querySelector('.team_quote-text');

    const tl = gsap.timeline();

    tl.to([roleMonitor, quoteMonitor], {
      y: "-1.39vw",
      opacity: 0,
      duration: 0.3,
      ease: "power2.in"
    });

    // Подмена в невидимом состоянии
    tl.call(() => {
      if (roleMonitor) roleMonitor.innerText = newRole;
      if (quoteMonitor) quoteMonitor.innerText = newQuote;
    });

    tl.set([roleMonitor, quoteMonitor], { y: "1.39vw" });
    tl.to([roleMonitor, quoteMonitor], {
      y: 0,
      opacity: 1,
      duration: 0.4,
      ease: "power2.out"
    });
  });
});

/**
 * Бесшовные бегущие строки. Клонируем содержимое и крутим на -50%
 * собственной ширины — петля визуально без шва.
 *
 * Если элемент скрыт на DOMContentLoaded (свёрнутое меню height:0),
 * GSAP закэширует «-50% от нулевой ширины = 0» и анимация замрёт
 * даже после раскрытия. Поэтому через ResizeObserver ждём, когда
 * элемент получит реальную ширину, и только тогда стартуем.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("marquee.js: GSAP не загружен");
    return;
  }

  const marquees = document.querySelectorAll(".marquee-wrapper, .menu_marquee-wrapper");
  if (marquees.length === 0) return;

  // 30s на удвоенном контенте = та же скорость, что 15s на неудвоенном
  const LOOP_DURATION = 30;

  function startMarquee(marquee) {
    const originalContent = marquee.innerHTML;
    marquee.innerHTML = originalContent + originalContent;

    gsap.to(marquee, {
      xPercent: -50,
      repeat: -1,
      duration: LOOP_DURATION,
      ease: "none",
      force3D: true
    });
  }

  marquees.forEach(marquee => {
    if (marquee.offsetWidth > 0) {
      startMarquee(marquee);
      return;
    }

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(entries => {
        if (entries[0].contentRect.width > 0) {
          ro.disconnect();
          startMarquee(marquee);
        }
      });
      ro.observe(marquee);
    } else {
      startMarquee(marquee);
    }
  });
});

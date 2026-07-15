/**
 * Сетка лого: каждые 2–4 сек подменяет 3–4 случайные плитки на лого
 * из скрытого пула. Допускаются повторы — один лого может оказаться
 * сразу в нескольких слотах. Запрещён только «no-op swap» (тот же лого
 * в тот же слот). Цикл бесконечный — никогда не пропускает итерацию.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("logo-grid-swap.js: GSAP не загружен");
    return;
  }

  const visibleSlots = document.querySelectorAll('.logo-grid_img-visible');
  const poolImages = document.querySelectorAll('.logo-hidden-pool .logo-grid_img');
  if (visibleSlots.length === 0 || poolImages.length === 0) return;

  const FADE_OUT_DURATION = 0.6;
  const FADE_IN_DURATION = 0.6;
  const MIN_SWAP_COUNT = 3;
  const MAX_SWAP_COUNT = 4;
  const MIN_INTERVAL_MS = 3000;
  const MAX_INTERVAL_MS = 5500;
  const FIRST_SWAP_DELAY_MS = 2000;

  const allLogosSrc = Array.from(poolImages).map(img => img.src);
  const currentVisibleSrc = Array.from(visibleSlots).map(img => img.src);

  function pickRandomDifferent(excludeSrc) {
    // Любое лого из пула, кроме того, что сейчас в слоте — чтобы swap
    // дал визуальное изменение. Повторы между РАЗНЫМИ слотами разрешены.
    const candidates = allLogosSrc.filter(src => src !== excludeSrc);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function swapBatchLogos() {
    const slotCount = visibleSlots.length;
    let swapCount = gsap.utils.random(MIN_SWAP_COUNT, MAX_SWAP_COUNT, 1);
    if (swapCount > slotCount) swapCount = slotCount;

    // Каждый раз — РАЗНЫЕ случайные слоты. Между собой слоты не
    // повторяются в одной итерации (берём из shuffle).
    const slotIndices = Array.from({ length: slotCount }, (_, i) => i);
    const slotsToReplace = gsap.utils.shuffle(slotIndices).slice(0, swapCount);

    slotsToReplace.forEach(slotIndex => {
      const slotToChange = visibleSlots[slotIndex];
      const newLogoSrc = pickRandomDifferent(currentVisibleSrc[slotIndex]);
      if (!newLogoSrc) return;

      gsap.to(slotToChange, {
        opacity: 0,
        duration: FADE_OUT_DURATION,
        ease: "power1.inOut",
        onComplete: () => {
          // Сносим srcset/sizes — иначе Webflow перезапишет src
          slotToChange.src = newLogoSrc;
          slotToChange.removeAttribute('srcset');
          slotToChange.removeAttribute('sizes');

          currentVisibleSrc[slotIndex] = newLogoSrc;

          gsap.to(slotToChange, {
            opacity: 1,
            duration: FADE_IN_DURATION,
            ease: "power1.inOut"
          });
        }
      });
    });

    // Расписание следующей итерации БЕЗОУСЛОВНО — даже если пул мал,
    // следующий тик всё равно запустится и снова попробует.
    const nextSwapTime = gsap.utils.random(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
    setTimeout(swapBatchLogos, nextSwapTime);
  }

  setTimeout(swapBatchLogos, FIRST_SWAP_DELAY_MS);
});

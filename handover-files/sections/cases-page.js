/**
 * Страница /cases — активная строка + превью в сайдбаре.
 *
 * Одна .case-row в каждый момент имеет .is-active. По умолчанию первая.
 * Hover другой → она становится активной (заливка через ::before в CSS),
 * сайдбар-превью сменяется через hide→swap→reveal (clip-path inset).
 */

function bootCasesPageHover() {
  if (typeof gsap === "undefined") {
    console.warn("cases-page.js: GSAP не загружен");
    return;
  }

  const rows = Array.from(document.querySelectorAll(".case-row"));
  const display = document.querySelector(".cases-sidebar_display");
  if (rows.length === 0 || !display) return;

  // src каждой строки — кэш чтобы не дёргать querySelector на hover'е
  const rowSrcs = rows.map(row => {
    const img = row.querySelector(".case-row_preview-img");
    return img ? (img.getAttribute("src") || "") : "";
  });

  // Нумерация: 01, 02, … N — записываем в .case-row_num каждой строки.
  // Если N < 10 — двузначный паддинг (01); иначе ширина = длина общего
  // количества (например 09/10/11).
  const padLen = Math.max(2, String(rows.length).length);
  rows.forEach((row, i) => {
    const numEl = row.querySelector(".case-row_num");
    if (numEl) {
      numEl.textContent = String(i + 1).padStart(padLen, "0");
    }
  });

  // Превью-img в сайдбаре — создаём один раз, переиспользуем
  let preview = display.querySelector(".cases-sidebar_preview");
  if (!preview) {
    preview = document.createElement("img");
    preview.className = "cases-sidebar_preview";
    preview.alt = "";
    display.appendChild(preview);
  }

  const HIDE_DUR   = 0.3;
  const REVEAL_DUR = 0.5;

  let currentSrc = null;
  let activeIdx  = -1;
  let switchTl   = null;

  // Свич превью с эффектом «заливения»: hide → swap → reveal.
  // Первая отрисовка пропускает hide (CSS уже держит inset 100%).
  function showPreview(src) {
    if (src === currentSrc) return;
    if (switchTl) switchTl.kill();
    switchTl = gsap.timeline();

    if (currentSrc === null) {
      preview.src = src;
      currentSrc = src;
      switchTl.to(preview, {
        clipPath: "inset(0% 0 0 0)",
        duration: REVEAL_DUR,
        ease: "power2.out"
      });
    } else {
      switchTl.to(preview, {
        clipPath: "inset(100% 0 0 0)",
        duration: HIDE_DUR,
        ease: "power2.in"
      });
      switchTl.call(() => {
        preview.src = src;
        currentSrc = src;
      });
      switchTl.to(preview, {
        clipPath: "inset(0% 0 0 0)",
        duration: REVEAL_DUR,
        ease: "power2.out"
      });
    }
  }

  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    rows.forEach((row, i) => {
      row.classList.toggle("is-active", i === idx);
    });
    const src = rowSrcs[idx];
    if (src) showPreview(src);
  }

  // По умолчанию активна первая
  setActive(0);

  rows.forEach((row, i) => {
    row.addEventListener("mouseenter", () => setActive(i));
  });
  // mouseleave не обрабатываем — active остаётся до hover'а другой строки
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootCasesPageHover);
} else {
  bootCasesPageHover();
}

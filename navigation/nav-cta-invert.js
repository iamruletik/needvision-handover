/**
 * Тема плавающей CTA-кнопки (.nav-cta__btn) по секциям:
 *   dark > orange > white (приоритет)
 *
 * dark — всё что внутри .about-wrapper (partner / stages / team / footer).
 * orange — секции с классом .is-orange-nav.
 * white — дефолт (hero, manifesto, bento, logos и т.д.).
 */

function bootNavCtaInvert() {
  if (typeof gsap === "undefined") {
    console.warn("nav-cta-invert.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("nav-cta-invert.js: ScrollTrigger не загружен");
    return;
  }

  const ctaBtn = document.querySelector(".nav-cta__btn");
  if (!ctaBtn) return;

  gsap.registerPlugin(ScrollTrigger);

  // Глушим Webflow IX2 на кнопке — иначе в конце страницы он мог
  // менять её inline-стили (color/bg) поверх наших.
  ctaBtn.removeAttribute("data-w-id");
  ctaBtn.querySelectorAll("[data-w-id]").forEach(el => {
    el.removeAttribute("data-w-id");
  });
  setTimeout(() => {
    ctaBtn.removeAttribute("data-w-id");
    ctaBtn.querySelectorAll("[data-w-id]").forEach(el => {
      el.removeAttribute("data-w-id");
    });
  }, 500);

  const THEMES = {
    white:  { bg: "#ffffff", text: "#000000" },
    orange: { bg: "#FF6038", text: "#ffffff" },
    dark:   { bg: "#040101", text: "#ffffff" }
  };

  // Стартовое — пишем с !important чтобы Webflow CSS/IX2 не перебивал.
  function setThemeImmediate(name) {
    const t = THEMES[name];
    ctaBtn.style.setProperty("background-color", t.bg, "important");
    ctaBtn.style.setProperty("color", t.text, "important");
  }
  setThemeImmediate("white");

  const activeOrange = new Set();
  let isInDark = false;
  let currentTheme = "white";

  function applyTheme() {
    const next = isInDark
      ? "dark"
      : (activeOrange.size > 0 ? "orange" : "white");

    if (next === currentTheme) return;
    currentTheme = next;

    const t = THEMES[next];
    // Tween через объект-прокси и пишем с !important в onUpdate.
    const start = parseColor(getComputedStyle(ctaBtn).backgroundColor);
    const startText = parseColor(getComputedStyle(ctaBtn).color);
    const endBg = parseColor(t.bg);
    const endText = parseColor(t.text);

    const proxy = { p: 0 };
    gsap.to(proxy, {
      p: 1,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
      onUpdate: () => {
        const bg = lerpColor(start, endBg, proxy.p);
        const txt = lerpColor(startText, endText, proxy.p);
        ctaBtn.style.setProperty("background-color", bg, "important");
        ctaBtn.style.setProperty("color", txt, "important");
      }
    });
  }

  // ---- Утилиты для color-lerp с !important ----
  function parseColor(str) {
    if (str.startsWith("#")) {
      const hex = str.slice(1);
      const n = parseInt(hex.length === 3
        ? hex.split("").map(c => c + c).join("")
        : hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = str.match(/\d+(\.\d+)?/g);
    return m ? [+m[0], +m[1], +m[2]] : [255, 255, 255];
  }
  function lerpColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }

  let pending = false;
  function scheduleApply() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      applyTheme();
    });
  }

  // ---- Orange секции ----
  gsap.utils.toArray(".is-orange-nav").forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 5.56vw",
      end: "bottom 5.56vw",
      onToggle: (self) => {
        if (self.isActive) activeOrange.add(section);
        else activeOrange.delete(section);
        scheduleApply();
      }
    });
  });

  // ---- Dark-зона: .about-wrapper и всё до конца страницы ----
  // end задаём функцией с гарантированно большим запасом — на случай
  // если .footer лежит вне .about-wrapper или после неё ещё что-то есть.
  const aboutWrapper = document.querySelector(".about-wrapper");
  if (aboutWrapper) {
    ScrollTrigger.create({
      trigger: aboutWrapper,
      start: "top 5.56vw",
      end: () => `+=${document.documentElement.scrollHeight}`,
      invalidateOnRefresh: true,
      onToggle: (self) => {
        isInDark = self.isActive;
        scheduleApply();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNavCtaInvert);
} else {
  bootNavCtaInvert();
}

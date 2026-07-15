/**
 * Fade-overlay переход между страницами. Перехватывает клики по
 * внутренним ссылкам: fade-in оверлей → window.location.href.
 * На новой странице оверлей уже невидим, а preloader.js делает свой
 * fade-out → ощущение цельного перехода без snap'а.
 *
 * Не трогает: внешние ссылки, mailto/tel, target=_blank, download,
 * cmd/ctrl-click (новая вкладка), якорные #-ссылки.
 */

(() => {
  const FADE_DURATION_MS = 380;
  const OVERLAY_BG = "#040101";
  const OVERLAY_CLASS = "page-transition-overlay";
  const OVERLAY_ACTIVE_CLASS = "is-active";

  function createOverlay() {
    let overlay = document.querySelector("." + OVERLAY_CLASS);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = OVERLAY_CLASS;
    // Inline-стили на случай если custom.css ещё не дошёл —
    // overlay сразу рабочий
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: ${OVERLAY_BG};
      opacity: 0;
      pointer-events: none;
      z-index: 99998;
      transition: opacity ${FADE_DURATION_MS}ms cubic-bezier(0.65, 0, 0.35, 1);
      will-change: opacity;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function shouldHandleLink(link, event) {
    if (!link) return false;

    const href = link.getAttribute("href");
    if (!href) return false;

    if (href.startsWith("#")) return false;
    if (href.startsWith("mailto:")) return false;
    if (href.startsWith("tel:")) return false;
    if (link.target === "_blank") return false;
    if (link.hasAttribute("download")) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (event.button !== 0) return false;     // только левая кнопка

    let url;
    try { url = new URL(href, location.href); } catch { return false; }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) {
      return false;        // тот же URL → не перезагружаем
    }
    return true;
  }

  function boot() {
    const overlay = createOverlay();

    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[href]");
      if (!shouldHandleLink(link, e)) return;

      e.preventDefault();
      const href = link.getAttribute("href");

      overlay.classList.add(OVERLAY_ACTIVE_CLASS);
      overlay.style.opacity = "1";

      // Lenis должен остановить inertia, чтобы клик не «доезжал»
      if (window.lenis?.stop) window.lenis.stop();

      setTimeout(() => {
        window.location.href = href;
      }, FADE_DURATION_MS);
    });

    // Если юзер пришёл назад через history — bfcache может вернуть
    // страницу с overlay в активном состоянии. Гасим.
    window.addEventListener("pageshow", (e) => {
      if (e.persisted) {
        overlay.classList.remove(OVERLAY_ACTIVE_CLASS);
        overlay.style.opacity = "0";
        if (window.lenis?.start) window.lenis.start();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

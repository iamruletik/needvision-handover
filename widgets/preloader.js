/**
 * Прелоудер: цикл 9 иконок до полной загрузки страницы и 3D-сцены.
 *
 *   FRAME_MS = 300 → один цикл 1→9 ≈ 2.4с.
 *
 * Минимум: один полный цикл 1→9 показан в любом случае — даже если
 *   ресурсы загрузились мгновенно.
 *
 * Максимум: бесконечно. Цикл повторяется пока:
 *   1. window.load НЕ отстрелял (document.readyState !== "complete"),
 *      т.е. ещё грузятся <script>/<img>/<iframe> ИЛИ
 *   2. 3D-сцена не сообщила готовность: можно выставить
 *      window.heroSceneReady = true из скрипта сцены, либо мы ждём
 *      пока в .js-canvas-wrapper появится <canvas>.
 *
 * Проверка готовности — каждый раз когда счётчик добегает до 9-й иконки.
 * Если готово — пауза PAUSE_ON_LAST_MS, fade-out, display:none.
 * Если нет — крутим ещё один цикл.
 *
 * Пока виден — html/body overflow:hidden + body padding-right под
 * скроллбар (резервируем место чтобы при unlock сайт не дёргался).
 *
 * Клик по внутренней ссылке: показываем заново и навигируем через
 * NAV_DELAY_MS — без ожидания полного цикла (иначе юзер залипал бы).
 */

function bootPreloader() {
  const preloader = document.querySelector(".preloader");
  if (!preloader) return;

  const icons = Array.from(preloader.querySelectorAll(".preloader_icon"));
  if (icons.length === 0) return;

  const FRAME_MS         = 300;
  const PAUSE_ON_LAST_MS = 600;
  const FADE_DURATION    = 1.0;
  const NAV_DELAY_MS     = 320;

  let cycleRunning = false;
  let currentIdx   = 0;
  let lastFrameAt  = 0;
  let navigating   = false;
  let isHiding     = false;

  // Стартовое: первая видна, остальные прозрачны.
  icons.forEach((icon, i) => {
    icon.style.opacity = i === 0 ? "1" : "0";
    icon.style.willChange = "opacity";
  });

  // Компенсируем ширину скроллбара через padding-right при lock.
  // scrollbar-gutter:stable в CSS этого не делает при overflow:hidden
  // (по спеке гэп не резервируется).
  function getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  }
  function lockUI() {
    const sbw = getScrollbarWidth();
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  }
  function unlockUI() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  // Условие «всё загружено». window.load (= readyState complete) гарантирует
  // что все <script>/<img>/<iframe> уже скачались. 3D-сцена проверяется
  // двумя способами: явный флаг (window.heroSceneReady=true сама сцена)
  // или наличие <canvas> в обёртке .js-canvas-wrapper. Если обёртки
  // вообще нет — не блокируем.
  function isFullyLoaded() {
    if (document.readyState !== "complete") return false;
    if (window.heroSceneReady === true) return true;

    const canvasWrapper = document.querySelector(".js-canvas-wrapper");
    if (canvasWrapper && !canvasWrapper.querySelector("canvas")) {
      return false;
    }
    return true;
  }

  function tick(now) {
    if (!cycleRunning) return;
    if (now - lastFrameAt >= FRAME_MS) {
      lastFrameAt = now;
      icons[currentIdx].style.opacity = "0";
      currentIdx = (currentIdx + 1) % icons.length;
      icons[currentIdx].style.opacity = "1";

      // Дошли до 9-й иконки (последняя в цикле) — проверяем готовность.
      // Если всё загружено → планируем hide. Иначе — следующий tick
      // перейдёт на индекс 0 и крутим ещё круг.
      if (currentIdx === icons.length - 1) {
        if (!isHiding && !navigating && isFullyLoaded()) {
          isHiding = true;
          scheduleHide();
        }
      }
    }
    requestAnimationFrame(tick);
  }

  function startCycle() {
    if (cycleRunning) return;
    cycleRunning = true;
    lastFrameAt = performance.now();
    requestAnimationFrame(tick);
  }
  function stopCycle() {
    cycleRunning = false;
  }

  function scheduleHide() {
    // Снимаем lock ровно сейчас — прелоудер ещё opacity:1, скроллбар
    // появится беспалевно в зарезервированном padding-right.
    unlockUI();

    setTimeout(() => {
      stopCycle();

      const onDone = () => {
        preloader.style.display = "none";
      };

      if (typeof gsap !== "undefined") {
        gsap.to(preloader, {
          opacity: 0,
          duration: FADE_DURATION,
          ease: "expo.out",
          onComplete: onDone
        });
      } else {
        preloader.style.transition = `opacity ${FADE_DURATION}s cubic-bezier(0.16, 1, 0.3, 1)`;
        preloader.style.opacity = "0";
        setTimeout(onDone, FADE_DURATION * 1000);
      }
    }, PAUSE_ON_LAST_MS);
  }

  function showPreloader() {
    preloader.style.display = "flex";
    preloader.style.opacity = "1";
    preloader.style.pointerEvents = "auto";
    isHiding = false;
    currentIdx = 0;
    icons.forEach((icon, i) => {
      icon.style.opacity = i === 0 ? "1" : "0";
    });
    lockUI();
    startCycle();
  }

  // Первая загрузка
  showPreloader();

  // Клики по внутренним ссылкам — переход через прелоудер.
  // Пропускаем якоря, mailto/tel, _blank, ctrl/cmd-клики (новая вкладка).
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    const link = e.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href === "#") return;
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;

    let url;
    try { url = new URL(href, location.href); } catch { return; }

    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;

    e.preventDefault();
    navigating = true;
    showPreloader();
    setTimeout(() => { window.location.href = link.href; }, NAV_DELAY_MS);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPreloader);
} else {
  bootPreloader();
}

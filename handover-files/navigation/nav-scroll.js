/**
 * Навигация: сжатие плашки на скролле + клик-меню.
 *
 * На скролле плашка .menu_overlay-content сжимается 57vw → 24vw, белеет,
 * показывается profit-счётчик, лого опускается. Над .stages цвета
 * инвертируются. По клику .nav-menu — экстренно дожимает плашку (если
 * юзер у верха), верхние углы плашки уезжают с 1.5vw до 0.8vw и
 * раскрывается .menu_dropdown-list. При закрытии — верхние углы
 * возвращаются к 1.5vw.
 *
 * На внутренних страницах (например /cases) навигация должна быть сразу
 * в «сжатом» виде без scroll-анимации. Для этого на <body> ставится
 * атрибут data-nav-mode="static" (Webflow → Body → Element Settings →
 * Custom Attributes). Меню по клику работает как обычно в обоих режимах.
 */

function bootNavScroll() {
  if (typeof gsap === "undefined") {
    console.warn("nav-scroll.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("nav-scroll.js: ScrollTrigger не загружен");
    return;
  }

  const overlay = document.querySelector(".menu_overlay-content");
  if (!overlay) return;

  gsap.registerPlugin(ScrollTrigger);

  // На мобиле scroll-driven scrub лагает (filter/scale на каждый
  // scroll-tick на слабом GPU). Решение: один раз проиграть compressTl
  // как autoplay при загрузке — плашка сразу анимированно встаёт в
  // финальный вид, дальше юзер просто скроллит без вмешательства JS.
  const isMobile = window.matchMedia("(max-width: 991px)").matches;

  // ---- Стартовое состояние ----

  // Profit-счётчик скрыт по умолчанию — раскроется на скролле/открытии меню
  gsap.set(".menu_profit-badge", {
    opacity: 0,
    width: 0,
    overflow: "hidden",
    whiteSpace: "nowrap"
  });

  gsap.set(".nav-profit-item", { opacity: 0, y: "1.39vw" });

  // Дропдаун схлопнут, backdrop невидим
  gsap.set(".menu_dropdown-list", { height: 0, opacity: 0 });
  gsap.set(".menu_backdrop", { opacity: 0, pointerEvents: "none" });

  // У overlay в Webflow нет explicit bg — задаём прозрачно-белый,
  // чтобы tween в #ffffff корректно интерполировал альфу.
  gsap.set(".menu_overlay-content", {
    backgroundColor: "rgba(255,255,255,0)"
  });


  // ---- Compress timeline (paused, управляется снаружи) ----
  // Один таймлайн обслуживает scroll и клик меню:
  //   - скролл двигает progress через proxy + scrub
  //   - клик меню форсит progress = 1
  //
  // Лого и nav-btm стартуют сразу (pos 0), всё остальное (плашка, текст,
  // profit, инверсия) отложено на TOP_DELAY — чтобы лого успело
  // «приземлиться» до того, как плашка начнёт перекрашиваться.
  const compressTl = gsap.timeline({ paused: true });
  const TOP_DELAY = 0.09;

  // OVERLAY_RADIUS_OPEN/CLOSED — верхние углы плашки при открытом и
  // закрытом меню. Закрытое значение (1.5vw) совпадает с радиусом,
  // выставленным в Webflow CSS, — при закрытии плашка визуально
  // возвращается в исходный вид.
  // PROFIT_POS + PROFIT_DUR должна равняться эффективной длительности
  // compressTl (TOP_DELAY + 0.5 = 0.59), чтобы profit завершался ровно
  // в момент полного сжатия плашки.
  const OVERLAY_RADIUS_OPEN = "0.8vw";
  const OVERLAY_RADIUS_CLOSED = "1.5vw";
  const PROFIT_POS = 0.29;
  const PROFIT_DUR = 0.3;

  // Размер через scale (а не width) — composite, не триггерит reflow
  // и не пересобирает <img> srcset. transformOrigin left center чтобы
  // логотип ужимался от левого края.
  gsap.set(".nav-logo_img", { transformOrigin: "left center", force3D: true });
  compressTl.to(".nav-logo_img", {
    scale: 0.47,
    y: "2vw",
    marginLeft: "0.6vw",
    duration: 0.25,
    ease: "power2.out"
  }, 0);

  // .nav-wrapper приподнимается вверх на 0.4vw синхронно с лого —
  // компенсирует визуальное смещение, плашка прилегает к верху.
  compressTl.to(".nav-wrapper", {
    marginTop: "-0.47vw",
    duration: 0.25,
    ease: "power2.out"
  }, 0);

  compressTl.to(".menu_overlay-content", {
    width: "24vw",
    backgroundColor: "#ffffff",
    duration: 0.5,
    ease: "power2.out"
  }, TOP_DELAY);

  compressTl.to(".menu_control-bar *", {
    color: "#000000",
    duration: 0.5,
    ease: "power2.out"
  }, TOP_DELAY);

  compressTl.to(".nav-icon", {
    filter: "invert(1)",
    duration: 0.4,
    ease: "power2.out"
  }, TOP_DELAY);

  // Profit-badge привязан к концу compressTl — заканчивается строго в
  // момент полного сжатия плашки (PROFIT_POS + PROFIT_DUR = 0.59 = TOP_DELAY + 0.5).
  // Сама анимация появления (width auto + opacity + margin / opacity + y + stagger)
  // оставлена как в оригинале — изменена только скорость, чтобы успеть
  // закончиться синхронно со сжатием. Раньше длительности были 0.6 и 0.7
  // с stagger 0.1 — заведомо длиннее окна компрессии.
  compressTl.to(".menu_profit-badge", {
    width: "auto",
    opacity: 1,
    margin: "0 0.5vw",
    duration: PROFIT_DUR,
    ease: "power2.out"
  }, PROFIT_POS);

  // items: dur 0.2 + stagger 0.05 даёт оригинальный каскадный эффект,
  // но укладывается в финальный отрезок compressTl. Для ≤3 items
  // последний закончится не позже 0.59. Для большего количества — чуть
  // вылезет, регулируется через PROFIT_ITEM_STAGGER.
  const PROFIT_ITEM_DUR = 0.2;
  const PROFIT_ITEM_STAGGER = 0.05;
  compressTl.to(".nav-profit-item", {
    opacity: 1,
    y: 0,
    duration: PROFIT_ITEM_DUR,
    stagger: PROFIT_ITEM_STAGGER,
    ease: "power2.out"
  }, PROFIT_POS);

  // Иконки/таймер исчезают/появляются отдельным autoplay-фейдом —
  // не привязаны к скроллу и без ресайза (только opacity). Триггер
  // ниже — ScrollTrigger.onEnter/onLeaveBack.


  // ---- Режим: scroll-driven, static или mobile-autoplay ----
  // body[data-nav-mode="static"] → плашка сразу в финальном виде.
  // mobile (≤991px) → autoplay compressTl при загрузке, без scrub.
  // desktop → scroll-driven scrub.
  const isStaticNav = document.body?.dataset?.navMode === "static";


  // ---- Autoplay-фейд для иконок/таймера ----
  // Отдельный таймлайн: при первом скролле вниз — opacity 1 → 0
  // плавно за 0.5с, при возврате к верху — обратно. Без ресайза,
  // только opacity. Запускается автоматом, не привязан к scrub.
  const navFadeEls = ".nav_left-icon, .nav_right-icon, .nav-timer";
  const navFadeTl = gsap.timeline({ paused: true });
  navFadeTl.to(navFadeEls, {
    opacity: 0,
    duration: 0.5,
    ease: "power2.out"
  });

  ScrollTrigger.create({
    trigger: "body",
    start: "top top-=20",
    onEnter: () => navFadeTl.play(),
    onLeaveBack: () => navFadeTl.reverse()
  });


  // compressState.progress — куда вернуть плашку при закрытии меню.
  // Static: всегда 1. Desktop scrub / mobile triggered: 0 на init,
  // обновляется при скролле.
  const compressState = { progress: isStaticNav ? 1 : 0 };
  let menuOpen = false;

  // Объявлен снаружи — openMenu/closeMenu проверяют через него
  // (на мобиле остаётся null, isInInvertZone вернёт false).
  let navInvertTl = null;

  if (isStaticNav) {
    compressTl.progress(1);
  } else if (isMobile) {
    // Mobile: триггер по скроллу, но НЕ scrub.
    //   юзер скроллит вниз (за 50px) → compressTl.play() — проигрывается
    //     вперёд за свою длительность (~0.59с), плавно;
    //   юзер вернулся вверх → compressTl.reverse() — играет назад.
    // Это даёт ту же логику что desktop scrub, но без лагов: timeline
    // проигрывается за фикс. время, не дёргается под каждый touch-tick.
    ScrollTrigger.create({
      trigger: "body",
      start: "3.47vw top",
      onEnter: () => {
        if (menuOpen) return;
        compressTl.play();
        compressState.progress = 1;
      },
      onLeaveBack: () => {
        if (menuOpen) return;
        compressTl.reverse();
        compressState.progress = 0;
      }
    });
  } else {
    // Скролл двигает proxy через scrub:1 → плавно. Когда меню открыто,
    // игнорируем апдейты, чтобы не перебивать клик-анимацию.
    gsap.to(compressState, {
      progress: 1,
      ease: "none",
      scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "+=300vw",
        scrub: 1
      },
      onUpdate: () => {
        if (!menuOpen) {
          compressTl.progress(compressState.progress);
        }
      }
    });


    // Инверсия над .stages (бежевая секция).
    // .to (а не .fromTo) — захватываем текущее состояние, не пробивая
    // forced from-value поверх compressTl
    navInvertTl = gsap.timeline({
      scrollTrigger: {
        trigger: ".stages",
        start: "top 85%",
        end: "top 25%",
        scrub: true
      }
    });

    navInvertTl.to(".menu_overlay-content",
      { backgroundColor: "#040101", duration: 1, immediateRender: false }, 0);
    navInvertTl.to(".menu_control-bar *",
      { color: "#ffffff", duration: 1, immediateRender: false }, 0);
    navInvertTl.to(".nav-btm, .nav-btm *",
      { color: "#000000", duration: 1, immediateRender: false }, 0);
    navInvertTl.to(".nav-logo_img",
      { filter: "invert(1)", duration: 1, immediateRender: false }, 0);
    navInvertTl.to(".nav-icon",
      { filter: "invert(0)", duration: 1, immediateRender: false }, 0);
  }


  // ---- Override инверсии при открытом меню ----
  // Над .stages плашка чёрная с белым текстом (navInvertTl). Когда юзер
  // открывает меню в этой зоне — плашка должна вернуться к обычному
  // сжатому виду (белая, чёрный текст). При закрытии — обратно к dark
  // если всё ещё в зоне инверсии.
  const INVERT_DARK  = { bg: "#040101", color: "#ffffff", logo: "invert(1)", icon: "invert(0)" };
  const INVERT_LIGHT = { bg: "#ffffff", color: "#000000", logo: "invert(0)", icon: "invert(1)" };
  const INVERT_OVERRIDE_DURATION = 0.5;

  function applyInvertState(state) {
    const opts = { duration: INVERT_OVERRIDE_DURATION, ease: "power2.out", overwrite: "auto" };
    gsap.to(".menu_overlay-content", { ...opts, backgroundColor: state.bg });
    gsap.to(".menu_control-bar *",   { ...opts, color: state.color });
    gsap.to(".nav-logo_img",         { ...opts, filter: state.logo });
    gsap.to(".nav-icon",             { ...opts, filter: state.icon });
  }

  function isInInvertZone() {
    return !!navInvertTl?.scrollTrigger && navInvertTl.scrollTrigger.progress > 0.5;
  }

  // ---- Меню (открытие/закрытие) ----
  const menuBtn = document.querySelector(".nav-menu");
  const menuPanel = document.querySelector(".menu_dropdown-list");
  const menuTxt = document.querySelector(".nav-menu__txt");
  const menuIcon = document.querySelector(".menu-icon");
  const menuBackdrop = document.querySelector(".menu_backdrop");

  if (menuBtn && menuPanel) {
    // Один timeline на оба сценария. Каждый новый клик kill()'ит
    // предыдущий — нет наложений и рваных переходов.
    let menuTl = null;

    function openMenu() {
      menuOpen = true;
      if (menuTl) menuTl.kill();

      // Если меню открывают над .stages — перебиваем navInvertTl на light
      if (isInInvertZone()) applyInvertState(INVERT_LIGHT);

      // Если плашка ещё не сжата — сначала визуально сжимаем,
      // только потом раскрываем дропдаун. Иначе сразу к дропдауну.
      const needsCompress = compressTl.progress() < 0.99;

      menuTl = gsap.timeline();

      if (needsCompress) {
        menuTl.to(compressTl, {
          progress: 1,
          duration: 0.95,
          ease: "power2.inOut",
          overwrite: true
        }, 0);
      }

      // -0.2 перекрытие: последняя четверть сжатия и первая четверть
      // раскрытия идут одновременно — переход цельный, без зазора
      const dropdownPos = needsCompress ? "-=0.2" : 0;

      // ОТКРЫТИЕ: радиус и раскрытие панели — одно слитное движение.
      // Одинаковые start, duration и ease — пользователь видит как
      // углы заостряются ровно за то же время, что панель уезжает вниз.
      const OPEN_DUR = 1.1;
      menuTl.addLabel("openStart", dropdownPos);
      menuTl.to(".menu_overlay-content", {
        borderTopLeftRadius: OVERLAY_RADIUS_OPEN,
        borderTopRightRadius: OVERLAY_RADIUS_OPEN,
        duration: OPEN_DUR,
        ease: "power2.out",
        overwrite: "auto"
      }, "openStart");

      menuTl.to(menuPanel, {
        height: "auto",
        opacity: 1,
        duration: OPEN_DUR,
        ease: "power2.out"
      }, "openStart");

      if (menuBackdrop) {
        menuTl.to(menuBackdrop, {
          opacity: 1,
          pointerEvents: "auto",
          duration: 0.9,
          ease: "power2.out"
        }, "<");
      }

      if (menuIcon) {
        menuIcon.classList.add("is-open");
        menuIcon.setAttribute("aria-expanded", "true");
      }

      if (menuTxt) {
        gsap.to(menuTxt, {
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
          overwrite: "auto",
          onComplete: () => {
            menuTxt.textContent = "CLOSE";
            gsap.to(menuTxt, { opacity: 1, duration: 0.25, ease: "power2.out" });
          }
        });
      }
    }

    function closeMenu() {
      // menuOpen=false сразу, не в onComplete: иначе при быстрых кликах
      // menuOpen остаётся true пока идёт close → следующий click опять
      // попадает в closeMenu → kill → новый close → цикл. Меню «зависает»
      // в режиме «всегда закрываюсь».
      menuOpen = false;
      if (menuTl) menuTl.kill();

      // Если всё ещё в зоне инверсии — вернуть плашку в dark
      if (isInInvertZone()) applyInvertState(INVERT_DARK);

      menuTl = gsap.timeline();

      // ЗАКРЫТИЕ: радиус и схлопывание панели — одно слитное движение.
      // Одинаковые start (0), duration и ease — углы возвращаются к
      // 1.5vw ровно за то же время, что панель уезжает наверх.
      const CLOSE_DUR = 0.75;
      menuTl.to(".menu_overlay-content", {
        borderTopLeftRadius: OVERLAY_RADIUS_CLOSED,
        borderTopRightRadius: OVERLAY_RADIUS_CLOSED,
        duration: CLOSE_DUR,
        ease: "power2.in",
        overwrite: "auto"
      }, 0);

      menuTl.to(menuPanel, {
        height: 0,
        opacity: 0,
        duration: CLOSE_DUR,
        ease: "power2.in"
      }, 0);

      if (menuBackdrop) {
        menuTl.to(menuBackdrop, {
          opacity: 0,
          pointerEvents: "none",
          duration: 0.7,
          ease: "power2.in"
        }, 0);
      }

      // Возврат к scroll-state. У верха страницы — плавно раскрываемся
      // обратно. У низа или в static-режиме — no-op (progress уже 1).
      // -0.3 перекрытие: декомпрессия стартует пока дропдаун ещё схлопывается
      menuTl.to(compressTl, {
        progress: compressState.progress,
        duration: 0.95,
        ease: "power2.inOut",
        overwrite: true
      }, "-=0.3");

      if (menuIcon) {
        menuIcon.classList.remove("is-open");
        menuIcon.setAttribute("aria-expanded", "false");
      }

      if (menuTxt) {
        gsap.to(menuTxt, {
          opacity: 0,
          duration: 0.2,
          ease: "power2.in",
          overwrite: "auto",
          onComplete: () => {
            menuTxt.textContent = "Menu";
            gsap.to(menuTxt, { opacity: 1, duration: 0.25, ease: "power2.out" });
          }
        });
      }
    }

    // stopImmediatePropagation — Webflow IX2 может висеть на той же
    // кнопке и перебивать наш toggle.
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      menuOpen ? closeMenu() : openMenu();
    });

    if (menuBackdrop) {
      menuBackdrop.addEventListener("click", () => {
        if (menuOpen) closeMenu();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) closeMenu();
    });

    // Клик по любой ссылке внутри меню — закрыть.
    // Event delegation: один listener вместо forEach.
    menuPanel.addEventListener("click", (e) => {
      if (e.target.closest(".nav_menu-link")) closeMenu();
    });
  }
}

// Если DOM ещё парсится — ждём, иначе сразу. Покрывает случай когда
// CDN отдаёт скрипт после DOMContentLoaded.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNavScroll);
} else {
  bootNavScroll();
}

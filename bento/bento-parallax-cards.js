/**
 * Параллакс bento-карточек. Скролл через .parallax-sticky:
 *   фаза 1 — карточки выезжают снизу (появление),
 *   пауза  — карточки стоят по центру,
 *   фаза 2 — карточки уходят вверх (исчезание).
 *
 * Что переработано относительно прошлой версии:
 *   • Появление сделано «зеркалом» ухода — раньше оно шло в 5 раз
 *     быстрее (5 ед. против 25) и при start:"top bottom" успевало
 *     отыграть, пока секция ещё внизу экрана, оттого казалось дёрганым.
 *     Теперь у входа достаточно скролла, чтобы читаться так же плавно,
 *     как уход.
 *   • Контейнеры (grid/column) теперь дрейфуют и на входе тоже:
 *     слегка опущены → подбираются к 0 → на уходе уезжают вверх.
 *     Непрерывный дрейф через все фазы = плавность на всех стадиях,
 *     а не только на последней.
 *   • Opacity на входе — короткий fade-in только в начале, дальше
 *     карточка едет уже непрозрачной (зеркало чистого слайд-аута).
 *
 * Индивидуальные сдвиги на самих элементах (перебивают авто-скаттер):
 *   data-start-y      — откуда выезжает по Y (перебивает паттерн)
 *   data-start-x      — откуда выезжает по X (перебивает паттерн)
 *   data-start-rot    — стартовый наклон в градусах (перебивает паттерн)
 *   data-end-y        — куда уезжает  (перебивает CONFIG.exitY)
 *   data-enter-delay  — доп. задержка появления поверх стаггера (ед. timeline)
 *   data-exit-delay   — задержка ухода в ед. timeline (стаггер ухода)
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("bento-parallax-cards.js: GSAP не загружен");
    return;
  }
  if (typeof ScrollTrigger === "undefined") {
    console.warn("bento-parallax-cards.js: ScrollTrigger не загружен");
    return;
  }

  // ==========================================================
  // НАСТРОЙКИ — крути тут
  // ==========================================================
  const CONFIG = {
    // Пропорции фаз в условных единицах timeline (НЕ секунды — это
    // доли одного scroll-distance). Раньше: 5 / 4.06 / 25.
    // Теперь входу дано больше — он перестаёт «прилетать» рывком.
    enterDuration: 14,
    holdDuration: 5,
    exitDuration: 25,

    // Стартовый/финальный сдвиг карточки по Y (vw — скейлится с экраном).
    // Вход теперь стартует глубже снизу (60 вместо 41.67), чтобы карточка
    // не заходила в кадр ещё полупрозрачной. Уход без изменений.
    enterY: "60vw",
    exitY: "-83.33vw",

    // Доля enterDuration, за которую происходит fade-in. Короткий фейд
    // в начале маскирует «въезд», дальше карточка непрозрачна.
    enterFadeRatio: 0.35,

    // --- ПОЯВЛЕНИЕ «РАЗБИТОЙ СЕТКОЙ» ---
    // Карточки входят не монолитом, а вразнобой: каждая из своей точки,
    // со своим наклоном и задержкой, и на лету собирается в ровный bento.
    scatterEnabled: true,
    // Стаггер: суммарный разброс старта карточек по timeline (в ед.).
    // Делится между карточками — чем больше, тем заметнее «по очереди».
    enterStaggerSpread: 5,
    // Сколько карточка стоит в разлёте ПЕРЕД сбором в bento (ед. timeline).
    // Появляется fade-in'ом сразу при входе секции (видна в разлёте),
    // а transform-сбор стартует только через scatterHold — пока секция
    // выезжает в кадр, юзер успевает разглядеть разлёт. Без этой задержки
    // сбор кончался ~30% скролла = до момента "секция полностью в кадре".
    scatterHold: 14,
    // Паттерны разлёта, циклятся по порядку карточек в DOM. Только
    // вертикальная ось — без горизонтального сдвига и наклона. Микс
    // положительных и отрицательных y: одни прилетают снизу, другие
    // сверху. Перебивается атрибутами data-start-y / data-start-x /
    // data-start-rot на самом элементе.
    scatterPattern: [
      { y: "65vw",  x: "0vw", rot: 0 },
      { y: "-22vw", x: "0vw", rot: 0 },
      { y: "82vw",  x: "0vw", rot: 0 },
      { y: "-30vw", x: "0vw", rot: 0 },
      { y: "70vw",  x: "0vw", rot: 0 },
      { y: "-18vw", x: "0vw", rot: 0 }
    ],

    // Снос контейнеров (параллакс). Вход: контейнер опущен → 0.
    // Уход: 0 → вверх. Разные величины grid/column = лёгкий параллакс.
    gridEnterShift: "9vw",
    gridExitShift: "-18vw",
    columnEnterShift: "7.5vw",
    columnExitShift: "-15vw",

    // Easing. .out — мягкое торможение у цели (вход),
    //         .in  — разгон от покоя (уход).
    enterEase: "power2.out",
    exitEase: "power2.in"
  };

  const cards = document.querySelectorAll(".bento_card.is-parallax");
  const stickySection = document.querySelector(".parallax-sticky");
  if (cards.length === 0 || !stickySection) return;

  // Webflow IX2 (data-w-id) на карточках/контейнере может переписывать
  // наш transform — tween идёт, но визуально не виден. Снимаем атрибут.
  cards.forEach(card => card.removeAttribute("data-w-id"));
  stickySection.removeAttribute("data-w-id");
  Array.from(stickySection.children).forEach(child =>
    child.removeAttribute("data-w-id")
  );

  // GSAP двигает только transform (translateY), не CSS top. Чтобы CSS
  // `top` на .is-parallax._1/._4 отрабатывал, карточкам нужен
  // position:relative — иначе top игнорируется (static) и все карточки
  // приезжают в один ряд.
  cards.forEach(card => {
    if (getComputedStyle(card).position === "static") {
      card.style.position = "relative";
    }
  });

  gsap.registerPlugin(ScrollTrigger);

  // start:"top bottom" — старт, как только секция показалась снизу.
  // end:"bottom top"   — конец, когда блок ушёл за верх.
  // scrub:0.5          — лёгкая inertia (не true) для устойчивости при
  //                      внешнем Lenis от 3D-сцены.
  // invalidateOnRefresh:false — иначе Lenis-refresh пересчитывает
  //                      from-values у fromTo и opacity моргает.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".parallax-sticky",
      start: "top bottom",
      end: "bottom top",
      scrub: 0.5,
      invalidateOnRefresh: false
    }
  });

  // Точки старта фаз на timeline.
  // Вход = scatterHold (стоит в разлёте) + enterDuration (сбор) + stagger.
  // Сдвигаем паузу и уход, чтобы хвостовые карточки успели собраться,
  // прежде чем начнётся исчезание.
  const staggerTail = CONFIG.scatterEnabled ? CONFIG.enterStaggerSpread : 0;
  const scatterHold = CONFIG.scatterEnabled ? CONFIG.scatterHold : 0;
  const enterStart = 0;
  const holdStart = scatterHold + CONFIG.enterDuration + staggerTail;
  const exitStart = holdStart + CONFIG.holdDuration;

  // ==========================================================
  // ФАЗА 1 — ПОЯВЛЕНИЕ
  // ==========================================================

  // Контейнеры подбираются снизу к 0 (параллакс-вход). Длительность
  // покрывает весь вход вместе со scatterHold и стаггером, чтобы
  // дрейф не закончился раньше последней карточки.
  const enterSpan = scatterHold + CONFIG.enterDuration + staggerTail;

  tl.fromTo(
    ".bento_grid",
    { marginTop: CONFIG.gridEnterShift },
    { marginTop: 0, duration: enterSpan, ease: CONFIG.enterEase },
    enterStart
  );
  tl.fromTo(
    ".bento_column",
    { marginTop: CONFIG.columnEnterShift },
    { marginTop: 0, duration: enterSpan, ease: CONFIG.enterEase },
    enterStart
  );

  cards.forEach((card, i) => {
    // Базовая точка разлёта из паттерна (циклится по индексу карточки).
    const pat = CONFIG.scatterEnabled
      ? CONFIG.scatterPattern[i % CONFIG.scatterPattern.length]
      : { y: CONFIG.enterY, x: "0vw", rot: 0 };

    // Атрибуты на элементе перебивают паттерн.
    const startY = card.getAttribute("data-start-y") || pat.y;
    const startX = card.getAttribute("data-start-x") || pat.x;
    const startRot =
      card.getAttribute("data-start-rot") !== null
        ? parseFloat(card.getAttribute("data-start-rot"))
        : pat.rot;

    // Стаггер по порядку в DOM + опциональная доп. задержка с элемента.
    const stagger = CONFIG.scatterEnabled
      ? (cards.length > 1
          ? (CONFIG.enterStaggerSpread / (cards.length - 1)) * i
          : 0)
      : 0;
    const enterDelay = parseFloat(card.getAttribute("data-enter-delay")) || 0;
    const at = enterStart + stagger + enterDelay;

    // Transform-сбор: с задержкой scatterHold от появления — карточка
    // стоит видимая в разлёте, пока секция выезжает в кадр, и собирается
    // в bento только после того, как полностью вошла в зону взора.
    tl.fromTo(
      card,
      { y: startY, x: startX, rotation: startRot },
      {
        y: 0,
        x: 0,
        rotation: 0,
        duration: CONFIG.enterDuration,
        ease: CONFIG.enterEase,
        force3D: true
      },
      at + scatterHold
    );

    // Opacity: быстрый fade-in В НАЧАЛЕ (без задержки) — карточка
    // появляется в разлёте, дальше едет непрозрачной к bento.
    tl.fromTo(
      card,
      { opacity: 0 },
      {
        opacity: 1,
        duration: CONFIG.enterDuration * CONFIG.enterFadeRatio,
        ease: "power1.out"
      },
      at
    );
  });

  // ==========================================================
  // ПАУЗА — карточки стоят по центру
  // ==========================================================
  tl.to({}, { duration: CONFIG.holdDuration }, holdStart);

  // ==========================================================
  // ФАЗА 2 — ИСЧЕЗАНИЕ (логика сохранена — это то, что нравилось)
  // ==========================================================

  // Контейнеры продолжают дрейф вверх — компаунд с уходом карточек.
  tl.to(
    ".bento_grid",
    { marginTop: CONFIG.gridExitShift, duration: CONFIG.exitDuration, ease: CONFIG.exitEase },
    exitStart
  );
  tl.to(
    ".bento_column",
    { marginTop: CONFIG.columnExitShift, duration: CONFIG.exitDuration, ease: CONFIG.exitEase },
    exitStart
  );

  cards.forEach(card => {
    const endY = card.getAttribute("data-end-y") || CONFIG.exitY;
    const exitDelay = parseFloat(card.getAttribute("data-exit-delay")) || 0;

    // Уход слайдом за верх (-83vw ≈ 1200px — карточка успевает уехать
    // полностью, поэтому opacity не нужен).
    tl.to(
      card,
      { y: endY, duration: CONFIG.exitDuration, ease: CONFIG.exitEase, force3D: true },
      exitStart + exitDelay
    );
  });
});

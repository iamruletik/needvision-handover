/**
 * Карусель кейсов на главной.
 *
 * Новая разметка:
 *   .case_card-wrapper
 *     ├─ .case_tag-text           ← один на всю карусель, fade-swap текста
 *     └─ .case_cards-line         ← двигаем только её, тег остаётся на месте
 *         └─ .case_card[]
 *               ├─ .case_tag-text-base  (display:none — текст-источник)
 *               └─ .case_card-content
 *
 * Drag висит на .case-drag-zone (overlay поверх трека). Один шаг за жест
 * (флаг didStep) — без него Observer.tolerance фаерил onLeft/onRight по
 * каждым 20px и одиночный длинный свайп прыгал в конец/начало.
 *
 * Клик по карточке → активировать (находим карточку под курсором через
 * elementFromPoint, потому что zone её перекрывает).
 * Кастомный курсор-иконка в .case-click-zone ведёт на страницу активного кейса.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("cases-slider.js: GSAP не загружен");
    return;
  }
  if (typeof Observer === "undefined") {
    console.warn("cases-slider.js: Observer не загружен");
    return;
  }

  const slides = document.querySelectorAll('.case_card');
  const slidesArr = Array.from(slides);
  const cardsLine = document.querySelector('.case_cards-line');
  if (slides.length === 0 || !cardsLine) return;

  gsap.registerPlugin(Observer);

  // Синхронизируем количество точек с количеством карточек: в Webflow
  // часто оставляют статичное число dot'ов, которое не совпадает с
  // фактическим количеством слайдов. Лишние — удаляем, недостающие —
  // клонируем из первого как шаблон.
  const dotsContainer = document.querySelector('.cases_slider-dots');
  if (dotsContainer) {
    const existing = Array.from(dotsContainer.querySelectorAll('.cases_slider-dot'));
    const slideCount = slides.length;

    while (existing.length > slideCount) {
      existing.pop().remove();
    }
    if (existing.length > 0 && existing.length < slideCount) {
      const template = existing[0];
      while (existing.length < slideCount) {
        const clone = template.cloneNode(true);
        clone.removeAttribute('data-w-id');
        clone.querySelectorAll('[data-w-id]').forEach(el => el.removeAttribute('data-w-id'));
        clone.classList.remove('active');
        const fullImg = clone.querySelector('.cases_slider-dot-full');
        const emptyImg = clone.querySelector('.cases_slider-dot-empty');
        if (fullImg) fullImg.style.opacity = '0';
        if (emptyImg) emptyImg.style.opacity = '1';
        dotsContainer.appendChild(clone);
        existing.push(clone);
      }
    }
  }

  const dots = document.querySelectorAll('.cases_slider-dot');
  const bgImages = document.querySelectorAll('.case_bg-image');
  const fractionTxt = document.querySelector('.cases_fraction-txt');

  // Единственный тег над линией: текст подменяем из активной .case_tag-text-base.
  // Берём именно того, кто прямой потомок wrapper'а — в карточках лежит
  // .case_tag-text-base, но если вдруг ещё какой-то .case_tag-text есть,
  // мы хотим именно того что снаружи линии.
  const tagTextEl =
    document.querySelector('.case_card-wrapper > .case_tag-text') ||
    document.querySelector('.case_tag-text');

  const clickZone = document.querySelector('.case-click-zone');
  const mouseClickIcon = document.querySelector('.case-mouse-click');

  // ---- Тайминги и константы ----
  // Шаг = ширина .case_card-content (24vw) + gap в .case_cards-line (1vw).
  // Линия живёт в wrapper'е (24vw, центрирован в track'е), карточки
  // начинаются от левого края → первая карточка уже отцентрована в
  // вьюпорте, каждая следующая = шаг линии -25vw.
  const SLIDE_STEP_VW = 25;
  const TRACK_DURATION = 0.8;
  const CONTENT_DURATION = 0.4;
  const HOVER_DURATION = 0.4;
  const BG_DURATION = 0.8;
  const DOT_DURATION = 0.4;
  const TAG_FADE_DURATION = 0.35;
  const DRAG_MIN = 10;
  const DRAG_TOLERANCE = 20;

  // Цвет белой обводки. На hover уводим в прозрачную.
  const IDLE_BORDER = "#ffffff";
  const HOVER_BORDER = "rgba(255,255,255,0)";
  // Hover-фон для НЕактивной карточки: серый. Текст не трогаем.
  const IDLE_BG = "#ffffff";
  const HOVER_BG = "#8F8E84";

  let activeIndex = 0;
  const totalSlides = slides.length;

  gsap.set(bgImages, { opacity: 0 });

  // Webflow IX2 на линии/карточках/wrapper'е иногда перебивает transform
  // и opacity — снимаем атрибуты, как в других модулях.
  const wrapper = cardsLine.parentElement;
  if (wrapper) wrapper.removeAttribute('data-w-id');
  cardsLine.removeAttribute('data-w-id');
  slides.forEach(s => s.removeAttribute('data-w-id'));
  if (tagTextEl) tagTextEl.removeAttribute('data-w-id');


  // ---- Кастомный курсор в .case-click-zone ----
  if (clickZone && mouseClickIcon) {
    clickZone.style.cursor = 'none';

    mouseClickIcon.style.cssText += `
      position: fixed !important;
      pointer-events: none !important;
      z-index: 9999 !important;
      opacity: 0 !important;
      transform: translate(-50%, -50%) !important;
      transition: opacity 0.2s ease !important;
    `;

    const xTo = gsap.quickTo(mouseClickIcon, "left", { duration: 0.25, ease: "power3.out" });
    const yTo = gsap.quickTo(mouseClickIcon, "top", { duration: 0.25, ease: "power3.out" });

    clickZone.addEventListener('mouseenter', () => { mouseClickIcon.style.opacity = '1'; });
    clickZone.addEventListener('mouseleave', () => { mouseClickIcon.style.opacity = '0'; });
    clickZone.addEventListener('mousemove', (e) => { xTo(e.clientX); yTo(e.clientY); });

    clickZone.addEventListener('click', () => {
      const activeSlide = slides[activeIndex];
      if (!activeSlide) return;
      const link = activeSlide.querySelector('a')?.getAttribute('href')
        || activeSlide.getAttribute('data-href');
      if (link) window.location.href = link;
    });
  }


  // ---- Подмена текста единого .case_tag-text ----
  function updateTagText(index) {
    if (!tagTextEl) return;
    const card = slides[index];
    const base = card?.querySelector('.case_tag-text-base');
    const newText = (base?.textContent || '').trim();
    if (!newText) return;
    if (newText === tagTextEl.textContent.trim()) return;

    gsap.to(tagTextEl, {
      opacity: 0,
      duration: TAG_FADE_DURATION,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => {
        tagTextEl.textContent = newText;
        gsap.to(tagTextEl, {
          opacity: 1,
          duration: TAG_FADE_DURATION + 0.04,
          ease: "power2.out",
          overwrite: "auto"
        });
      }
    });
  }


  function updateSlider(index) {
    // Двигаем линию карточек, а не track — иначе .case_tag-text
    // (живёт в wrapper'е, над линией) ездит вместе с карточками.
    gsap.to(cardsLine, {
      x: `-${index * SLIDE_STEP_VW}vw`,
      duration: TRACK_DURATION,
      ease: "power2.inOut",
      overwrite: "auto"
    });

    if (fractionTxt) {
      fractionTxt.textContent = `${index + 1}/${totalSlides}`;
    }

    dots.forEach((dot, i) => {
      const fullDot = dot.querySelector('.cases_slider-dot-full');
      if (fullDot) {
        gsap.to(fullDot, {
          opacity: i === index ? 1 : 0,
          duration: DOT_DURATION,
          ease: "power2.inOut"
        });
      }
    });

    bgImages.forEach((bg, i) => {
      gsap.to(bg, {
        opacity: i === index ? 1 : 0,
        duration: BG_DURATION,
        ease: "power2.inOut"
      });
    });

    // Стили внутри карточек: active = на тёмном фоне (прозрачный фон,
    // белый текст, белая обводка), idle = белая плашка, чёрный текст,
    // белая обводка (визуально невидима, но на hover уводим в прозрачную).
    slides.forEach((slide, i) => {
      const content = slide.querySelector('.case_card-content');
      const logo = slide.querySelector('.case_client-logo');
      const isActive = i === index;
      if (!content) return;

      if (isActive) {
        gsap.to(content, {
          backgroundColor: "transparent",
          color: "#ffffff",
          borderColor: IDLE_BORDER,
          duration: CONTENT_DURATION,
          overwrite: "auto"
        });
        if (logo) gsap.to(logo, {
          filter: "brightness(0) invert(1)",
          duration: CONTENT_DURATION,
          overwrite: "auto"
        });
      } else {
        gsap.to(content, {
          backgroundColor: "#ffffff",
          color: "#000000",
          borderColor: IDLE_BORDER,
          duration: CONTENT_DURATION,
          overwrite: "auto"
        });
        if (logo) gsap.to(logo, {
          filter: "brightness(0) invert(0)",
          duration: CONTENT_DURATION,
          overwrite: "auto"
        });
      }
    });

    updateTagText(index);
  }


  function nextSlide() {
    if (activeIndex < totalSlides - 1) {
      activeIndex++;
      updateSlider(activeIndex);
    }
  }

  function prevSlide() {
    if (activeIndex > 0) {
      activeIndex--;
      updateSlider(activeIndex);
    }
  }


  // ---- Drag-зона ----
  let dragZone = document.querySelector('.case-drag-zone');
  if (!dragZone || cardsLine.contains(dragZone)) {
    dragZone = cardsLine.parentElement || cardsLine;
  }
  dragZone.style.cursor = 'grab';
  dragZone.style.userSelect = 'none';
  dragZone.style.webkitUserSelect = 'none';

  // Один шаг за один drag-жест. Observer.tolerance фаерит onLeft/onRight
  // каждые TOLERANCE px пройденных в направлении — одиночный длинный
  // свайп без локa прокидывал индекс в конец/начало. Флаг сбрасывается
  // на release.
  let didStep = false;

  Observer.create({
    target: dragZone,
    type: "touch,pointer",
    dragMinimum: DRAG_MIN,
    tolerance: DRAG_TOLERANCE,
    onPress: () => {
      dragZone.style.cursor = 'grabbing';
      didStep = false;
    },
    onRelease: () => {
      dragZone.style.cursor = 'grab';
      didStep = false;
    },
    onLeft: () => {
      if (didStep) return;
      didStep = true;
      nextSlide();
    },
    onRight: () => {
      if (didStep) return;
      didStep = true;
      prevSlide();
    },
    onClick: (self) => {
      const ev = self.event;
      const x = ev?.clientX;
      const y = ev?.clientY;

      let card = null;
      if (x != null && y != null) {
        const prevPE = dragZone.style.pointerEvents;
        dragZone.style.pointerEvents = 'none';
        const under = document.elementFromPoint(x, y);
        dragZone.style.pointerEvents = prevPE;
        card = under?.closest?.('.case_card');
      }
      if (!card) card = ev?.target?.closest?.('.case_card');
      if (!card) return;

      const i = slidesArr.indexOf(card);
      if (i >= 0 && i !== activeIndex) {
        activeIndex = i;
        updateSlider(activeIndex);
      }
    }
  });


  // Hover для НЕактивной карточки: серый фон + обводка в прозрачную.
  // Текст не трогаем (остаётся чёрным как в дефолте). На активной — пас.
  slides.forEach((slide, i) => {
    const content = slide.querySelector('.case_card-content');
    if (!content) return;

    slide.addEventListener('mouseenter', () => {
      if (i === activeIndex) return;
      gsap.to(content, {
        backgroundColor: HOVER_BG,
        borderColor: HOVER_BORDER,
        duration: HOVER_DURATION,
        ease: "power2.out",
        overwrite: "auto"
      });
    });
    slide.addEventListener('mouseleave', () => {
      if (i === activeIndex) return;
      gsap.to(content, {
        backgroundColor: IDLE_BG,
        borderColor: IDLE_BORDER,
        duration: HOVER_DURATION,
        ease: "power2.out",
        overwrite: "auto"
      });
    });
  });


  // ---- Точки-индикаторы ----
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (activeIndex !== i) {
        activeIndex = i;
        updateSlider(activeIndex);
      }
    });
  });


  // Первая отрисовка
  updateSlider(0);
});

/**
 * Слайдер команды. Активная карточка по центру — крупнее остальных.
 *
 * Перед стартом замеряем позиции слотов и разделителей в Webflow-вёрстке,
 * переводим всё в position:absolute и дальше дёргаем только x/bottom/w/h
 * в vw. Так анимация остаётся отзывчивой на любом экране, без перезамера.
 *
 * Тексты роли/цитаты/описания/подпись меняются с лёгким blur (6→0).
 * Управление: кнопка next, клики по карточкам и точкам, mouse-drag и touch.
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof gsap === "undefined") {
    console.warn("team-slider.js: GSAP не загружен");
    return;
  }

  const track = document.querySelector('.team_photo-track');
  const slides = gsap.utils.toArray('.team_photo-slide');
  if (!track || slides.length === 0) return;

  const dividers = gsap.utils.toArray('.team_div');
  const nextBtn = document.querySelector('.team_nav-btn');

  // Синхронизация точек пагинации с количеством слайдов: лишние удаляем,
  // недостающие клоним из первой как шаблон. В Webflow точек обычно
  // ставят фиксированное количество, которое не совпадает с N слайдов.
  const dotsContainer = document.querySelector('.team_pagination');
  if (dotsContainer) {
    const existing = Array.from(dotsContainer.querySelectorAll('.team_dot'));
    const slideCount = slides.length;
    while (existing.length > slideCount) existing.pop().remove();
    if (existing.length > 0 && existing.length < slideCount) {
      const template = existing[0];
      while (existing.length < slideCount) {
        const clone = template.cloneNode(true);
        clone.removeAttribute('data-w-id');
        clone.querySelectorAll('[data-w-id]').forEach(el => el.removeAttribute('data-w-id'));
        const full = clone.querySelector('.team_dot-full');
        const empty = clone.querySelector('.team_dot-empty');
        if (full) full.style.opacity = '0';
        if (empty) empty.style.opacity = '1';
        dotsContainer.appendChild(clone);
        existing.push(clone);
      }
    }
  }

  const dots = gsap.utils.toArray('.team_dot');

  // Кэш — querySelector раньше летел на каждом свиче.
  const slideHeaders = slides.map(s => s.querySelector('.team_member-header'));
  const dotFulls = dots.map(d => d.querySelector('.team_dot-full'));

  const textTargets = {
    role:  document.querySelector('.team_role-text'),
    quote: document.querySelector('.team_quote-text'),
    desc:  document.querySelector('.team_desc-text'),
    sign:  document.querySelector('.team-sign')
  };

  // Номер слайда — во второй .label-wrapper внутри .team_info-meta
  const metaLabels = document.querySelectorAll('.team_info-meta .label-wrapper');
  const numTarget = metaLabels.length > 1
    ? metaLabels[1].querySelectorAll('.label-text')[1]
    : null;

  const ANIM_DURATION = 1.0;
  const ANIM_EASE = "power2.inOut";
  const DRAG_THRESHOLD_MOUSE = 50;
  const DRAG_THRESHOLD_TOUCH = 40;

  const totalSlides = slides.length;
  let isAnimating = false;

  // Снимаем размеры/позиции слотов из Webflow до перехода в absolute.
  // initialActiveIdx = индекс ЦЕНТРАЛЬНОГО (большого) слота — берём из
  // .is-active в Webflow. Это координата СЛОТА, а не карточки.
  let initialActiveIdx = 0;
  slides.forEach((slide, i) => {
    if (slide.classList.contains('is-active')) {
      initialActiveIdx = i;
    }
  });

  // По дефолту активна ПЕРВАЯ карточка (раньше брали ту, что в центре).
  // Слоты не меняем — центральный остаётся initialActiveIdx, но в нём
  // на старте окажется карточка с индексом 0.
  let activeIndex = 0;

  const trackRect = track.getBoundingClientRect();
  const trackCenterX = trackRect.left + trackRect.width / 2;
  const trackBottom = trackRect.bottom;
  const trackHeight = trackRect.height;

  const vw = window.innerWidth / 100;
  const toVw = px => px / vw;

  const slotPositions = slides.map(slide => {
    const rect = slide.getBoundingClientRect();
    return {
      x: toVw(rect.left + rect.width / 2 - trackCenterX),
      bottom: toVw(trackBottom - rect.bottom),
      w: toVw(rect.width),
      h: toVw(rect.height)
    };
  });

  const dividerPositions = dividers.map(div => {
    const rect = div.getBoundingClientRect();
    return {
      x: toVw(rect.left + rect.width / 2 - trackCenterX),
      bottom: toVw(trackBottom - rect.bottom)
    };
  });

  const ACTIVE_W = slotPositions[initialActiveIdx].w;
  const ACTIVE_H = slotPositions[initialActiveIdx].h;
  const ACTIVE_BOTTOM = slotPositions[initialActiveIdx].bottom;

  let SMALL_W, SMALL_H, SMALL_BOTTOM;
  for (let i = 0; i < slotPositions.length; i++) {
    if (i !== initialActiveIdx) {
      SMALL_W = slotPositions[i].w;
      SMALL_H = slotPositions[i].h;
      SMALL_BOTTOM = slotPositions[i].bottom;
      break;
    }
  }

  // Переводим трек и всё внутри в absolute по снятым координатам
  track.style.cssText += `
    display: block !important;
    position: relative !important;
    height: ${toVw(trackHeight)}vw !important;
    width: 100% !important;
    overflow: visible !important;
  `;

  // Ставим карточки в позицию для activeIndex=0 — карточка #0 в
  // центральном слоте (initialActiveIdx), остальные распределяются по
  // другим слотам через getPhysicalSlot. Используем getSlideState чуть
  // ниже определённый, поэтому пока ставим только базовые стили и
  // позиционируем после.
  slides.forEach((slide, i) => {
    slide.classList.remove('is-active');
    const header = slide.querySelector('.team_member-header');
    if (header) header.classList.remove('is-hidden');

    slide.style.cssText += `
      position: absolute !important;
      left: 50% !important;
      min-width: 0 !important;
      max-width: none !important;
      margin: 0 !important;
      transition: none !important;
    `;
  });

  gsap.set(slides, {
    xPercent: -50,
    yPercent: 0,
    transformOrigin: "center bottom"
  });

  // Webflow держит .team_dot-full скрытыми до первого взаимодействия —
  // подсвечиваем первую точку (activeIndex=0).
  dots.forEach((dot, i) => {
    const full = dot.querySelector('.team_dot-full');
    if (full) {
      gsap.set(full, { opacity: i === activeIndex ? 1 : 0 });
    }
  });

  dividers.forEach((div, i) => {
    div.style.cssText += `
      position: absolute !important;
      bottom: ${dividerPositions[i].bottom}vw !important;
      left: 50% !important;
      margin: 0 !important;
      transition: none !important;
    `;
  });

  gsap.set(dividers, {
    xPercent: -50,
    yPercent: 0
  });

  dividers.forEach((div, i) => {
    gsap.set(div, { x: `${dividerPositions[i].x}vw` });
  });

  // Маппинг "какая карточка → в каком физическом слоте" с учётом цикла
  function getPhysicalSlot(cardIndex) {
    let diff = cardIndex - activeIndex;
    if (diff > Math.floor(totalSlides / 2)) diff -= totalSlides;
    if (diff < -Math.floor(totalSlides / 2)) diff += totalSlides;

    let physicalIdx = initialActiveIdx + diff;
    while (physicalIdx < 0) physicalIdx += totalSlides;
    while (physicalIdx >= totalSlides) physicalIdx -= totalSlides;
    return physicalIdx;
  }

  function getSlideState(cardIndex) {
    const physicalSlot = getPhysicalSlot(cardIndex);
    const isActiveSlot = (physicalSlot === initialActiveIdx);

    return {
      x: slotPositions[physicalSlot].x,
      bottom: slotPositions[physicalSlot].bottom,
      w: isActiveSlot ? ACTIVE_W : SMALL_W,
      h: isActiveSlot ? ACTIVE_H : SMALL_H,
      z: isActiveSlot ? 10 : 5,
      headerOpacity: isActiveSlot ? 1 : 0
    };
  }

  // Стартовая раскладка: карточки расставляются по слотам исходя из
  // activeIndex=0, чтобы первая карточка оказалась в центральном
  // большом слоте, а остальные — вокруг.
  const currentSlotByCard = new Array(totalSlides);
  slides.forEach((slide, i) => {
    const state = getSlideState(i);
    currentSlotByCard[i] = getPhysicalSlot(i);

    slide.style.cssText += `
      bottom: ${state.bottom}vw !important;
      width: ${state.w}vw !important;
      height: ${state.h}vw !important;
    `;
    gsap.set(slide, { x: `${state.x}vw`, zIndex: state.z });

    const header = slide.querySelector('.team_member-header');
    if (header) {
      gsap.set(header, { opacity: i === activeIndex ? 1 : 0 });
    }
  });

  // Порог «прыжка через карусель»: если карточка должна перейти в слот,
  // отстоящий больше чем на половину карусели, она бы видимо проползла
  // через весь экран. Прячем такие перемещения через opacity-fade →
  // gsap.set (мгновенный «телепорт» в новый слот) → fade-in. Остальные
  // карточки в этой же итерации едут нормально → визуально получается
  // эффект «бесконечной ленты» (marquee-wrap).
  const WRAP_THRESHOLD = totalSlides / 2;

  function updateSlider(newIndex) {
    if (isAnimating) return;
    isAnimating = true;

    // Запомнить старые слоты ДО смены activeIndex.
    const prevSlots = currentSlotByCard.slice();
    activeIndex = newIndex;
    for (let i = 0; i < totalSlides; i++) {
      currentSlotByCard[i] = getPhysicalSlot(i);
    }

    const tl = gsap.timeline({
      defaults: { duration: ANIM_DURATION, ease: ANIM_EASE },
      onComplete: () => { isAnimating = false; }
    });

    slides.forEach((slide, i) => {
      const state = getSlideState(i);
      const slotDistance = Math.abs(currentSlotByCard[i] - prevSlots[i]);
      const wraps = slotDistance > WRAP_THRESHOLD;

      if (wraps) {
        // Прячем → телепорт → проявляем. Длительности влезают в общий
        // ANIM_DURATION, чтобы вся анимация закончилась синхронно.
        const fadeDur = ANIM_DURATION * 0.3;
        const teleportAt = fadeDur;
        const showAt = ANIM_DURATION - fadeDur;

        tl.to(slide, { opacity: 0, duration: fadeDur, ease: "power2.in" }, 0);
        tl.set(slide, {
          x: `${state.x}vw`,
          bottom: `${state.bottom}vw`,
          width: `${state.w}vw`,
          height: `${state.h}vw`,
          zIndex: state.z
        }, teleportAt);
        tl.to(slide, { opacity: 1, duration: fadeDur, ease: "power2.out" }, showAt);
      } else {
        tl.to(slide, {
          x: `${state.x}vw`,
          bottom: `${state.bottom}vw`,
          width: `${state.w}vw`,
          height: `${state.h}vw`,
          zIndex: state.z
        }, 0);
      }

      const header = slideHeaders[i];
      if (header) {
        tl.to(header, {
          opacity: state.headerOpacity,
          duration: ANIM_DURATION * 0.5,
          ease: "power2.out"
        }, state.headerOpacity === 1 ? ANIM_DURATION * 0.5 : 0);
      }
    });

    dotFulls.forEach((full, index) => {
      if (!full) return;
      tl.to(full, {
        opacity: index === activeIndex ? 1 : 0,
        duration: 0.3
      }, 0);
    });

    updateTexts(slides[activeIndex], activeIndex + 1);
  }

  function updateTexts(activeSlide, currentNum) {
    const newRole = activeSlide.querySelector('.team_data-role')?.innerHTML || '';
    const newQuote = activeSlide.querySelector('.team_data-quote')?.innerHTML || '';
    const newDesc = activeSlide.querySelector('.team_data-description')?.innerHTML || '';
    const newSignSrc = activeSlide.querySelector('.team_data-sign')?.getAttribute('src') || '';

    const targetRole = textTargets.role;
    const targetQuote = textTargets.quote;
    const targetDesc = textTargets.desc;
    const targetSign = textTargets.sign;
    const targetNum = numTarget;

    const elements = [targetRole, targetQuote, targetDesc, targetSign, targetNum].filter(el => el);
    if (elements.length === 0) return;

    // will-change + backface-visibility — иначе blur даёт «квадрат» на ретине
    elements.forEach(el => {
      el.style.willChange = "filter, transform, opacity";
      el.style.backfaceVisibility = "hidden";
    });

    const tl = gsap.timeline({
      onComplete: () => {
        // will-change держим только на время анимации
        elements.forEach(el => { el.style.willChange = "auto"; });
      }
    });

    // Уход
    tl.to(elements, {
      y: "-0.69vw",
      opacity: 0,
      filter: "blur(6px)",
      duration: 0.4,
      stagger: 0.04,
      ease: "power2.in"
    });

    // Подмена контента в невидимом состоянии
    tl.call(() => {
      if (targetRole) targetRole.innerHTML = newRole;
      if (targetQuote) targetQuote.innerHTML = newQuote;
      if (targetDesc) targetDesc.innerHTML = newDesc;
      if (targetNum) targetNum.innerHTML = currentNum;
      if (targetSign && newSignSrc) {
        targetSign.src = newSignSrc;
        targetSign.removeAttribute('srcset');
      }
    });

    // Появление
    tl.fromTo(elements,
      {
        y: "0.69vw",
        opacity: 0,
        filter: "blur(6px)"
      },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.6,
        stagger: 0.04,
        ease: "power2.out"
      }
    );
  }

  // Управление: кнопка, клики, drag/touch
  function nextSlide() { updateSlider((activeIndex + 1) % totalSlides); }
  function prevSlide() { updateSlider((activeIndex - 1 + totalSlides) % totalSlides); }

  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => {
      if (i !== activeIndex && !isAnimating) updateSlider(i);
    });
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      if (i !== activeIndex && !isAnimating && i < totalSlides) updateSlider(i);
    });
  });

  let startX = 0;
  let isDragging = false;

  track.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isDragging = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.clientX;
    if (diff > DRAG_THRESHOLD_MOUSE) nextSlide();
    if (diff < -DRAG_THRESHOLD_MOUSE) prevSlide();
  });

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const diff = startX - e.changedTouches[0].clientX;
    if (diff > DRAG_THRESHOLD_TOUCH) nextSlide();
    if (diff < -DRAG_THRESHOLD_TOUCH) prevSlide();
  });
});

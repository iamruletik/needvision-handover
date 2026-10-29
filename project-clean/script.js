const AUTO_ADVANCE_MS = 20000;
const FLIP_DURATION_MS = 820;
const TEXT_DURATION_MS = 760;
const ARROW_ICON_URL = "./assets/arrow.svg";

const digitAssets = {
  "0": {
    src: "./assets/digit-0.svg",
    width: 49.68,
    height: 89.04,
    left: 21.49,
    top: 13.52,
  },
  "1": {
    src: "./assets/digit-1.svg",
    width: 29.88,
    height: 84,
    left: 31.39,
    top: 15.04,
  },
  "2": {
    src: "./assets/digit-2.svg",
    width: 49.681,
    height: 86.521,
    left: 20.29,
    top: 12.48,
  },
  "3": {
    src: "./assets/digit-3.svg",
    width: 49.924,
    height: 89.04,
    left: 21.37,
    top: 13.52,
  },
  "5": {
    src: "./assets/digit-5.svg",
    width: 50.063,
    height: 86.521,
    left: 21.77,
    top: 15.04,
  },
};

const states = [
  {
    number: "120",
    title: "рабочих часов",
    copy: "в среднем уделяем каждому",
    activeIndex: 0,
  },
  {
    number: "200",
    title: "единиц контента",
    copy: "за данное время",
    activeIndex: 1,
  },
  {
    number: "005",
    title: "встреч",
    copy: "с отчетом и аналиткой",
    activeIndex: 2,
  },
  {
    number: "031",
    title: "ежедневная проверка",
    copy: "рекламных кампаний специалистами",
    activeIndex: 3,
  },
];

const titleTrack = document.querySelector("#titleTrack");
const copyTrack = document.querySelector("#copyTrack");
const stepperNode = document.querySelector("#stepper");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const prevArrow = document.querySelector("#prevArrow");
const nextArrow = document.querySelector("#nextArrow");
const digitCards = [...document.querySelectorAll(".digit-card")];
const digitNodeCache = new Map();

let currentIndex = 0;
let autoAdvanceId = null;
let textTimers = [];

function buildDigitCard(card, value) {
  card.replaceChildren(createSegmentDisplay());
  setSettledDigit(card, value);
  card.dataset.currentDigit = value;
  card.dataset.animating = "false";
  card.classList.add("is-settled");
}

function createSegmentDisplay() {
  const wrapper = document.createElement("div");
  wrapper.className = "segment-display";

  const top = document.createElement("div");
  top.className = "segment-display__top";

  const bottom = document.createElement("div");
  bottom.className = "segment-display__bottom";

  const overlay = document.createElement("div");
  overlay.className = "segment-overlay";

  const overlayTop = document.createElement("div");
  overlayTop.className = "segment-overlay__top";

  const overlayBottom = document.createElement("div");
  overlayBottom.className = "segment-overlay__bottom";

  overlay.append(overlayTop, overlayBottom);
  wrapper.append(top, bottom, overlay);
  return wrapper;
}

function renderDigit(value, part) {
  const asset = digitAssets[value];
  const top = part === "bottom" ? asset.top - 57 : asset.top;
  return `
    <div class="digit-shape digit-shape--${part}">
      <img
        class="digit-shape__img"
        alt=""
        src="${asset.src}"
        style="width:${asset.width}px;height:${asset.height}px;left:${asset.left}px;top:${top}px"
      />
    </div>
  `;
}

function createDigitNode(value, part) {
  const key = `${value}-${part}`;

  if (!digitNodeCache.has(key)) {
    const template = document.createElement("template");
    template.innerHTML = renderDigit(value, part).trim();
    digitNodeCache.set(key, template.content.firstElementChild);
  }

  return digitNodeCache.get(key).cloneNode(true);
}

function updateButtons() {
  prevButton.classList.toggle("is-hidden", currentIndex === 0);
}

function renderStepper(activeIndex) {
  stepperNode.replaceChildren();

  states.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = "stepper__dot";
    if (index === activeIndex) {
      dot.classList.add("is-active");
    }
    stepperNode.appendChild(dot);
  });
}

function createTextLine(content, type, phase = "is-current") {
  const line = document.createElement("p");
  line.className = `text-line text-line--${type} ${phase}`;
  line.textContent = content;
  return line;
}

function clearTextTimers() {
  textTimers.forEach((timer) => window.clearTimeout(timer));
  textTimers = [];
}

function syncTrackHeight(track, type) {
  track.style.height = type === "title" ? "14px" : "29px";
}

function animateText(track, nextText, type, immediate = false) {
  syncTrackHeight(track, type);

  if (immediate || !track.firstElementChild) {
    track.replaceChildren(createTextLine(nextText, type));
    return;
  }

  const currentLine = track.querySelector(".text-line.is-current");
  const nextLine = createTextLine(nextText, type, "is-entering");

  if (currentLine && currentLine.textContent === nextText) {
    return;
  }

  if (currentLine) {
    currentLine.classList.remove("is-current");
    currentLine.classList.add("is-leaving");
  }

  track.appendChild(nextLine);

  const timer = window.setTimeout(() => {
    track.replaceChildren(createTextLine(nextText, type));
  }, TEXT_DURATION_MS);

  textTimers.push(timer);
}

function getTimeSegmentElements(card) {
  const segmentDisplay = card.querySelector(".segment-display");
  const segmentDisplayTop = segmentDisplay.querySelector(".segment-display__top");
  const segmentDisplayBottom = segmentDisplay.querySelector(".segment-display__bottom");
  const segmentOverlay = segmentDisplay.querySelector(".segment-overlay");
  const segmentOverlayTop = segmentOverlay.querySelector(".segment-overlay__top");
  const segmentOverlayBottom = segmentOverlay.querySelector(".segment-overlay__bottom");

  return {
    segmentDisplayTop,
    segmentDisplayBottom,
    segmentOverlay,
    segmentOverlayTop,
    segmentOverlayBottom,
  };
}

function updateSegmentFace(element, value, part) {
  element.replaceChildren(createDigitNode(value, part));
}

function setSettledDigit(card, value) {
  const {
    segmentDisplayTop,
    segmentDisplayBottom,
    segmentOverlayTop,
    segmentOverlayBottom,
  } = getTimeSegmentElements(card);

  updateSegmentFace(segmentDisplayTop, value, "top");
  updateSegmentFace(segmentDisplayBottom, value, "bottom");
  updateSegmentFace(segmentOverlayTop, value, "top");
  updateSegmentFace(segmentOverlayBottom, value, "bottom");
}

function flipDigit(card, nextValue, immediate = false) {
  if (!card.querySelector(".segment-display") || immediate) {
    buildDigitCard(card, nextValue);
    return;
  }

  if (card.dataset.animating === "true") {
    settleDigit(card, card.dataset.nextDigit || card.dataset.currentDigit);
  }

  const currentValue = card.dataset.currentDigit;
  if (currentValue === nextValue) {
    return;
  }

  const segmentElements = getTimeSegmentElements(card);

  card.dataset.animating = "true";
  card.dataset.nextDigit = nextValue;
  card.classList.remove("flip", "is-settled");

  updateSegmentFace(segmentElements.segmentDisplayTop, nextValue, "top");
  updateSegmentFace(segmentElements.segmentDisplayBottom, currentValue, "bottom");
  updateSegmentFace(segmentElements.segmentOverlayTop, currentValue, "top");
  updateSegmentFace(segmentElements.segmentOverlayBottom, nextValue, "bottom");
  segmentElements.segmentOverlayTop.style.visibility = "visible";
  segmentElements.segmentOverlayBottom.style.visibility = "visible";

  void card.offsetWidth;
  card.classList.add("flip");
}

function settleDigit(card, value) {
  if (!value) {
    return;
  }

  const segmentElements = getTimeSegmentElements(card);
  updateSegmentFace(segmentElements.segmentDisplayTop, value, "top");
  updateSegmentFace(segmentElements.segmentDisplayBottom, value, "bottom");

  card.dataset.currentDigit = value;
  card.dataset.animating = "false";
  card.dataset.nextDigit = "";
  card.classList.add("is-settled");
  segmentElements.segmentOverlayTop.style.visibility = "hidden";
  segmentElements.segmentOverlayBottom.style.visibility = "hidden";
  window.requestAnimationFrame(() => {
    card.classList.remove("flip");
  });
}

function renderState(state, { immediate = false } = {}) {
  updateButtons();
  renderStepper(state.activeIndex);
  animateText(titleTrack, state.title, "title", immediate);
  animateText(copyTrack, state.copy, "copy", immediate);

  state.number.split("").forEach((digit, index) => {
    const card = digitCards[index];
    if (!card) {
      return;
    }
    flipDigit(card, digit, immediate);
  });
}

function setState(nextIndex, options = {}) {
  clearTextTimers();
  currentIndex = (nextIndex + states.length) % states.length;
  renderState(states[currentIndex], options);
}

function resetAutoAdvance() {
  window.clearInterval(autoAdvanceId);
  autoAdvanceId = window.setInterval(() => {
    setState(currentIndex + 1);
  }, AUTO_ADVANCE_MS);
}

function handleManualChange(direction) {
  setState(currentIndex + direction);
  resetAutoAdvance();
}

prevButton.addEventListener("click", () => handleManualChange(-1));
nextButton.addEventListener("click", () => handleManualChange(1));

digitCards.forEach((card) => {
  card.addEventListener("animationend", (event) => {
    if (
      event.target.classList.contains("segment-overlay__bottom") &&
      card.dataset.animating === "true"
    ) {
      settleDigit(card, card.dataset.nextDigit);
    }
  });
});

prevArrow.src = ARROW_ICON_URL;
nextArrow.src = ARROW_ICON_URL;

function preloadAssets() {
  const urls = [...new Set([
    ARROW_ICON_URL,
    ...Object.values(digitAssets).map((asset) => asset.src),
  ])];

  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = src;
        }),
    ),
  );
}

preloadAssets().then(() => {
  setState(0, { immediate: true });
  resetAutoAdvance();
});

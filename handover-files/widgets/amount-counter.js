/**
 * Счётчик-барабан (Odometer) на всех .amount-counter и .menu_amount-counter.
 * Один общий currentAmount + один таймер: все счётчики идут в ноль-в-ноль,
 * не расходятся. Каждые 15–20 сек +15.
 */

(() => {
  const START_AMOUNT = 400800400;
  const INCREMENT = 15;
  const MIN_INTERVAL_MS = 15000;
  const MAX_INTERVAL_MS = 20000;
  const ODOMETER_WAIT_MAX_MS = 3000;
  const ODOMETER_WAIT_STEP_MS = 100;
  const STYLE_FLAG = "data-need-vision-amount-counter-styles";

  // Защита от двойного запуска (если скрипт вставлен дважды)
  let initialized = false;
  let tickTimer = null;

  function randomInterval() {
    return Math.floor(
      Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1)
    ) + MIN_INTERVAL_MS;
  }

  function injectStyles() {
    if (document.head.querySelector(`style[${STYLE_FLAG}]`)) return;

    const style = document.createElement("style");
    style.setAttribute(STYLE_FLAG, "");
    style.textContent = `
      .odometer.odometer-auto-theme .odometer-digit-separator,
      .odometer .odometer-digit-separator {
        display: inline-block !important;
        width: 0.35em !important;
      }
      .odometer.odometer-auto-theme, .odometer {
        font-family: inherit;
      }
    `;
    document.head.appendChild(style);
  }

  function setupCounters() {
    if (initialized) {
      console.warn("amount-counter.js: повторная инициализация, пропускаем");
      return;
    }

    const nodes = [
      ...document.querySelectorAll(".amount-counter"),
      ...document.querySelectorAll(".menu_amount-counter")
    ];

    if (nodes.length === 0) return;

    injectStyles();

    let currentAmount = START_AMOUNT;

    const odometers = nodes.map((el) => new Odometer({
      el: el,
      value: currentAmount,
      // ( ddd) — формат Odometer для группировки разделителем-пробелом
      format: "( ddd)",
      theme: "minimal"
    }));

    initialized = true;

    if (tickTimer) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }

    function tick() {
      currentAmount += INCREMENT;
      odometers.forEach((od) => od.update(currentAmount));
      tickTimer = setTimeout(tick, randomInterval());
    }

    tickTimer = setTimeout(tick, randomInterval());
  }

  // Скрипт может загрузиться раньше Odometer — ждём с тайм-аутом
  function waitForOdometer(elapsed = 0) {
    if (typeof Odometer !== "undefined") {
      setupCounters();
      return;
    }

    if (elapsed >= ODOMETER_WAIT_MAX_MS) {
      console.warn(`amount-counter.js: Odometer не загрузился за ${ODOMETER_WAIT_MAX_MS}мс`);
      return;
    }

    setTimeout(() => waitForOdometer(elapsed + ODOMETER_WAIT_STEP_MS), ODOMETER_WAIT_STEP_MS);
  }

  function boot() {
    waitForOdometer();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

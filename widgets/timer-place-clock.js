/**
 * .timer-place всегда "BATUMI". .timer-time = текущее время по Asia/Tbilisi.
 * Никакой геолокации и локального времени браузера.
 *
 * querySelectorAll, чтобы покрыть и шапку, и футер, и любые будущие копии.
 */

function bootTimerPlaceClock() {
  const CITY = "BATUMI";
  const TIMEZONE = "Asia/Tbilisi";
  const TIME_UPDATE_MS = 60000;

  const placeElements = document.querySelectorAll(".timer-place");
  placeElements.forEach(el => { el.textContent = CITY; });

  const timeElements = document.querySelectorAll(".timer-time");
  if (timeElements.length === 0) return;

  // Форматтер тяжёлый — кэшируем один раз
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  function updateTime() {
    // Intl выдаёт "4:45 PM" — приводим к нижнему регистру под дизайн
    const raw = formatter.format(new Date());
    const formatted = raw.replace(/AM$/i, "am").replace(/PM$/i, "pm");
    timeElements.forEach(el => { el.textContent = formatted; });
  }

  updateTime();
  setInterval(updateTime, TIME_UPDATE_MS);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootTimerPlaceClock);
} else {
  bootTimerPlaceClock();
}

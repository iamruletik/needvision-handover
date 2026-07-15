# Need Vision — кастомные скрипты для Webflow (handover)

Архив с кастомным JavaScript / CSS, который запускает анимации и интерактив на сайте **needvision.com**. Сайт собран на **Webflow**, скрипты хостятся на **Cloudflare Workers** (`https://needvision.aoxuaio.workers.dev/...`) и подключаются прямым `<script src="…">` в Webflow → Site Settings → Custom Code.

Этот README — для разработчика клиента: что есть, что делает, как подключать, что важно знать.

---

## Стек

- **Платформа:** Webflow (вёрстка + базовые стили)
- **JS:** vanilla + GSAP 3.12.5 (плагины ScrollTrigger, Observer), Lenis 1.0.29 (smooth scroll), Odometer 0.4.7 (счётчики)
- **CSS:** небольшой `custom.css` поверх Webflow
- **Хостинг скриптов:** Cloudflare Workers (см. `wrangler.jsonc`) — статика отдаётся напрямую как HTTP-файлы

Сборки/бандлера нет: каждый файл подключается отдельным `<script src>`. Все скрипты:
- обёрнуты в `DOMContentLoaded`,
- делают `typeof gsap === "undefined"` гард,
- проверяют наличие основных селекторов и тихо выходят, если их нет.

---

## Как подключать в Webflow

### `Site Settings → Custom Code → Head Code`

Содержимое `webflow/head-code.html` — крошечный inline `<style>`, делающий прелоудер видимым с первого кадра (до загрузки `preloader.js`).

### `Site Settings → Custom Code → Footer Code`

Содержимое `webflow/footer-code.html` — готовый блок с подключением всех библиотек и скриптов в правильном порядке. Скопировать as-is.

Текущие URL'ы указывают на Cloudflare Workers (`https://needvision.aoxuaio.workers.dev/...`). Если будете хостить сами — замените домен на свой; пути внутри домена совпадают со структурой папок этого архива.

**Важен порядок:**
1. GSAP + плагины (CDN)
2. Lenis (CDN)
3. Odometer (CDN)
4. `styles/custom.css` (наш)
5. `widgets/smooth-scroll.js` (инициализация Lenis — должен идти ДО любых ScrollTrigger-скриптов, иначе scrub-анимации отстают)
6. Остальные скрипты Need Vision

---

## Что делает каждый файл

### `navigation/` — навигация

| Файл | Что делает |
|---|---|
| `nav-scroll.js` | Сжатие верхней навигации в плашку при скролле, открытие/закрытие меню с border-radius transition, синхронизация PROFIT-счётчика. **Самый большой файл** — содержит всю state-machine навигации, плюс click-handler меню, плюс scrub-таймлайн уменьшения нав-бара. |
| `nav-cta-invert.js` | Тематизация плавающей CTA-кнопки (`.nav-cta__btn`) по секциям. Приоритет: **dark > orange > white**. Dark — везде внутри `.about-wrapper` (секции partner / stages / team / footer). Orange — секции с классом `.is-orange-nav`. Белая — дефолт. Пишет стили с `!important` через GSAP color-lerp, чтобы Webflow IX2 не перебивал. |

### `hero/` — первая секция

| Файл | Что делает |
|---|---|
| `hero-image-reveal.js` | Раздвижение hero-картинки из тонкой полоски в полноразмерный кадр. Автоплей один раз когда `.hero-image` появилась в кадре. |
| `hero-exit.js` | Уход hero-текстов (планета, теги, заголовки, подзаголовки) вверх по мере скролла. Прогресс таймлайна привязан напрямую к позиции скролла в зоне `140vw → 200vw`, с lerp-сглаживанием (scrub-эффект с инерцией). Без pin / lock — никаких блокировок скролла. |

### `manifesto/`

| Файл | Что делает |
|---|---|
| `manifesto-text-reveal.js` | Каскадное появление строк манифеста с blur → 0. |

### `bento/`

| Файл | Что делает |
|---|---|
| `bento-parallax-cards.js` | Параллакс bento-карточек: индивидуальные смещения карточек при появлении/уходе. Часть карточек двигаются быстрее общей сетки. |

### `sections/` — отдельные блоки лендинга

| Файл | Что делает |
|---|---|
| `logo-reveal.js` | Появление текстов в `.section-logo` с blur'ом. |
| `logo-grid-swap.js` | Бесконечная подмена 3–4 видимых лого в сетке партнёров из скрытого пула — создаёт ощущение «живой» сетки. |
| `partner-spotlight.js` | Фонарик за курсором в секции `.partner` (через CSS-переменные радиального градиента). |
| `stages-animation.js` | Большой блок «Этапы»: смена фона `.about-wrapper`, fade/blur картинок этапов, барабанная смена текста между карточками. Распределение скролла между карточками — взвешенное: карточке #3 отдано 30% диапазона, остальным трём — по ~23%. |
| `footer-reveal.js` | Маска-выезд `.footer-wrapper` с `yPercent: -100 → 0` по мере появления `.footer` в кадре. Простой scrub. |
| `cases-page.js` | Только для страницы `/cases`. Hover по `.case-row` → подсветка строки + замена preview-картинки в сайдбаре через clip-path inset. Также нумерует строки `01, 02, …`. |

### `sliders/` — слайдеры

| Файл | Что делает |
|---|---|
| `cases-slider.js` | Горизонтальная карусель кейсов с кастомным курсором и drag-управлением через GSAP Observer. |
| `team-slider.js` | **Актуальная версия** team-слайдера. Кастомный, без Swiper. Замер слотов в `vw` для responsive. |
| `team-slider-swiper.js` | **Старая альтернатива** на Swiper 11. В продакшне сейчас НЕ подключён (закомментирован в footer-code.html). Оставлен на случай отката. Если включаете его — отключайте `team-slider.js`, не одновременно. |

### `widgets/` — переиспользуемые виджеты

| Файл | Что делает |
|---|---|
| `smooth-scroll.js` | Инициализация **Lenis** (smooth scroll с инерцией). Крутится в `gsap.ticker`, шлёт updates в ScrollTrigger. Экспортирует `window.lenis` для других скриптов. Перехват клика по `a[href^="#"]` → `lenis.scrollTo`. Проверка `alreadyHasLenis()` — если на странице есть встроенная 3D-сцена со своим Lenis (например с Netlify-iframe), второй инстанс не создаётся. |
| `preloader.js` | Прелоудер с циклом 9 иконок (один проход ~2.4с). Минимум один полный цикл показан всегда. Висит пока `document.readyState !== "complete"` ИЛИ пока не появится `window.heroSceneReady = true` (флаг от 3D-сцены) / пока в `.js-canvas-wrapper` не появится `<canvas>`. Локает скролл (`overflow:hidden` + резерв под scrollbar). |
| `page-transitions.js` | Fade-overlay между страницами. Перехватывает клик по внутренним ссылкам → fade-in оверлей → `window.location.href`. Не трогает: внешние ссылки, mailto/tel, `target=_blank`, download, cmd/ctrl-click, якорные `#`. |
| `scroll-reveal.js` | Generic fade-in для любого блока с `data-smooth="true"` (атрибут в Webflow Custom Attributes). `y: 60 → 0`, `opacity: 0 → 1`, `expo.out 1.2s`. Стартовое скрытое состояние держится через `custom.css`. |
| `marquee.js` | Бесшовные бегущие строки — дублирует HTML внутри обёртки и крутит на `-50%`. Для скрытых элементов (свёрнутое меню) старт отложен через ResizeObserver. |
| `amount-counter.js` | Барабан-счётчики суммы (Odometer), +15 каждые 15–20 сек. Независимые экземпляры на каждом матче `.amount-counter` / `.menu_amount-counter`. |
| `timer-place-clock.js` | Определение города по IP (через ipwho.is) + локальные часы 12h. |

### `styles/`

| Файл | Что делает |
|---|---|
| `custom.css` | Поверх Webflow: маска blur для нав-бара, фонарик в `.partner`, размеры слайдов в Swiper-варианте team-слайдера, скрытие `[data-smooth="true"]` до старта `scroll-reveal.js`, overlay перехода страниц. |

### `webflow/` — то, что вставляется в Webflow Custom Code

| Файл | Куда |
|---|---|
| `head-code.html` | Site Settings → Custom Code → **Head Code** |
| `footer-code.html` | Site Settings → Custom Code → **Footer Code** |

---

## CDN зависимости (из `footer-code.html`)

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Observer.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.29/bundled/lenis.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/odometer.js/0.4.7/themes/odometer-theme-minimal.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/odometer.js/0.4.7/odometer.min.js"></script>
```

Swiper (`https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js`) — только если включаете `team-slider-swiper.js` вместо `team-slider.js`.

---

## Хостинг

Сейчас всё лежит на Cloudflare Workers, файл-конфиг — `wrangler.jsonc`. Static-assets-режим: запрос `/widgets/preloader.js` отдаёт файл `widgets/preloader.js` напрямую.

Если хотите перенести на свой хостинг — достаточно положить все файлы по тем же путям относительно домена и заменить `https://needvision.aoxuaio.workers.dev/` в `footer-code.html` на свой URL. Никакой server-side логики нет.

Альтернатива — отдавать через jsDelivr из приватного / своего GitHub:
```
https://cdn.jsdelivr.net/gh/<user>/<repo>@<tag>/widgets/preloader.js
```
(такой вариант использовался ранее — кешируется навсегда по тегу).

---

## Соглашения по коду

- Комментарии — на русском, объясняют **почему**, а не **что**.
- Селекторы Webflow вынесены в константы / шапку файла.
- `typeof gsap === "undefined"` гард перед любым GSAP-вызовом.
- Никаких глобалов — каждый файл в IIFE или `DOMContentLoaded`.
- Тайминги (длительности, easing) — константы в начале файла.
- Где нужно замерить размер после рендера Webflow — двойной `requestAnimationFrame`.
- Где Webflow IX2 (data-w-id) мешает нашим стилям — `removeAttribute("data-w-id")` + `style.setProperty(..., "important")`.

---

## Что важно знать при доработке

1. **Webflow IX2 конфликтует.** Любые анимации, которые Webflow повесил на тот же элемент через Interactions, перебивают наши GSAP-стили. Решение в скриптах: `removeAttribute("data-w-id")` + при необходимости `setTimeout` второй проход (Webflow умеет восстанавливать атрибут). См. `nav-cta-invert.js`, `hero-exit.js`, `stages-animation.js`.

2. **Lenis обязательно через `gsap.ticker`.** Если запустить Lenis на своём rAF — ScrollTrigger будет отставать на 1 кадр и scrub-анимации задёргаются. См. `widgets/smooth-scroll.js`.

3. **`hero-exit.js` не использует pin/ScrollTrigger.create.** Внутри `.hero-main` элементы лежат в sticky-контейнере, и pin с ним конфликтует. Поэтому здесь — ручной rAF с lerp'ом, читающий `window.lenis.scroll`. Если будете менять — сохраняйте этот подход.

4. **Темизация CTA — state-machine с приоритетом.** `nav-cta-invert.js` хранит `Set` оранжевых секций + флаг dark-зоны. Финальный цвет = `dark > orange > white`. Добавление новой оранжевой секции — просто навесить класс `.is-orange-nav` в Webflow, ничего в JS править не нужно.

5. **stages-animation.js**: распределение карточек по скроллу управляется массивом `CARD_WEIGHTS = [1, 1, 1.3, 1]`. Меняйте веса, не трогая остальное.

---

## Структура архива

```
needvision-handover/
├── README.md                      ← этот файл
│
├── webflow/                       ← вставить в Webflow Custom Code
│   ├── head-code.html
│   └── footer-code.html
│
├── styles/
│   └── custom.css
│
├── navigation/
│   ├── nav-scroll.js
│   └── nav-cta-invert.js
│
├── widgets/
│   ├── smooth-scroll.js
│   ├── scroll-reveal.js
│   ├── page-transitions.js
│   ├── preloader.js
│   ├── marquee.js
│   ├── amount-counter.js
│   └── timer-place-clock.js
│
├── hero/
│   ├── hero-image-reveal.js
│   └── hero-exit.js
│
├── manifesto/
│   └── manifesto-text-reveal.js
│
├── bento/
│   └── bento-parallax-cards.js
│
├── sections/
│   ├── logo-reveal.js
│   ├── logo-grid-swap.js
│   ├── partner-spotlight.js
│   ├── stages-animation.js
│   ├── footer-reveal.js
│   └── cases-page.js
│
└── sliders/
    ├── cases-slider.js
    ├── team-slider.js              ← актуальная
    └── team-slider-swiper.js       ← старая альтернатива, в проде НЕ подключена
```

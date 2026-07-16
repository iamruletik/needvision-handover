# Eye SVG Mask Transition

Легкая desktop demo-страница полноэкранного перехода через SVG-маску глаза для дальнейшей вставки в Webflow.

## Файлы

- `index.html` — demo-разметка, полноэкранный trigger, inline SVG и ранний head-скрипт для входящего перехода.
- `styles.css` — overlay, SVG mask, keyframes и стили для lazy debug UI.
- `transition.js` — state machine, demo replay, link interception, Webflow-ready controller.
- `assets/draft.png` — временный фон.
- `assets/eye.svg`, `assets/eye.json`, `assets/eye.mp4` — исходники и референсы, production-код их не загружает.

## Duration

Длительности заданы CSS custom properties:

```css
:root {
  --transition-close-duration: 750ms;
  --transition-open-duration: 416.667ms;
}
```

Эти значения взяты из `eye.json` при 60 FPS: закрытие до кадра `45`, открытие с кадра `45` до `70`.

## Easing

Основные переменные:

```css
--transition-close-ease: cubic-bezier(0.655, 0, 0.111, 1);
--transition-open-ease: cubic-bezier(0.626, 0, 0.35, 1);
```

Отдельные переменные для двух вложенных SVG-групп:

```css
--transition-close-aperture-ease;
--transition-close-cover-ease;
--transition-open-aperture-ease;
--transition-open-cover-ease;
```

Если из After Effects появятся разные кривые для общего scale и вертикального схлопывания, меняйте именно эти четыре переменные.

## Gap

Пауза между состоянием полного черного экрана и открытием:

```css
--transition-gap: 50ms;
```

В debug-режиме gap меняется числовым полем `gap, ms` в `lil-gui` и сразу записывается в CSS-переменную.

## Webflow: Head Code

Вставьте в site-level или page-level `<head>` до первого paint:

```html
<script>
  (function () {
    try {
      if (sessionStorage.getItem('eyeTransitionPending') === '1') {
        document.documentElement.classList.add('has-eye-transition-cover');
      }
    } catch (error) {}
  })();
</script>
```

Также подключите CSS из `styles.css` в `<head>` или вставьте его в Webflow Custom Code.

## Webflow: Before `</body>`

Вставьте overlay-разметку из начала `index.html`:

```html
<div class="eye-transition is-idle" data-eye-transition aria-hidden="true">
  <!-- inline SVG mask из index.html -->
</div>
```

После overlay подключите или вставьте `transition.js` перед `</body>`.

## Атрибуты

- `data-transition-link` — назначить внутренним ссылкам, которые должны переходить через маску.
- `data-transition-trigger` — элемент, клик по которому запускает demo-переход без реальной навигации. В текущем demo этот атрибут стоит на полноэкранном `<main>`.
- `data-transition="off"` — поставить на ссылку или родителя, чтобы отключить перехват.
- `data-transition-debug="true"` — альтернативный способ включить debug-панель на странице.

Контроллер не перехватывает внешние ссылки, `target="_blank"`, `mailto:`, `tel:`, текущие anchors, `download` и клики с Cmd/Ctrl/Shift/Alt.

## Debug-панель lil-gui

`lil-gui` подгружается только в debug-режиме. В текущем demo он включен атрибутом `data-transition-debug="true"` на `<body>`. Панель также можно показать через:

```text
?transition-debug=1
```

или при наличии:

```html
data-transition-debug="true"
```

Внутри панели есть два графика cubic-bezier: `1. Изинг закрытия` и `2. Изинг открытия`. Точки можно менять числовыми контролами `x1/y1/x2/y2` или перетаскиванием белых точек на canvas-графике. Поле `3. Промежуток → gap, ms` задает паузу между закрытием и открытием.

Перед production удалите атрибут `data-transition-debug="true"` с `<body>`, функцию `initDebugPanel(...)`, helper-функции загрузки `lil-gui` и вызов `initDebugPanel(pageTransition)` из `transition.js`. Production-версия не требует MP4, Lottie, GSAP, Canvas, WebGL или внешних animation-библиотек.

## JavaScript API

```js
await pageTransition.close();
await pageTransition.wait();
await pageTransition.open();

pageTransition.play({
  onCovered() {
    // экран полностью черный
  }
});
```

Повторный запуск во время активной анимации возвращает текущий Promise и не создает новый переход.

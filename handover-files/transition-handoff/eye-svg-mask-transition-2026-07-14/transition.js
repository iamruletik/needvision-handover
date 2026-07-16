(function () {
  'use strict';

  var STORAGE_KEY = 'eyeTransitionPending';
  var STATE_CLASSES = ['is-idle', 'is-closing', 'is-covered', 'is-opening'];
  var DEBUG_STORAGE_KEY = 'eyeTransitionDebugSettings';
  var LIL_GUI_JS = 'https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/dist/lil-gui.umd.min.js';
  var LIL_GUI_CSS = 'https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/dist/lil-gui.css';

  function readMs(element, propertyName) {
    var value = getComputedStyle(element).getPropertyValue(propertyName).trim();
    var numeric = parseFloat(value);

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return value.endsWith('s') && !value.endsWith('ms') ? numeric * 1000 : numeric;
  }

  function hasPendingNavigation() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function setPendingNavigation() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (error) {}
  }

  function clearPendingNavigation() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
  }

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
  }

  function isSamePageAnchor(url) {
    return (
      url.hash &&
      url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    );
  }

  function shouldHandleLink(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
      return false;
    }

    if (
      link.hasAttribute('download') ||
      link.target === '_blank' ||
      link.closest('[data-transition="off"]')
    ) {
      return false;
    }

    var href = link.getAttribute('href') || '';

    if (!href || href.charAt(0) === '#' || /^(mailto|tel):/i.test(href)) {
      return false;
    }

    try {
      var url = new URL(href, window.location.href);

      return url.origin === window.location.origin && !isSamePageAnchor(url);
    } catch (error) {
      return false;
    }
  }

  function setStateClass(root, state) {
    STATE_CLASSES.forEach(function (className) {
      root.classList.remove(className);
    });

    if (state === 'waiting') {
      root.classList.add('is-covered');
    } else {
      root.classList.add('is-' + state);
    }

    root.dataset.transitionState = state;
  }

  function EyePageTransition(root, options) {
    this.root = root;
    this.state = options && options.initialState ? options.initialState : 'idle';
    this.pending = null;
    this.waitTimer = 0;
    this.running = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.onAnimationEnd = this.onAnimationEnd.bind(this);

    this.root.addEventListener('animationend', this.onAnimationEnd);
    setStateClass(this.root, this.state);
  }

  EyePageTransition.prototype.setState = function (state) {
    this.state = state;
    setStateClass(this.root, state);
  };

  EyePageTransition.prototype.onAnimationEnd = function (event) {
    if (!this.pending || !this.pending.animationNames.has(event.animationName)) {
      return;
    }

    this.pending.animationNames.delete(event.animationName);

    if (this.pending.animationNames.size > 0) {
      return;
    }

    var pending = this.pending;
    this.pending = null;

    if (pending.phase === 'closing') {
      this.setState('covered');
    } else {
      this.setState('idle');
    }

    pending.resolve();
  };

  EyePageTransition.prototype.close = function () {
    var transition = this;

    if (this.state !== 'idle') {
      return Promise.reject(new Error('Eye transition is already active.'));
    }

    if (this.reducedMotion.matches) {
      this.setState('covered');
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      transition.pending = {
        phase: 'closing',
        resolve: resolve,
        animationNames: new Set(['eye-cover-close', 'eye-aperture-close'])
      };

      transition.setState('closing');
    });
  };

  EyePageTransition.prototype.wait = function (duration) {
    var transition = this;
    var gap = typeof duration === 'number' ? duration : readMs(this.root, '--transition-gap');

    if (this.reducedMotion.matches || gap <= 0) {
      return Promise.resolve();
    }

    this.setState('waiting');
    clearTimeout(this.waitTimer);

    return new Promise(function (resolve) {
      transition.waitTimer = window.setTimeout(function () {
        transition.waitTimer = 0;
        resolve();
      }, gap);
    });
  };

  EyePageTransition.prototype.open = function () {
    var transition = this;

    if (this.state !== 'covered' && this.state !== 'waiting') {
      return Promise.reject(new Error('Eye transition can open only from covered state.'));
    }

    if (this.reducedMotion.matches) {
      this.setState('idle');
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      transition.pending = {
        phase: 'opening',
        resolve: resolve,
        animationNames: new Set(['eye-cover-open', 'eye-aperture-open'])
      };

      transition.setState('opening');
    });
  };

  EyePageTransition.prototype.play = function (options) {
    var transition = this;

    if (this.running) {
      return this.running;
    }

    this.running = this.close()
      .then(function () {
        if (options && typeof options.onCovered === 'function') {
          options.onCovered();
        }

        return transition.wait();
      })
      .then(function () {
        return transition.open();
      })
      .finally(function () {
        transition.running = null;
      });

    return this.running;
  };

  EyePageTransition.prototype.destroy = function () {
    clearTimeout(this.waitTimer);
    this.root.removeEventListener('animationend', this.onAnimationEnd);
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value) {
    return Math.round(value * 1000) / 1000;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadStylesheet(href) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('link[href="' + href + '"]')) {
        resolve();
        return;
      }

      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  }

  function bezierCss(settings, prefix) {
    return 'cubic-bezier(' +
      round(settings[prefix + 'X1']) + ', ' +
      round(settings[prefix + 'Y1']) + ', ' +
      round(settings[prefix + 'X2']) + ', ' +
      round(settings[prefix + 'Y2']) +
    ')';
  }

  function createBezierGraph(folder, settings, prefix, controllers, onChange) {
    var graph = document.createElement('div');
    var canvas = document.createElement('canvas');
    var label = document.createElement('div');
    var activeHandle = null;
    var yMin = -1;
    var yMax = 2;

    graph.className = 'transition-gui-graph';
    label.className = 'transition-gui-css';
    graph.appendChild(canvas);
    graph.appendChild(label);
    folder.domElement.appendChild(graph);

    function cubic(t, p1, p2) {
      var u = 1 - t;
      return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
    }

    function readPoints() {
      return [
        { keyX: prefix + 'X1', keyY: prefix + 'Y1' },
        { keyX: prefix + 'X2', keyY: prefix + 'Y2' }
      ];
    }

    function toCanvasPoint(x, y, width, height, padding) {
      return {
        x: padding + x * (width - padding * 2),
        y: padding + ((yMax - y) / (yMax - yMin)) * (height - padding * 2)
      };
    }

    function fromCanvasPoint(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var padding = 18;
      var x = (clientX - rect.left - padding) / (rect.width - padding * 2);
      var y = yMax - ((clientY - rect.top - padding) / (rect.height - padding * 2)) * (yMax - yMin);

      return {
        x: round(clamp(x, 0, 1)),
        y: round(clamp(y, yMin, yMax))
      };
    }

    function draw() {
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var width = Math.max(1, Math.round(rect.width * dpr));
      var height = Math.max(1, Math.round(rect.height * dpr));
      var padding = 18 * dpr;
      var ctx = canvas.getContext('2d');
      var p1 = toCanvasPoint(settings[prefix + 'X1'], settings[prefix + 'Y1'], width, height, padding);
      var p2 = toCanvasPoint(settings[prefix + 'X2'], settings[prefix + 'Y2'], width, height, padding);
      var start = toCanvasPoint(0, 0, width, height, padding);
      var end = toCanvasPoint(1, 1, width, height, padding);

      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = '#242424';
      ctx.lineWidth = 1 * dpr;
      for (var i = 0; i <= 4; i += 1) {
        var gx = padding + ((width - padding * 2) / 4) * i;
        var gy = padding + ((height - padding * 2) / 4) * i;
        ctx.beginPath();
        ctx.moveTo(gx, padding);
        ctx.lineTo(gx, height - padding);
        ctx.moveTo(padding, gy);
        ctx.lineTo(width - padding, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = '#777';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.strokeStyle = '#7ddfff';
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      for (var t = 0; t <= 1.001; t += 0.02) {
        var point = toCanvasPoint(
          cubic(t, settings[prefix + 'X1'], settings[prefix + 'X2']),
          cubic(t, settings[prefix + 'Y1'], settings[prefix + 'Y2']),
          width,
          height,
          padding
        );

        if (t === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }
      ctx.stroke();

      [start, end, p1, p2].forEach(function (point, index) {
        ctx.fillStyle = index < 2 ? '#666' : '#ffffff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, index < 2 ? 3.5 * dpr : 6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });

      label.textContent = bezierCss(settings, prefix);
    }

    function syncControllers() {
      controllers.forEach(function (controller) {
        controller.updateDisplay();
      });
    }

    canvas.addEventListener('pointerdown', function (event) {
      var rect = canvas.getBoundingClientRect();
      var points = readPoints().map(function (point, index) {
        var canvasPoint = toCanvasPoint(
          settings[point.keyX],
          settings[point.keyY],
          rect.width,
          rect.height,
          18
        );

        return {
          index: index,
          distance: Math.hypot(canvasPoint.x - (event.clientX - rect.left), canvasPoint.y - (event.clientY - rect.top))
        };
      }).sort(function (a, b) {
        return a.distance - b.distance;
      });

      activeHandle = points[0].index;
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    canvas.addEventListener('pointermove', function (event) {
      if (activeHandle === null) {
        return;
      }

      var point = fromCanvasPoint(event.clientX, event.clientY);
      var keys = readPoints()[activeHandle];

      settings[keys.keyX] = point.x;
      settings[keys.keyY] = point.y;
      syncControllers();
      onChange();
      draw();
    });

    canvas.addEventListener('pointerup', function () {
      activeHandle = null;
    });

    canvas.addEventListener('pointercancel', function () {
      activeHandle = null;
    });

    window.addEventListener('resize', draw);
    draw();

    return draw;
  }

  function addBezierFolder(gui, title, settings, prefix, onChange) {
    var folder = gui.addFolder(title);
    var controllers = [
      folder.add(settings, prefix + 'X1', 0, 1, 0.001).name('x1'),
      folder.add(settings, prefix + 'Y1', -1, 2, 0.001).name('y1'),
      folder.add(settings, prefix + 'X2', 0, 1, 0.001).name('x2'),
      folder.add(settings, prefix + 'Y2', -1, 2, 0.001).name('y2')
    ];
    var draw = createBezierGraph(folder, settings, prefix, controllers, onChange);

    controllers.forEach(function (controller) {
      controller.onChange(function () {
        onChange();
        draw();
      });
    });

    folder.open();
  }

  function initDebugPanel(transition) {
    var params = new URLSearchParams(window.location.search);
    var enabled = params.get('transition-debug') === '1' || Boolean(document.querySelector('[data-transition-debug="true"]'));

    if (!enabled) {
      return;
    }

    Promise.all([loadStylesheet(LIL_GUI_CSS), loadScript(LIL_GUI_JS)])
      .then(function () {
        var Gui = window.lil && window.lil.GUI ? window.lil.GUI : window.GUI;
        var saved = {};

        if (!Gui) {
          return;
        }

        try {
          saved = JSON.parse(localStorage.getItem(DEBUG_STORAGE_KEY) || '{}');
        } catch (error) {
          saved = {};
        }

        var settings = {
          closeX1: Number.isFinite(saved.closeX1) ? saved.closeX1 : 0.655,
          closeY1: Number.isFinite(saved.closeY1) ? saved.closeY1 : 0,
          closeX2: Number.isFinite(saved.closeX2) ? saved.closeX2 : 0.111,
          closeY2: Number.isFinite(saved.closeY2) ? saved.closeY2 : 1,
          openX1: Number.isFinite(saved.openX1) ? saved.openX1 : 0.626,
          openY1: Number.isFinite(saved.openY1) ? saved.openY1 : 0,
          openX2: Number.isFinite(saved.openX2) ? saved.openX2 : 0.35,
          openY2: Number.isFinite(saved.openY2) ? saved.openY2 : 1,
          gap: Number.isFinite(saved.gap) ? saved.gap : 50,
          replay: function () {
            transition.play().catch(function () {});
          }
        };

        function saveSettings() {
          try {
            localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify({
              closeX1: settings.closeX1,
              closeY1: settings.closeY1,
              closeX2: settings.closeX2,
              closeY2: settings.closeY2,
              openX1: settings.openX1,
              openY1: settings.openY1,
              openX2: settings.openX2,
              openY2: settings.openY2,
              gap: settings.gap
            }));
          } catch (error) {}
        }

        function applySettings() {
          var gap = Math.max(0, Number(settings.gap) || 0);

          settings.closeX1 = clamp(settings.closeX1, 0, 1);
          settings.closeX2 = clamp(settings.closeX2, 0, 1);
          settings.closeY1 = clamp(settings.closeY1, -1, 2);
          settings.closeY2 = clamp(settings.closeY2, -1, 2);
          settings.openX1 = clamp(settings.openX1, 0, 1);
          settings.openX2 = clamp(settings.openX2, 0, 1);
          settings.openY1 = clamp(settings.openY1, -1, 2);
          settings.openY2 = clamp(settings.openY2, -1, 2);
          settings.gap = gap;

          var closeEase = bezierCss(settings, 'close');
          var openEase = bezierCss(settings, 'open');

          transition.root.style.setProperty('--transition-close-ease', closeEase);
          transition.root.style.setProperty('--transition-close-aperture-ease', closeEase);
          transition.root.style.setProperty('--transition-close-cover-ease', closeEase);
          transition.root.style.setProperty('--transition-open-ease', openEase);
          transition.root.style.setProperty('--transition-open-aperture-ease', openEase);
          transition.root.style.setProperty('--transition-open-cover-ease', openEase);
          transition.root.style.setProperty('--transition-gap', gap + 'ms');
          saveSettings();
        }

        var gui = new Gui({ title: 'Eye transition' });

        gui.domElement.classList.add('transition-gui');
        gui.domElement.addEventListener('click', function (event) {
          event.stopPropagation();
        });

        addBezierFolder(gui, '1. Изинг закрытия', settings, 'close', applySettings);
        addBezierFolder(gui, '2. Изинг открытия', settings, 'open', applySettings);

        var timing = gui.addFolder('3. Промежуток');

        timing.add(settings, 'gap', 0, 2000, 1).name('gap, ms').onChange(applySettings);
        timing.add(settings, 'replay').name('Replay');
        timing.open();
        applySettings();
      })
      .catch(function () {
        console.warn('lil-gui debug controls could not be loaded.');
      });
  }

  function init() {
    var root = document.querySelector('[data-eye-transition]');

    if (!root) {
      return;
    }

    var shouldOpenFromCover = document.documentElement.classList.contains('has-eye-transition-cover') || hasPendingNavigation();
    var pageTransition = new EyePageTransition(root, {
      initialState: shouldOpenFromCover ? 'covered' : 'idle'
    });

    window.pageTransition = pageTransition;

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-transition-trigger]');

      if (trigger) {
        event.preventDefault();
        pageTransition.play().catch(function () {});
        return;
      }

      var link = event.target.closest('[data-transition-link]');

      if (!shouldHandleLink(link, event)) {
        return;
      }

      event.preventDefault();

      pageTransition.close()
        .then(function () {
          setPendingNavigation();
          window.location.href = link.href;
        })
        .catch(function () {});
    });

    document.addEventListener('keydown', function (event) {
      var trigger = event.target.closest('[data-transition-trigger]');

      if (!trigger || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }

      event.preventDefault();
      pageTransition.play().catch(function () {});
    });

    initDebugPanel(pageTransition);

    if (shouldOpenFromCover) {
      var openWhenReady = function () {
        clearPendingNavigation();
        document.documentElement.classList.remove('has-eye-transition-cover');
        pageTransition.open().catch(function () {});
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', openWhenReady, { once: true });
      } else {
        openWhenReady();
      }
    }
  }

  init();
})();

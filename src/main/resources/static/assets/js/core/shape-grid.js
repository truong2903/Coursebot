/* ==========================================================================
   REACT BITS — SHAPE GRID INTERACTIVE BACKGROUND (VANILLA JS PORT)
   Adapted faithfully from @react-bits/ShapeGrid-JS-CSS for Future Campus
   Supports Dark Mode (Deep Space) & Light Mode (Crystal Campus),
   Tab-Visibility Pause, and prefers-reduced-motion.
   ========================================================================== */

(function () {
  var SHAPES = ['square', 'tile', 'hexagon', 'triangle', 'diamond', 'circle', 'cross', 'dot'];
  var DIRECTIONS = {
    right: [1, 0],
    left: [-1, 0],
    up: [0, -1],
    down: [0, 1],
    diagonal: [Math.SQRT1_2, -Math.SQRT1_2],
    none: [0, 0]
  };
  var SQRT3 = Math.sqrt(3);
  var OFFSET = 32768;
  var FAR = 2.5;
  var MAX_PIXELS = 4.5e6;

  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
  function smoothstep(e0, e1, v) {
    var t = clamp((v - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function smootherstep(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function hash(i, j) {
    var s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function keyOf(i, j) { return (i + OFFSET) * 65536 + (j + OFFSET); }

  function fadeMask(amount) {
    if (amount <= 0) return 'none';
    var edge = amount * 22;
    var stops = [];
    for (var k = 0; k <= 8; k++) {
      var t = k / 8;
      stops.push('rgba(0, 0, 0, ' + smootherstep(t).toFixed(3) + ') ' + (t * edge).toFixed(2) + '%');
    }
    var inner = stops.join(', ');
    var outer = stops.slice().reverse().map(function (stop) {
      return stop.replace(/ ([\d.]+)%$/, function (_, val) {
        return ' ' + (100 - parseFloat(val)).toFixed(2) + '%';
      });
    }).join(', ');
    return 'linear-gradient(to right, ' + inner + ', ' + outer + '), linear-gradient(to bottom, ' + inner + ', ' + outer + ')';
  }

  function layoutFor(shape, size) {
    if (shape === 'hexagon') {
      var radius = size / SQRT3;
      return { stepX: radius * 1.5, stepY: size, radius: radius };
    }
    if (shape === 'triangle') {
      var side = (size * 2) / SQRT3;
      return { stepX: side / 2, stepY: size, side: side };
    }
    return { stepX: size, stepY: size };
  }

  function centerOf(shape, layout, i, j) {
    if (shape === 'hexagon') return [i * layout.stepX, j * layout.stepY + (Math.abs(i) % 2 === 1 ? layout.stepY / 2 : 0)];
    if (shape === 'triangle') {
      var up = (((i + j) % 2) + 2) % 2 === 0;
      return [i * layout.stepX, j * layout.stepY + (up ? layout.stepY * (2 / 3) : layout.stepY / 3)];
    }
    if (shape === 'cross' || shape === 'dot') return [i * layout.stepX, j * layout.stepY];
    return [(i + 0.5) * layout.stepX, (j + 0.5) * layout.stepY];
  }

  function traceCell(ctx, shape, layout, size, i, j, x, y, inset) {
    if (shape === 'hexagon') {
      var r = layout.radius - inset;
      for (var k = 0; k < 6; k++) {
        var angle = (Math.PI / 3) * k;
        var px = x + r * Math.cos(angle);
        var py = y + r * Math.sin(angle);
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (shape === 'diamond') {
      var dr = size / 2 - inset;
      ctx.moveTo(x, y - dr);
      ctx.lineTo(x + dr, y);
      ctx.lineTo(x, y + dr);
      ctx.lineTo(x - dr, y);
      ctx.closePath();
    } else if (shape === 'tile') {
      var half = size / 2 - Math.max(inset, size * 0.06);
      var rad = Math.min(half, size * 0.22);
      if (ctx.roundRect) ctx.roundRect(x - half, y - half, half * 2, half * 2, rad);
      else ctx.rect(x - half, y - half, half * 2, half * 2);
    } else {
      var sh = size / 2 - inset;
      ctx.rect(x - sh, y - sh, sh * 2, sh * 2);
    }
  }

  function initShapeGrid() {
    if (!document.body || document.querySelector('.fc-shape-grid-bg')) return;
    var isLogin = document.body.classList.contains('login-body') || Boolean(document.querySelector('body > main.auth-card'));
    var reduce = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var container = document.createElement('div');
    container.className = 'fc-shape-grid-bg shape-grid';
    container.setAttribute('aria-hidden', 'true');
    var mask = fadeMask(isLogin ? 0.72 : 0.85);
    if (mask !== 'none') {
      container.style.maskImage = mask;
      container.style.webkitMaskImage = mask;
      container.style.maskComposite = 'intersect';
      container.style.webkitMaskComposite = 'source-in';
    }

    var canvas = document.createElement('canvas');
    canvas.className = 'shape-grid-canvas';
    container.appendChild(canvas);
    document.body.prepend(container);
    document.body.classList.add('fc-has-shape-grid');

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    function getThemeSettings() {
      var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      return {
        shape: 'hexagon',
        cellSize: isLogin ? 52 : 48,
        lineWidth: 1,
        direction: 'diagonal',
        speed: isLogin ? 0.22 : 0.13,
        lineColor: isDark
          ? (isLogin ? 'rgba(0, 213, 255, 0.10)' : 'rgba(0, 213, 255, 0.075)')
          : (isLogin ? 'rgba(0, 136, 204, 0.11)' : 'rgba(14, 116, 144, 0.085)'),
        hoverColor: isDark ? '#00D5FF' : '#0088CC',
        hoverFillColor: isDark ? '#7965FF' : '#6246EA',
        fillOpacity: isDark ? (isLogin ? 0.20 : 0.14) : (isLogin ? 0.13 : 0.09),
        radius: isLogin ? 2.1 : 1.65,
        trail: 0.62,
        glow: isDark ? (isLogin ? 0.48 : 0.32) : 0.22,
        twinkle: isLogin ? 0.22 : 0.11,
        clickCascade: true,
        intro: true
      };
    }

    var settings = getThemeSettings();
    var state = {
      alive: true,
      raf: 0,
      last: 0,
      time: 0,
      visible: !document.hidden,
      width: 1,
      height: 1,
      ratio: 1,
      offsetX: 0,
      offsetY: 0,
      started: false,
      startedAt: 0,
      inside: false,
      pointerX: 0,
      pointerY: 0,
      spotX: 0,
      spotY: 0,
      spotVX: 0,
      spotVY: 0,
      spotPower: 0,
      lit: new Map(),
      cascades: []
    };

    function resize() {
      var w = Math.max(1, container.clientWidth);
      var h = Math.max(1, container.clientHeight);
      var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      var pixels = w * h * ratio * ratio;
      if (pixels > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / pixels);
      state.width = w;
      state.height = h;
      state.ratio = ratio;
      var pw = Math.max(1, Math.round(w * ratio));
      var ph = Math.max(1, Math.round(h * ratio));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    function nearestCell(s, layout, wx, wy) {
      var ci = Math.round(wx / layout.stepX);
      var cj = Math.round(wy / layout.stepY);
      var best = Infinity;
      var cell = [ci, cj];
      for (var i = ci - 2; i <= ci + 2; i++) {
        for (var j = cj - 2; j <= cj + 2; j++) {
          var c = centerOf(s.shape, layout, i, j);
          var d = (c[0] - wx) * (c[0] - wx) + (c[1] - wy) * (c[1] - wy);
          if (d < best) { best = d; cell = [i, j]; }
        }
      }
      return cell;
    }

    function illuminate(s, layout, dt) {
      var decay = Math.exp(-dt / s.trail);
      state.lit.forEach(function (val, key) {
        var next = val * decay;
        if (next < 0.005) state.lit.delete(key);
        else state.lit.set(key, next);
      });
      if (state.spotPower < 0.01) return;
      var wx = state.spotX + state.offsetX;
      var wy = state.spotY + state.offsetY;
      var reach = Math.max(s.radius, 0.5) * s.cellSize;
      var nearest = nearestCell(s, layout, wx, wy);
      var spanI = Math.ceil(reach / layout.stepX) + 2;
      var spanJ = Math.ceil(reach / layout.stepY) + 2;
      for (var i = nearest[0] - spanI; i <= nearest[0] + spanI; i++) {
        for (var j = nearest[1] - spanJ; j <= nearest[1] + spanJ; j++) {
          var c = centerOf(s.shape, layout, i, j);
          var dist = Math.hypot(c[0] - wx, c[1] - wy);
          var val = smoothstep(reach, reach * 0.15, dist);
          if (i === nearest[0] && j === nearest[1]) val = Math.max(val, 1);
          val *= state.spotPower;
          if (val <= 0.005) continue;
          var key = keyOf(i, j);
          if (val > (state.lit.get(key) || 0)) state.lit.set(key, val);
        }
      }
    }

    function cascadeAt(s, x, y) {
      var best = 0;
      for (var k = 0; k < state.cascades.length; k++) {
        var c = state.cascades[k];
        var ring = Math.round(Math.hypot(x - c.x, y - c.y) / s.cellSize);
        var local = state.time - c.time - ring * 0.052;
        if (local < 0) continue;
        var pulse = Math.exp(-Math.pow(local / 0.085, 2)) * c.power * Math.max(0, 1 - ring / c.reach);
        if (pulse > best) best = pulse;
      }
      return best;
    }

    function draw() {
      var s = settings;
      var layout = layoutFor(s.shape, s.cellSize);
      var size = s.cellSize;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);

      var i0 = Math.floor((state.offsetX - size) / layout.stepX) - 1;
      var i1 = Math.ceil((state.offsetX + state.width + size) / layout.stepX) + 1;
      var j0 = Math.floor((state.offsetY - size) / layout.stepY) - 1;
      var j1 = Math.ceil((state.offsetY + state.height + size) / layout.stepY) + 1;

      var reachHalf = Math.hypot(state.width, state.height) / 2;
      var elapsed = state.time - state.startedAt;
      var introRadius = s.intro && !reduce && elapsed < 1.2 ? elapsed * reachHalf * 1.9 : Infinity;
      var originX = state.width / 2;
      var originY = state.height / 2;
      var centerX = originX + state.offsetX;
      var centerY = originY + state.offsetY;

      ctx.lineWidth = s.lineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = s.lineColor;
      ctx.beginPath();
      for (var i = i0; i <= i1; i++) {
        for (var j = j0; j <= j1; j++) {
          var c = centerOf(s.shape, layout, i, j);
          traceCell(ctx, s.shape, layout, size, i, j, c[0] - state.offsetX, c[1] - state.offsetY, 0);
        }
      }
      ctx.stroke();

      for (var ii = i0; ii <= i1; ii++) {
        for (var jj = j0; jj <= j1; jj++) {
          var cc = centerOf(s.shape, layout, ii, jj);
          var key = keyOf(ii, jj);
          var val = state.lit.get(key) || 0;
          if (state.cascades.length) {
            var pulse = cascadeAt(s, cc[0], cc[1]);
            if (pulse > val) val = pulse;
          }
          if (s.twinkle > 0 && !reduce) {
            var seed = hash(ii, jj);
            var wave = Math.sin(state.time * (0.35 + seed * 0.45) + seed * 40);
            var sparkle = s.twinkle * 0.72 * Math.pow(Math.max(0, wave), 18);
            if (sparkle > val) val = sparkle;
          }
          if (introRadius !== Infinity) {
            var front = introRadius - Math.hypot(cc[0] - centerX, cc[1] - centerY);
            if (front < 0) continue;
            var iw = Math.exp(-Math.pow(front / (size * 1.4), 2)) * 0.65;
            if (iw > val) val = iw;
          }
          if (val <= 0.012) continue;

          var x = cc[0] - state.offsetX;
          var y = cc[1] - state.offsetY;
          ctx.beginPath();
          traceCell(ctx, s.shape, layout, size, ii, jj, x, y, s.lineWidth * 0.5);
          if (s.fillOpacity > 0) {
            ctx.globalAlpha = Math.min(1, val) * s.fillOpacity;
            ctx.fillStyle = s.hoverFillColor;
            ctx.fill();
          }
          ctx.globalAlpha = Math.min(1, val) * 0.78;
          if (s.glow > 0) {
            ctx.shadowColor = s.hoverColor;
            ctx.shadowBlur = s.glow * 14 * val;
          }
          ctx.strokeStyle = s.hoverColor;
          ctx.lineWidth = s.lineWidth;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      state.raf = 0;
      if (!state.alive || !state.visible) return;
      var s = settings;
      var dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 1 / 60;
      state.last = now;
      if (!state.started) {
        state.started = true;
        state.startedAt = state.time;
      }
      state.time += dt;
      if (!reduce) {
        var dir = DIRECTIONS[s.direction] || [0, 0];
        state.offsetX -= dir[0] * s.speed * 60 * dt;
        state.offsetY -= dir[1] * s.speed * 60 * dt;
      }
      var want = state.inside ? 1 : 0;
      state.spotPower += (want - state.spotPower) * (1 - Math.exp(-(want ? 10 : 5) * dt));
      var stiffness = 220;
      var damping = 2 * Math.sqrt(stiffness) * 0.85;
      state.spotVX += (stiffness * (state.pointerX - state.spotX) - damping * state.spotVX) * dt;
      state.spotVY += (stiffness * (state.pointerY - state.spotY) - damping * state.spotVY) * dt;
      state.spotX += state.spotVX * dt;
      state.spotY += state.spotVY * dt;
      illuminate(s, layoutFor(s.shape, s.cellSize), dt);
      state.cascades = state.cascades.filter(function (c) { return state.time - c.time < c.reach * 0.052 + 0.4; });

      draw();

      if (!reduce || state.lit.size > 0 || state.cascades.length > 0 || state.spotPower > 0.01) {
        state.raf = requestAnimationFrame(frame);
      } else {
        state.last = 0;
      }
    }

    function wake() {
      if (!state.raf && state.alive && state.visible) state.raf = requestAnimationFrame(frame);
    }

    window.addEventListener('pointermove', function (e) {
      if (!state.inside && state.spotPower < 0.02) {
        state.spotX = e.clientX;
        state.spotY = e.clientY;
        state.spotVX = 0;
        state.spotVY = 0;
      }
      state.inside = true;
      state.pointerX = e.clientX;
      state.pointerY = e.clientY;
      wake();
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      if (!settings.clickCascade || reduce) return;
      state.cascades.push({
        x: e.clientX + state.offsetX,
        y: e.clientY + state.offsetY,
        time: state.time,
        power: 0.9,
        reach: Math.min(18, Math.hypot(state.width, state.height) / settings.cellSize)
      });
      if (state.cascades.length > 4) state.cascades.shift();
      wake();
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', function () { state.inside = false; });
    window.addEventListener('blur', function () { state.inside = false; });

    document.addEventListener('visibilitychange', function () {
      state.visible = !document.hidden;
      if (state.visible) { state.last = 0; wake(); }
    });

    var ro = new ResizeObserver(function () { resize(); draw(); wake(); });
    ro.observe(container);

    var themeObs = new MutationObserver(function () {
      settings = getThemeSettings();
      draw();
      wake();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    draw();
    wake();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShapeGrid);
  else initShapeGrid();
})();

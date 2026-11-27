/**
 * GooeyNav — Faithful Vanilla WebGL2 ES Module Port of @react-bits/GooeyNav-JS-CSS
 * Renders real-time GLSL 300 es SDF metaball pills, velocity-stretched liquid droplets,
 * smooth spring wobble, sliding hover pill, and dynamic SDF-clipped contrast text overlay.
 * Adapted for vertical sidebar navigation across Student, Lecturer, Training Office & Admin.
 */

const MAX_DROPS = 32;
const MAX_PILLS = 4;
const MARGIN = 48;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uRatio;
uniform vec4 uPills[${MAX_PILLS}];
uniform vec4 uHover;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec2 uTails[${MAX_DROPS}];
uniform vec3 uTints[${MAX_DROPS}];
uniform int uCount;
uniform float uSmooth;
uniform vec3 uPill;
uniform vec4 uHoverColor;
uniform float uShadow;

out vec4 outColor;

float sdPill(vec2 p, vec4 box) {
  vec2 extent = max(box.zw, vec2(0.0));
  float r = min(extent.x, extent.y);
  vec2 q = abs(p - box.xy) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec4 blend(vec4 a, vec4 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.w - a.w) / k, 0.0, 1.0);
  return vec4(mix(b.rgb, a.rgb, h), mix(b.w, a.w, h) - k * h * (1.0 - h));
}

vec4 field(vec2 p) {
  vec4 shape = vec4(uPill, 1e5);
  for (int i = 0; i < ${MAX_PILLS}; i++) {
    vec4 pill = uPills[i];
    if (pill.z <= 0.0) continue;
    shape = blend(shape, vec4(uPill, sdPill(p, pill)), uSmooth);
  }
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uCount) break;
    vec4 drop = uDrops[i];
    if (drop.z <= 0.0) continue;
    float d = sdCapsule(p, drop.xy, drop.xy - uTails[i], drop.z);
    if (d > shape.w + uSmooth) continue;
    shape = blend(shape, vec4(uTints[i], d), uSmooth);
  }
  return shape;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
  vec4 shape = field(p);
  float d = shape.w;
  float aa = max(fwidth(d), 0.35);
  float body = clamp(0.5 - d / aa, 0.0, 1.0);

  vec2 grad = vec2(dFdx(d), -dFdy(d));
  vec2 n = length(grad) > 0.0001 ? normalize(grad) : vec2(0.0, 1.0);
  float rim = (1.0 - smoothstep(0.0, 1.6, -d)) * max(0.0, -n.y) * 0.32;
  vec3 fill = mix(shape.rgb, vec3(1.0), rim) * (1.0 - 0.06 * max(0.0, n.y) * (1.0 - smoothstep(0.0, 6.0, -d)));

  float lifted = field(p - vec2(0.0, 3.0)).w;
  float shadow = (1.0 - smoothstep(-3.0, 9.0, lifted)) * uShadow * (1.0 - body);

  float hover = clamp(0.5 - sdPill(p, uHover) / aa, 0.0, 1.0) * uHoverColor.a;

  vec4 color = vec4(0.0, 0.0, 0.0, shadow);
  color = vec4(uHoverColor.rgb * hover, hover) + color * (1.0 - hover);
  color = vec4(fill * body, body) + color * (1.0 - body);
  outColor = color;
}
`;

const THEME_PALETTES = {
  dark: {
    pill: '#00D5FF',
    activeInk: '#061325',
    tints: ['#00D5FF', '#38E0FF', '#7965FF', '#16D9A5'],
    hover: 'rgba(0, 213, 255, 0.11)',
    shadow: 0.42
  },
  light: {
    pill: '#0088CC',
    activeInk: '#FFFFFF',
    tints: ['#0088CC', '#3A7BFF', '#6246EA', '#00A8E8'],
    hover: 'rgba(0, 136, 204, 0.08)',
    shadow: 0.22
  }
};

const parseColor = value => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (match) {
    const hex = match[1].length === 3 ? match[1].replace(/./g, digit => digit + digit) : match[1];
    return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).concat(1);
  }
  const rgba = /rgba?\(([^)]+)\)/i.exec(String(value));
  if (rgba) {
    const parts = rgba[1].split(',').map(part => parseFloat(part));
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts[3] ?? 1];
  }
  return [1, 1, 1, 1];
};

const clamp01 = value => Math.min(1, Math.max(0, value));

const travelEase = t => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

const bezier = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const pillPath = (x, y, w, h) => {
  if (w <= 0.5 || h <= 0.5) return '';
  const r = Math.min(w, h) / 2;
  return `M${(x + r).toFixed(2)},${y.toFixed(2)}H${(x + w - r).toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(x + w).toFixed(2)},${(y + r).toFixed(2)}V${(y + h - r).toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(x + w - r).toFixed(2)},${(y + h).toFixed(2)}H${(x + r).toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${x.toFixed(2)},${(y + h - r).toFixed(2)}V${(y + r).toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(x + r).toFixed(2)},${y.toFixed(2)}Z`;
};

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const UNIFORMS = [
  'uSize',
  'uRatio',
  'uPills',
  'uHover',
  'uDrops',
  'uTails',
  'uTints',
  'uCount',
  'uSmooth',
  'uPill',
  'uHoverColor',
  'uShadow'
];

const buildPipeline = gl => {
  const program = gl.createProgram();
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(program, name)]));
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return { program, vs, fs, uniforms, buffer, position: gl.getAttribLocation(program, 'aPosition') };
};

export function attachGooeyNav(navEl, options = {}) {
  if (!navEl) return null;

  const {
    itemSelector = '.nav-item, button[data-page]',
    animationTime = 580,
    particleCount = 15,
    timeVariance = 280,
    spread = 42,
    gooeyness = 0.52,
    wobble = 0.52,
    hoverEffect = true
  } = options;

  navEl.classList.add('gooey-nav');

  const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = Boolean(reducedQuery?.matches);

  const canvas = document.createElement('canvas');
  canvas.className = 'gooey-nav__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  const fallback = document.createElement('span');
  fallback.className = 'gooey-nav__fallback';
  fallback.setAttribute('aria-hidden', 'true');

  const overlay = document.createElement('div');
  overlay.className = 'gooey-nav__overlay';
  overlay.setAttribute('aria-hidden', 'true');

  function ensureLayersAttached() {
    if (!navEl.contains(canvas)) navEl.prepend(canvas);
    if (!navEl.contains(fallback)) canvas.after(fallback);
    if (!navEl.contains(overlay)) navEl.appendChild(overlay);
  }
  ensureLayersAttached();

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  const pipeline = gl ? buildPipeline(gl) : null;
  fallback.style.display = pipeline ? 'none' : 'block';
  canvas.style.display = pipeline ? 'block' : 'none';

  const view = { width: 0, height: 0 };
  let items = [];
  let clones = [];
  let rects = [];
  let target = -1;
  const pills = new Map();
  const drops = [];
  const hover = { x: 0, y: 0, w: 0, h: 0, alpha: 0, index: -1 };
  const pillData = new Float32Array(MAX_PILLS * 4);
  const dropData = new Float32Array(MAX_DROPS * 4);
  const tailData = new Float32Array(MAX_DROPS * 2);
  const tintData = new Float32Array(MAX_DROPS * 3);
  let raf = 0;
  let last = 0;
  let disposed = false;

  const settings = {
    animationTime,
    particleCount,
    timeVariance,
    spread,
    gooeyness,
    wobble,
    hoverEffect,
    pillRgb: [0, 0.835, 1, 1],
    tints: [],
    hoverRgb: [0, 0.835, 1, 0.11],
    shadow: 0.42
  };

  function syncTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const pal = isDark ? THEME_PALETTES.dark : THEME_PALETTES.light;
    settings.pillRgb = parseColor(pal.pill);
    settings.tints = pal.tints.map(parseColor);
    settings.hoverRgb = parseColor(pal.hover);
    settings.shadow = pal.shadow;
    navEl.style.setProperty('--gn-pill', pal.pill);
    navEl.style.setProperty('--gn-active-ink', pal.activeInk);
  }

  function queryItems() {
    return Array.from(navEl.querySelectorAll(itemSelector)).filter(el => !el.closest('.gooey-nav__overlay'));
  }

  function findActiveIndex() {
    const idx = items.findIndex(el => el.classList.contains('active'));
    return idx >= 0 ? idx : (items.length ? 0 : -1);
  }

  function rebuildOverlayClones() {
    overlay.innerHTML = '';
    clones = items.map(item => {
      const clone = document.createElement('div');
      clone.className = 'gooey-nav__clone-item';
      clone.innerHTML = item.innerHTML;
      clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      overlay.appendChild(clone);
      return clone;
    });
  }

  function measure() {
    ensureLayersAttached();
    const box = navEl.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    view.width = box.width;
    view.height = box.height;

    const outerWidth = box.width + MARGIN * 2;
    const outerHeight = box.height + MARGIN * 2;
    Object.assign(canvas.style, {
      left: `${-MARGIN}px`,
      top: `${-MARGIN}px`,
      width: `${outerWidth}px`,
      height: `${outerHeight}px`
    });
    const width = Math.max(1, Math.round(outerWidth * ratio));
    const height = Math.max(1, Math.round(outerHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    rects = items.map((item, idx) => {
      const rect = item.getBoundingClientRect();
      const x = rect.left - box.left;
      const y = rect.top - box.top;
      const clone = clones[idx];
      if (clone) {
        const cs = getComputedStyle(item);
        clone.style.left = `${x.toFixed(2)}px`;
        clone.style.top = `${y.toFixed(2)}px`;
        clone.style.width = `${rect.width.toFixed(2)}px`;
        clone.style.height = `${rect.height.toFixed(2)}px`;
        clone.style.padding = cs.padding;
        clone.style.gap = cs.gap;
        clone.style.justifyContent = cs.justifyContent;
        clone.style.fontFamily = cs.fontFamily;
        clone.style.fontSize = cs.fontSize;
        clone.style.lineHeight = cs.lineHeight;
        clone.style.letterSpacing = cs.letterSpacing;
      }
      return { x, y, w: rect.width, h: rect.height };
    });
  }

  // Tight bounding-box scanline tracer for dynamic SDF clip-path during liquid transition
  function trace(boxes, blobs, smooth) {
    if (!boxes.length && !blobs.length) return '';
    let minY = view.height;
    let maxY = 0;
    const pad = smooth + 4;
    for (const box of boxes) {
      minY = Math.min(minY, box.cy - box.hh - pad);
      maxY = Math.max(maxY, box.cy + box.hh + pad);
    }
    for (const blob of blobs) {
      const rPad = blob.r + Math.abs(blob.ty) + pad;
      minY = Math.min(minY, blob.y - rPad);
      maxY = Math.max(maxY, blob.y + rPad);
    }
    const yStart = Math.max(0, Math.floor(minY));
    const yEnd = Math.min(Math.ceil(view.height), Math.ceil(maxY));
    if (yStart >= yEnd) return '';

    const field = (x, y) => {
      let d = 1e5;
      const merge = value => {
        const h = clamp01(0.5 + (0.5 * (value - d)) / smooth);
        d = value + (d - value) * h - smooth * h * (1 - h);
      };
      for (const box of boxes) {
        const r = Math.min(box.hw, box.hh);
        const qx = Math.abs(x - box.cx) - box.hw + r;
        const qy = Math.abs(y - box.cy) - box.hh + r;
        merge(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
      }
      for (const blob of blobs) {
        const px = x - blob.x;
        const py = y - blob.y;
        const bx = -blob.tx;
        const by = -blob.ty;
        const span = bx * bx + by * by;
        const h = span > 0.0001 ? clamp01((px * bx + py * by) / span) : 0;
        const value = Math.hypot(px - bx * h, py - by * h) - blob.r;
        if (value > d + smooth) continue;
        merge(value);
      }
      return d;
    };

    const yStep = 2;
    const xStep = 3;
    const parts = [];
    for (let y = yStart; y < yEnd; y += yStep) {
      const cy = y + yStep * 0.5;
      let previous = field(0, cy);
      let start = previous < 0 ? 0 : null;
      for (let x = xStep; x <= view.width + xStep; x += xStep) {
        const value = field(Math.min(x, view.width), cy);
        if ((previous < 0) !== (value < 0)) {
          const cross = x - xStep + (xStep * previous) / (previous - value);
          if (value < 0) start = cross;
          else if (start !== null) {
            parts.push(`M${start.toFixed(1)},${y}H${cross.toFixed(1)}V${y + yStep}H${start.toFixed(1)}Z`);
            start = null;
          }
        }
        previous = value;
      }
      if (start !== null) {
        parts.push(`M${start.toFixed(1)},${y}H${view.width.toFixed(1)}V${y + yStep}H${start.toFixed(1)}Z`);
      }
    }
    return parts.join('');
  }

  const pill = index => {
    if (!pills.has(index)) pills.set(index, { mass: 0, scale: 0, velocity: 0, outgoing: 0 });
    return pills.get(index);
  };

  const shape = (index, amount) => {
    const rect = rects[index];
    if (!rect || amount <= 0.002 || rect.w <= 0 || rect.h <= 0) return null;
    const h = rect.h * Math.min(1.08, 0.42 + 0.58 * Math.sqrt(Math.max(0, amount)));
    const w = Math.max(h, rect.w * Math.max(0, amount) ** 0.75);
    return { x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h };
  };

  const plan = (drop, index, now, fresh) => {
    const rect = rects[index];
    if (!rect) return;
    const reach = Math.max(0, settings.spread);
    const ex = rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.45;
    const ey = rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.2;
    const base = Math.max(0.15, settings.animationTime / 1000);
    const variance = (Math.random() - 0.5) * (Math.max(0, settings.timeVariance) / 1000);
    const duration = Math.max(0.15, base * (0.62 + Math.random() * 0.32) + variance * 0.6);
    const out = Math.random() * Math.PI * 2;
    const into = Math.random() * Math.PI * 2;
    const burst = reach * (0.65 + Math.random() * 0.55);
    const swing = reach * (0.5 + Math.random() * 0.5);
    const carry = Math.min(duration / 3, 0.12);
    drop.index = index;
    drop.start = now;
    drop.duration = duration;
    drop.path = [
      drop.x,
      drop.y,
      fresh ? drop.x + Math.cos(out) * burst * 1.35 : drop.x + drop.vx * carry,
      fresh ? drop.y + Math.sin(out) * burst * 1.45 : drop.y + drop.vy * carry,
      ex + Math.cos(into) * swing * 1.35,
      ey + Math.sin(into) * swing * 1.45,
      ex,
      ey
    ];
  };

  const emit = (from, to, now) => {
    const source = pills.get(from);
    const rect = rects[from];
    if (!source || !rect || !rects[to]) return;
    const available = source.mass - source.outgoing;
    if (available <= 0.002) return;
    const room = MAX_DROPS - drops.length;
    const count = Math.min(room, Math.max(1, Math.round(Math.max(1, settings.particleCount) * available)));
    if (count <= 0) return;
    const windowSec = Math.max(0.15, settings.animationTime / 1000) * 0.16;
    for (let i = 0; i < count; i++) {
      const mass = available / count;
      source.outgoing += mass;
      drops.push({
        x: rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.58,
        y: rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.28,
        vx: 0,
        vy: 0,
        mass,
        size: 0.78 + Math.random() * 0.42,
        given: 0,
        source: from,
        index: to,
        leave: now + Math.random() * windowSec * 1000,
        emerged: 0,
        absorbed: 0,
        state: 'waiting',
        tint: settings.tints.length ? settings.tints[Math.floor(Math.random() * settings.tints.length)] : null
      });
    }
  };

  const render = () => {
    if (view.width <= 1 || view.height <= 1 || !rects.length) return;
    const height = rects[target]?.h ?? rects[0]?.h ?? 40;
    const smooth = height * (0.18 + 0.5 * clamp01(settings.gooeyness));
    const boxes = [];
    const blobs = [];

    for (const [index, state] of pills) {
      const box = shape(index, state.scale);
      if (box) boxes.push({ cx: box.x + box.w / 2, cy: box.y + box.h / 2, hw: box.w / 2, hh: box.h / 2 });
    }
    for (const drop of drops) {
      if (drop.state === 'waiting') continue;
      const radius = 0.24 * height * drop.size * Math.min(drop.emerged, 1 - drop.absorbed);
      if (radius <= 0.05) continue;
      const speed = Math.hypot(drop.vx, drop.vy);
      const length = Math.min(radius * 1.15, speed * 0.018);
      blobs.push({
        x: drop.x,
        y: drop.y,
        r: radius,
        tx: speed > 0.01 ? (drop.vx / speed) * length : 0,
        ty: speed > 0.01 ? (drop.vy / speed) * length : 0,
        tint: drop.tint
      });
    }

    const settledPill = boxes.length === 1 && !blobs.length;
    if (settledPill) {
      const box = boxes[0];
      overlay.style.clipPath = `path('${pillPath(box.cx - box.hw, box.cy - box.hh, box.hw * 2, box.hh * 2)}')`;
    } else {
      overlay.style.clipPath = `path('${trace(boxes, blobs, smooth) || 'M0,0Z'}')`;
    }
    overlay.style.visibility = boxes.length || blobs.length ? 'visible' : 'hidden';

    if (!pipeline || !gl) {
      const box = shape(target, 1);
      if (box) {
        fallback.style.transform = `translate(${box.x.toFixed(2)}px, ${box.y.toFixed(2)}px)`;
        fallback.style.width = `${box.w.toFixed(2)}px`;
        fallback.style.height = `${box.h.toFixed(2)}px`;
      }
      fallback.style.opacity = box ? '1' : '0';
      return;
    }

    let slot = 0;
    for (const box of boxes) {
      if (slot >= MAX_PILLS) break;
      pillData[slot * 4] = box.cx + MARGIN;
      pillData[slot * 4 + 1] = box.cy + MARGIN;
      pillData[slot * 4 + 2] = box.hw;
      pillData[slot * 4 + 3] = box.hh;
      slot += 1;
    }
    pillData.fill(0, slot * 4);

    let count = 0;
    for (const blob of blobs) {
      if (count >= MAX_DROPS) break;
      dropData[count * 4] = blob.x + MARGIN;
      dropData[count * 4 + 1] = blob.y + MARGIN;
      dropData[count * 4 + 2] = blob.r;
      dropData[count * 4 + 3] = 0;
      tailData[count * 2] = blob.tx;
      tailData[count * 2 + 1] = blob.ty;
      const tint = blob.tint || settings.pillRgb;
      tintData[count * 3] = tint[0];
      tintData[count * 3 + 1] = tint[1];
      tintData[count * 3 + 2] = tint[2];
      count += 1;
    }

    const { program, uniforms, buffer, position } = pipeline;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.uSize, view.width + MARGIN * 2, view.height + MARGIN * 2);
    gl.uniform1f(uniforms.uRatio, canvas.width / Math.max(1, view.width + MARGIN * 2));
    gl.uniform4fv(uniforms.uPills, pillData);
    gl.uniform4f(uniforms.uHover, hover.x + MARGIN, hover.y + MARGIN, hover.w / 2, hover.h / 2);
    gl.uniform4fv(uniforms.uDrops, dropData);
    gl.uniform2fv(uniforms.uTails, tailData);
    gl.uniform3fv(uniforms.uTints, tintData);
    gl.uniform1i(uniforms.uCount, count);
    gl.uniform1f(uniforms.uSmooth, smooth);
    gl.uniform3f(uniforms.uPill, settings.pillRgb[0], settings.pillRgb[1], settings.pillRgb[2]);
    gl.uniform4f(uniforms.uHoverColor, settings.hoverRgb[0], settings.hoverRgb[1], settings.hoverRgb[2], settings.hoverRgb[3] * hover.alpha);
    gl.uniform1f(uniforms.uShadow, settings.shadow);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const frame = now => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const emergeTime = 0.09;
    const absorbTime = 0.12;

    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      if (drop.state === 'waiting') {
        if (now < drop.leave) continue;
        drop.state = 'flying';
        plan(drop, drop.index, now, true);
      }
      if (drop.state === 'flying') {
        drop.emerged = Math.min(1, drop.emerged + dt / emergeTime);
        const source = pills.get(drop.source);
        if (source && drop.given < drop.mass) {
          const step = Math.min(drop.mass * (dt / emergeTime), drop.mass - drop.given);
          source.mass = Math.max(0, source.mass - step);
          source.outgoing = Math.max(0, source.outgoing - step);
          drop.given += step;
        }
        const t = clamp01((now - drop.start) / 1000 / drop.duration);
        const eased = travelEase(t);
        const [x0, y0, x1, y1, x2, y2, x3, y3] = drop.path;
        const x = bezier(x0, x1, x2, x3, eased);
        const y = bezier(y0, y1, y2, y3, eased);
        if (dt > 0) {
          drop.vx = (x - drop.x) / dt;
          drop.vy = (y - drop.y) / dt;
        }
        drop.x = x;
        drop.y = y;
        if (t >= 1) drop.state = 'absorbing';
      }
      if (drop.state === 'absorbing') {
        const step = Math.min(1 - drop.absorbed, dt / absorbTime);
        drop.absorbed += step;
        drop.vx *= 0.8;
        drop.vy *= 0.8;
        const host = pill(drop.index);
        host.mass = Math.min(1, host.mass + drop.mass * step);
        if (drop.absorbed >= 1) drops.splice(i, 1);
      }
    }

    const zeta = reduced ? 1 : 1 - 0.72 * clamp01(settings.wobble);
    const omega = 26;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (const [index, state] of pills) {
      for (let n = 0; n < steps; n++) {
        state.velocity += (omega * omega * (state.mass - state.scale) - 2 * zeta * omega * state.velocity) * h;
        state.scale += state.velocity * h;
      }
      if (index !== target && state.mass <= 0.002 && state.outgoing <= 0.002 && Math.abs(state.scale) < 0.004) {
        pills.delete(index);
      }
    }

    if (hover.index >= 0 && rects[hover.index]) {
      const rect = rects[hover.index];
      const k = 1 - Math.exp(-dt / 0.06);
      hover.x += (rect.x + rect.w / 2 - hover.x) * k;
      hover.y += (rect.y + rect.h / 2 - hover.y) * k;
      hover.w += (rect.w - hover.w) * k;
      hover.h += (rect.h - hover.h) * k;
    }
    const hoverGoal = settings.hoverEffect && hover.index >= 0 && hover.index !== target ? 1 : 0;
    hover.alpha += (hoverGoal - hover.alpha) * (1 - Math.exp(-dt / 0.08));

    render();

    const host = pills.get(target);
    const resting =
      drops.length === 0 &&
      pills.size <= 1 &&
      (!host || (Math.abs(host.mass - host.scale) < 0.0008 && Math.abs(host.velocity) < 0.004));
    const hoverRect = rects[hover.index];
    const hovering =
      Math.abs(hoverGoal - hover.alpha) > 0.003 ||
      (hoverRect && Math.abs(hoverRect.x + hoverRect.w / 2 - hover.x) + Math.abs(hoverRect.y + hoverRect.h / 2 - hover.y) + Math.abs(hoverRect.w - hover.w) > 0.15);

    if (!resting || hovering) {
      raf = requestAnimationFrame(frame);
    } else if (host) {
      host.mass = 1;
      host.scale = 1;
      host.velocity = 0;
      hover.alpha = hoverGoal;
      render();
    }
  };

  const wake = () => {
    if (raf || disposed) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const settle = index => {
    pills.clear();
    drops.length = 0;
    target = index;
    if (index >= 0 && rects[index]) {
      const state = pill(index);
      state.mass = 1;
      state.scale = 1;
      state.velocity = 0;
    }
    render();
  };

  const go = (index, shouldAnimate = true) => {
    if (index < 0 || index === target) return;
    if (!rects[index] || !shouldAnimate || reduced || target < 0) {
      settle(index);
      return;
    }
    const now = performance.now();
    target = index;
    pill(index);
    for (const drop of drops) {
      drop.index = index;
      if (drop.state === 'flying') plan(drop, index, now, false);
      if (drop.state === 'absorbing') {
        drop.state = 'flying';
        drop.mass *= 1 - drop.absorbed;
        drop.absorbed = 0;
        plan(drop, index, now, false);
      }
    }
    for (const from of [...pills.keys()]) {
      if (from !== index) emit(from, index, now);
    }
    wake();
  };

  function syncItems(animateIfSameCount = false) {
    ensureLayersAttached();
    const nextItems = queryItems();
    const sameNodes = nextItems.length === items.length && nextItems.every((el, i) => el === items[i]);

    if (!sameNodes) {
      items = nextItems;
      items.forEach((el, idx) => { el.dataset.gooeyIndex = String(idx); });
      rebuildOverlayClones();
      measure();
      settle(findActiveIndex());
      return;
    }

    const activeIdx = findActiveIndex();
    if (activeIdx !== target) {
      measure();
      go(activeIdx, animateIfSameCount || target >= 0);
    }
  }

  function syncLayout() {
    if (disposed) return;
    measure();
    if (!drops.length) settle(target < 0 ? findActiveIndex() : target);
    else render();
  }

  const onOver = event => {
    const item = event.target.closest('[data-gooey-index]');
    if (!item || !navEl.contains(item) || item.closest('.gooey-nav__overlay')) return;
    const index = Number(item.dataset.gooeyIndex);
    const rect = rects[index];
    if (!rect) return;
    if (hover.alpha < 0.01) {
      hover.x = rect.x + rect.w / 2;
      hover.y = rect.y + rect.h / 2;
      hover.w = rect.w;
      hover.h = rect.h;
    }
    hover.index = index;
    wake();
  };

  const onLeave = () => {
    hover.index = -1;
    wake();
  };

  navEl.addEventListener('pointerover', onOver);
  navEl.addEventListener('pointerleave', onLeave);

  // Watch .active class changes on nav items + child additions (e.g. dynamic workspace menu)
  const navObserver = new MutationObserver(mutations => {
    let classChanged = false;
    let childrenChanged = false;
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        if (!m.target.closest?.('.gooey-nav__overlay')) classChanged = true;
      } else if (m.type === 'childList' && m.target === navEl) {
        childrenChanged = true;
      }
    }
    if (childrenChanged) syncItems(false);
    else if (classChanged) {
      const idx = findActiveIndex();
      if (idx >= 0 && idx !== target) {
        if (!rects[idx] || rects[idx].w <= 0) measure();
        go(idx, true);
      }
    }
  });
  navObserver.observe(navEl, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });

  // Watch Light/Dark theme toggles on <html>
  const themeObserver = new MutationObserver(() => {
    syncTheme();
    render();
    wake();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const resizeObserver = new ResizeObserver(() => {
    syncLayout();
  });
  resizeObserver.observe(navEl);

  const onReducedChange = e => { reduced = e.matches; };
  reducedQuery?.addEventListener?.('change', onReducedChange);

  syncTheme();
  syncItems(false);

  document.fonts?.ready.then(() => {
    if (!disposed) syncLayout();
  });

  return {
    syncItems: () => syncItems(true),
    syncLayout,
    go: idx => go(idx, true),
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      navObserver.disconnect();
      themeObserver.disconnect();
      resizeObserver.disconnect();
      reducedQuery?.removeEventListener?.('change', onReducedChange);
      navEl.removeEventListener('pointerover', onOver);
      navEl.removeEventListener('pointerleave', onLeave);
      if (gl && pipeline) {
        gl.deleteShader(pipeline.vs);
        gl.deleteShader(pipeline.fs);
        gl.deleteBuffer(pipeline.buffer);
        gl.deleteProgram(pipeline.program);
      }
      canvas.remove();
      fallback.remove();
      overlay.remove();
      navEl.classList.remove('gooey-nav');
    }
  };
}

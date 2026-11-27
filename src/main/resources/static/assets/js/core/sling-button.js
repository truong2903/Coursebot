/**
 * SlingButton — Faithful Vanilla ES Module Port of @react-bits/SlingButton-JS-CSS
 * Pull-back slingshot send button with tangent SVG rubber bands, radial tension arc,
 * directional icon aiming, analytical damped spring physics, and launch particle burst.
 */

const GAP = 4;
const SLOP = { fine: 4, coarse: 8 };
const FINGER_MAX = 3000;
const HAND_MAX = 6000;
const CANCEL = 0.5;
const POWER_CAP = 1.5;
const DOT_MS = 300;
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const SVG_NS = 'http://www.w3.org/2000/svg';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rubberband = (o, dim, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

let uidCounter = 0;

/**
 * Analytical closed-form damped harmonic spring to target 0,
 * matching motion/react `{ type: 'spring', duration: 0.4, bounce: recoil, velocity }`.
 */
function runSpringToZero(x0, v0, { duration = 0.4, bounce = 0.2, onUpdate, onComplete }) {
  const zeta = clamp(1 - bounce, 0.25, 0.99);
  const omega0 = (2 * Math.PI) / Math.max(0.15, duration) * 1.25; // ~19.6 rad/s for 0.4s
  const omegaD = omega0 * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const A = x0;
  const B = (v0 + zeta * omega0 * x0) / omegaD;
  const start = performance.now();
  let rafId = 0;
  let stopped = false;

  const step = now => {
    if (stopped) return;
    const t = (now - start) / 1000;
    const env = Math.exp(-zeta * omega0 * t);
    const cos = Math.cos(omegaD * t);
    const sin = Math.sin(omegaD * t);
    const pos = env * (A * cos + B * sin);
    const vel = env * ((-zeta * omega0 * A + omegaD * B) * cos + (-zeta * omega0 * B - omegaD * A) * sin);

    if ((Math.abs(pos) < 0.08 && Math.abs(vel) < 1.5 && t > 0.08) || t > Math.max(duration * 3, 1.4)) {
      onUpdate(0);
      if (onComplete) onComplete();
      return;
    }
    onUpdate(pos);
    rafId = requestAnimationFrame(step);
  };

  rafId = requestAnimationFrame(step);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
    }
  };
}

export function createSlingButton(mountEl, options = {}) {
  if (!mountEl) return null;

  const {
    onSend,
    size = 44,
    strokeWidth = 2.5,
    armAt = 40,
    maxPull = 128,
    launchSpeed = 2400,
    recoil = 0.2,
    flight = 110,
    particles = 14,
    spread = 60,
    axis = 'any',
    tapSends = true,
    disabled: initialDisabled = false,
    ariaLabel = 'Gửi câu hỏi',
    buttonId = 'aiSendBtn',
    title = 'Kéo nút như ná cao su hoặc bấm để gửi (Enter)',
    className = ''
  } = options;

  const reduceMotion = () =>
    Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const R = maxPull;
  const ARM = Math.min(armAt, 0.8 * R);
  const wellR = size / 2 + GAP + strokeWidth;
  const padR = size / 2 - strokeWidth / 2;
  const arcR = wellR;
  const H = wellR + strokeWidth + 2;
  const DOT = Math.max(6, Math.round(size / 7));
  const count = Math.max(0, Math.round(particles));
  const iconSize = Math.round(size * 0.44);
  const hintId = `sling-hint-${++uidCounter}`;

  // Internal state
  let disabled = Boolean(initialDisabled);
  let pxVal = 0;
  let pyVal = 0;
  let grip = null;
  let dir = { ux: 0, uy: -1 };
  let animX = null;
  let animY = null;
  let armed = false;
  let held = false;
  let power = 0;
  let dotPending = false;
  let dotTimer;
  let paintQueued = false;
  let skipClick = false;

  // Build DOM structure (1:1 with React Bits SlingButton)
  const root = document.createElement('span');
  root.className = `sling-button${className ? ` ${className}` : ''}`;
  root.style.setProperty('--sl-size', `${size}px`);
  root.style.setProperty('--sl-svg', `${2 * H}px`);
  root.style.setProperty('--sl-stroke', `${strokeWidth}px`);
  root.style.setProperty('--sl-dot', `${DOT}px`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'sling-button__fx');
  svg.setAttribute('viewBox', `${-H} ${-H} ${2 * H} ${2 * H}`);
  svg.setAttribute('aria-hidden', 'true');

  const fxGroup = document.createElementNS(SVG_NS, 'g');
  fxGroup.setAttribute('class', 'sling-button__tension');
  fxGroup.style.opacity = '0';

  const bandPath = document.createElementNS(SVG_NS, 'path');
  bandPath.setAttribute('class', 'sling-button__band');

  const hotPath = document.createElementNS(SVG_NS, 'path');
  hotPath.setAttribute('class', 'sling-button__band sling-button__band--hot');

  fxGroup.append(bandPath, hotPath);

  const wellCircle = document.createElementNS(SVG_NS, 'circle');
  wellCircle.setAttribute('class', 'sling-button__well');
  wellCircle.setAttribute('r', String(wellR));

  const arcCircle = document.createElementNS(SVG_NS, 'circle');
  arcCircle.setAttribute('class', 'sling-button__arc');
  arcCircle.setAttribute('r', String(arcR));
  arcCircle.setAttribute('pathLength', '1');
  arcCircle.setAttribute('stroke-dasharray', '0 1');
  arcCircle.style.opacity = '0';

  svg.append(fxGroup, wellCircle, arcCircle);
  root.appendChild(svg);

  const dotEls = [];
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'sling-button__dot';
    dot.setAttribute('aria-hidden', 'true');
    root.appendChild(dot);
    dotEls.push(dot);
  }

  const moveEl = document.createElement('span');
  moveEl.className = 'sling-button__move';

  const padBtn = document.createElement('button');
  padBtn.type = 'button';
  if (buttonId) padBtn.id = buttonId;
  padBtn.className = 'sling-button__pad';
  padBtn.setAttribute('aria-label', ariaLabel);
  padBtn.setAttribute('aria-describedby', hintId);
  padBtn.title = title;

  const faceEl = document.createElement('span');
  faceEl.className = 'sling-button__face';

  const iconEl = document.createElement('span');
  iconEl.className = 'sling-button__icon';
  iconEl.innerHTML = `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`;

  faceEl.appendChild(iconEl);
  padBtn.appendChild(faceEl);
  moveEl.appendChild(padBtn);
  root.appendChild(moveEl);

  const srEl = document.createElement('span');
  srEl.id = hintId;
  srEl.className = 'sling-button__sr';
  srEl.textContent = 'Nhấn Enter để gửi, hoặc kéo nút ra xa rồi thả để bắn tin nhắn.';
  root.appendChild(srEl);

  mountEl.innerHTML = '';
  mountEl.appendChild(root);

  function syncAttributes() {
    if (disabled) {
      padBtn.setAttribute('aria-disabled', 'true');
      padBtn.disabled = true;
    } else {
      padBtn.removeAttribute('aria-disabled');
      padBtn.disabled = false;
    }

    if (held) {
      root.setAttribute('data-held', '');
      padBtn.setAttribute('data-held', '');
    } else {
      root.removeAttribute('data-held');
      padBtn.removeAttribute('data-held');
    }

    if (armed) {
      root.setAttribute('data-armed', '');
      padBtn.setAttribute('data-armed', '');
    } else {
      root.removeAttribute('data-armed');
      padBtn.removeAttribute('data-armed');
    }
  }

  function applyPadTransform() {
    moveEl.style.transform = `translate(${pxVal.toFixed(2)}px, ${pyVal.toFixed(2)}px)`;
  }

  function aimIcon(ux, uy, dist) {
    const angle = (Math.atan2(-uy, -ux) * 180) / Math.PI + 90;
    iconEl.style.transition = 'none';
    iconEl.style.transform = `rotate(${angle * clamp(dist / 12, 0, 1)}deg)`;
  }

  function relaxIcon() {
    iconEl.style.transition = reduceMotion() ? 'none' : 'transform 360ms cubic-bezier(0.23, 1, 0.32, 1)';
    iconEl.style.transform = 'rotate(0deg)';
  }

  function launchDot(overrideDir) {
    dotPending = false;
    clearTimeout(dotTimer);
    const { ux, uy } = overrideDir || dir;
    relaxIcon();
    if (reduceMotion() || typeof Element.prototype.animate !== 'function') return;

    const base = Math.atan2(-uy, -ux);
    const cone = (spread * Math.PI) / 180;
    const push = 0.85 + 0.35 * power;

    dotEls.forEach((dot, i) => {
      const lead = i === 0;
      const angle = base + (lead ? 0 : (Math.random() + Math.random() - 1) * (cone / 2));
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      const reach = (lead ? flight : flight * (0.3 + Math.random())) * push;
      const drift = lead ? 0 : (Math.random() - 0.5) * flight * 0.4;
      const scale = lead ? 1 : 0.3 + Math.random() * 0.6;
      const shrink = lead ? 0.6 : scale * (0.2 + Math.random() * 0.4);
      const duration = lead ? DOT_MS : DOT_MS * (0.7 + Math.random());
      const delay = lead ? 0 : Math.random() * 70;
      const to = wellR + reach;

      dot.animate(
        [
          { transform: `translate(${cx * wellR}px, ${cy * wellR}px) scale(${scale})` },
          { transform: `translate(${cx * to - cy * drift}px, ${cy * to + cx * drift}px) scale(${shrink})` }
        ],
        { duration, delay, easing: EASE_OUT, fill: 'none' }
      );
      dot.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.55 },
          { opacity: 0, offset: 1 }
        ],
        { duration, delay, easing: 'linear', fill: 'none' }
      );
    });
  }

  function paint() {
    paintQueued = false;
    applyPadTransform();
    const x = pxVal;
    const y = pyVal;
    const { ux, uy } = dir;
    const proj = x * ux + y * uy;
    const p = clamp(proj / ARM, 0, 1);
    const dist = Math.hypot(x, y);

    let d = '';
    if (dist > 0.5) {
      const a = Math.atan2(y, x);
      const b = Math.acos(clamp((wellR - padR) / dist, -1, 1));
      d = [a + b, a - b]
        .map(t => {
          const cx = Math.cos(t);
          const cy = Math.sin(t);
          return `M${(wellR * cx).toFixed(2)},${(wellR * cy).toFixed(2)}L${(x + padR * cx).toFixed(2)},${(y + padR * cy).toFixed(2)}`;
        })
        .join('');
    }

    bandPath.setAttribute('d', d);
    hotPath.setAttribute('d', d);
    hotPath.style.opacity = String(p);
    fxGroup.style.opacity = String(clamp(proj / 6, 0, 1));
    arcCircle.setAttribute('stroke-dasharray', `${p} ${1 - p}`);
    arcCircle.setAttribute('stroke-dashoffset', String(p / 2));
    arcCircle.style.opacity = p > 0.01 ? '1' : '0';

    if (grip) aimIcon(ux, uy, dist);
    arcCircle.setAttribute('transform', `rotate(${(Math.atan2(-uy, -ux) * 180) / Math.PI})`);

    if (dotPending && proj <= size / 4) launchDot();
  }

  function schedulePaint() {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(paint);
  }

  function stopAnimations() {
    animX?.stop();
    animY?.stop();
    animX = null;
    animY = null;
  }

  function settle(v0) {
    stopAnimations();
    if (reduceMotion()) {
      fxGroup.style.transition = 'opacity 200ms ease';
      fxGroup.style.opacity = '0';
      setTimeout(() => {
        pxVal = 0;
        pyVal = 0;
        fxGroup.style.transition = '';
        paint();
      }, 200);
      return;
    }

    animX = runSpringToZero(pxVal, v0.x, {
      duration: 0.4,
      bounce: recoil,
      onUpdate: val => {
        pxVal = val;
        schedulePaint();
      }
    });
    animY = runSpringToZero(pyVal, v0.y, {
      duration: 0.4,
      bounce: recoil,
      onUpdate: val => {
        pyVal = val;
        schedulePaint();
      }
    });
  }

  function pulseSent() {
    root.setAttribute('data-sent', '');
    setTimeout(() => root.removeAttribute('data-sent'), 240);
  }

  function fireVisual() {
    pulseSent();
    if (!reduceMotion()) {
      power = 0.55;
      launchDot({ ux: 0, uy: 1 }); // Launch upward burst (opposite of uy=1)
      if (typeof faceEl.animate === 'function') {
        faceEl.animate(
          [
            { transform: 'scale(0.92)' },
            { transform: 'scale(1.12)' },
            { transform: 'scale(1)' }
          ],
          { duration: 280, easing: EASE_OUT }
        );
      }
    }
  }

  function onPointerDown(e) {
    if (disabled || grip || e.button !== 0) return;
    const rect = root.getBoundingClientRect();
    const scale = rect.width / (root.offsetWidth || rect.width) || 1;
    stopAnimations();

    const dNow = Math.hypot(pxVal, pyVal);
    const dClamped = Math.min(dNow, 0.95 * R);
    const rawNow = dNow > 0.5 ? (R * dClamped) / (R - dClamped) : 0;

    grip = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      scale,
      moved: false,
      hist: [],
      rawOrigin: dNow > 0.5 ? { x: (rawNow * pxVal) / dNow, y: (rawNow * pyVal) / dNow } : { x: 0, y: 0 },
      slop: e.pointerType === 'touch' ? SLOP.coarse : SLOP.fine
    };

    try {
      padBtn.setPointerCapture(e.pointerId);
    } catch {}

    held = true;
    syncAttributes();
  }

  function onPointerMove(e) {
    if (!grip || grip.id !== e.pointerId) return;
    const dx = (e.clientX - grip.startX) / grip.scale;
    const dy = (e.clientY - grip.startY) / grip.scale;
    let rx = grip.rawOrigin.x + dx;
    let ry = grip.rawOrigin.y + dy;
    if (axis === 'horizontal') ry = rubberband(ry, size / 4);
    else if (axis === 'vertical') rx = rubberband(rx, size / 4);

    if (!grip.moved && Math.hypot(dx, dy) > grip.slop) grip.moved = true;

    const raw = Math.hypot(rx, ry);
    if (raw < 0.01) return;

    const d = (R * raw) / (R + raw);
    const ux = rx / raw;
    const uy = ry / raw;
    dir = { ux, uy };
    pxVal = d * ux;
    pyVal = d * uy;
    schedulePaint();

    const t = performance.now();
    grip.hist.push({ x: pxVal, y: pyVal, t });
    while (grip.hist.length > 4 || t - grip.hist[0].t > 80) grip.hist.shift();

    const isArmed = d >= ARM;
    if (isArmed !== armed) {
      armed = isArmed;
      syncAttributes();
    }
  }

  function release(pointerId, cancelled) {
    if (!grip || grip.id !== pointerId) return;
    const g = grip;
    grip = null;
    skipClick = true;

    try {
      padBtn.releasePointerCapture(pointerId);
    } catch {}

    const d = Math.hypot(pxVal, pyVal);
    const p = d / ARM;
    const { ux, uy } = dir;
    let vx = 0;
    let vy = 0;

    if (!cancelled && g.hist.length > 1) {
      const a = g.hist[0];
      const b = g.hist[g.hist.length - 1];
      const dt = b.t - a.t;
      if (dt > 0 && performance.now() - b.t < 50) {
        vx = ((b.x - a.x) / dt) * 1000;
        vy = ((b.y - a.y) / dt) * 1000;
      }
    }

    const fm = Math.hypot(vx, vy);
    if (fm > FINGER_MAX) {
      vx *= FINGER_MAX / fm;
      vy *= FINGER_MAX / fm;
    }

    if (!g.moved) {
      relaxIcon();
      if (tapSends && !cancelled && !disabled) {
        fireVisual();
        onSend?.();
      }
    } else {
      const fire = armed && !cancelled && !disabled;
      const launch = fire ? launchSpeed * Math.min(p, POWER_CAP) : CANCEL * launchSpeed * Math.min(p, 1);
      let v0x = vx - ux * launch;
      let v0y = vy - uy * launch;
      const m = Math.hypot(v0x, v0y);
      if (m > HAND_MAX) {
        v0x *= HAND_MAX / m;
        v0y *= HAND_MAX / m;
      }
      if (!fire) relaxIcon();
      if (fire) {
        pulseSent();
        onSend?.();
        if (!reduceMotion()) {
          power = clamp((Math.min(p, POWER_CAP) - 1) / (POWER_CAP - 1), 0, 1);
          dotPending = true;
          dotTimer = setTimeout(() => launchDot(), 150);
        }
      }
      settle({ x: v0x, y: v0y });
    }

    armed = false;
    held = false;
    syncAttributes();
  }

  function onPointerUp(e) { release(e.pointerId, false); }
  function onPointerCancel(e) { release(e.pointerId, true); }
  function onLostPointerCapture(e) { release(e.pointerId, true); }
  function onKeyDown(e) {
    if (e.key === 'Escape' && grip) release(grip.id, true);
  }
  function onClick() {
    if (skipClick) {
      skipClick = false;
      return;
    }
    if (!disabled) {
      fireVisual();
      onSend?.();
    }
  }

  padBtn.addEventListener('pointerdown', onPointerDown);
  padBtn.addEventListener('pointermove', onPointerMove);
  padBtn.addEventListener('pointerup', onPointerUp);
  padBtn.addEventListener('pointercancel', onPointerCancel);
  padBtn.addEventListener('lostpointercapture', onLostPointerCapture);
  padBtn.addEventListener('keydown', onKeyDown);
  padBtn.addEventListener('click', onClick);

  syncAttributes();
  paint();

  return {
    setDisabled(nextDisabled) {
      disabled = Boolean(nextDisabled);
      if (disabled && grip) release(grip.id, true);
      syncAttributes();
    },
    fireVisual,
    destroy() {
      stopAnimations();
      clearTimeout(dotTimer);
      padBtn.removeEventListener('pointerdown', onPointerDown);
      padBtn.removeEventListener('pointermove', onPointerMove);
      padBtn.removeEventListener('pointerup', onPointerUp);
      padBtn.removeEventListener('pointercancel', onPointerCancel);
      padBtn.removeEventListener('lostpointercapture', onLostPointerCapture);
      padBtn.removeEventListener('keydown', onKeyDown);
      padBtn.removeEventListener('click', onClick);
    }
  };
}

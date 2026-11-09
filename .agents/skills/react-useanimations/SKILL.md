---
name: react-useanimations
description: "Animated UI icons and micro-interactions library for React and modern web apps using Lottie and SVG animations. Includes 70+ animated icons with hover, click, loop, autoplay triggers, customizable strokes, colors, and sizes."
---

# react-useanimations

`react-useanimations` is a rich collection of animated, interactive micro-animations and icons for React and web interfaces, powered by SVG and Lottie.

## Installation

```bash
npm install react-useanimations react react-dom
# or
yarn add react-useanimations react react-dom
```

## Basic Usage

```jsx
import React from 'react';
import UseAnimations from 'react-useanimations';
import checkmark from 'react-useanimations/lib/checkmark';
import loading from 'react-useanimations/lib/loading';
import lock from 'react-useanimations/lib/lock';
import menu2 from 'react-useanimations/lib/menu2';

export default function MyComponent() {
  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      {/* Checkmark animation on click or loop */}
      <UseAnimations animation={checkmark} size={40} strokeColor="#2563eb" />
      
      {/* Infinite loading spinner */}
      <UseAnimations animation={loading} size={32} strokeColor="#2563eb" loop={true} />

      {/* Lock / Unlock toggle */}
      <UseAnimations animation={lock} size={36} strokeColor="#1e293b" />

      {/* Hamburger to cross menu */}
      <UseAnimations animation={menu2} size={32} strokeColor="#0f172a" />
    </div>
  );
}
```

## Supported Component Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `animation` | `object` | **required** | The imported animation object from `react-useanimations/lib/<name>` |
| `size` | `number` | `24` | Width and height of the icon in pixels |
| `strokeColor` | `string` | `'#000000'` | Stroke color of the animated SVG |
| `fillColor` | `string` | `'transparent'`| Fill color of the animated SVG |
| `autoplay` | `boolean` | `false` | Automatically plays animation on mount |
| `loop` | `boolean` | `false` | Continuously loops the animation |
| `speed` | `number` | `1` | Animation speed multiplier |
| `reverse` | `boolean` | `false` | Reverses the animation sequence |
| `onClick` | `function` | `undefined` | Callback function when clicked |
| `wrapperStyle`| `object` | `{}` | Inline CSS styles applied to the wrapper element |
| `className` | `string` | `''` | CSS class name applied to wrapper |

---

## Complete Available Animations List

All animations can be imported from `react-useanimations/lib/<name>`:

### Feedback & Status
- `checkmark` — Success checkmark animation
- `alertTriangle` — Warning triangle alert
- `alertCircle` — Error / warning circle alert
- `alertOctagon` — Critical error octagon alert
- `helpCircle` — Question / help icon
- `info` — Information badge

### Loaders & Progress
- `loading` — Smooth continuous circular loader
- `loading2` — Alternating geometric loader
- `activity` — Pulse heartbeat activity wave
- `refresh` — Circular reload / refresh arrows

### Navigation & Actions
- `arrowDown` / `arrowUp` — Directional arrows
- `menu` / `menu2` / `menu3` / `menu4` — Animated hamburger menu bars
- `plus` — Plus to cross expand/collapse toggle
- `x` — Close / dismiss animation
- `search` — Expanding search loupe
- `zoomIn` / `zoomOut` — Zoom controls

### Media & Controls
- `play` / `pause` — Play and pause toggle
- `volume` / `volumeX` — Audio mute/unmute
- `video` — Video recorder toggle
- `microphone` — Audio input toggle

### Forms & Toggles
- `checkbox` — Animated checkbox check/uncheck
- `radio` — Animated radio select
- `lock` / `unlock` — Security lock/unlock toggle
- `eye` — Password visibility show/hide toggle

### Commerce & Utilities
- `calendar` — Calendar date flip
- `clipboard` / `copy` — Copy to clipboard animation
- `download` — File download tray
- `trash` — Delete / remove trashcan lid open
- `heart` — Favorite / like pulse
- `star` — Rating bookmark star
- `user` — Profile / avatar icon
- `settings` — Spinning configuration gear
- `share` — Social / system share nodes
- `shield` — Security shield verify

---

## Vanilla JS / Non-React Environments (HTML / ES Modules)
For pure HTML & ES Module projects without React (like standard Spring Boot static web pages):
Lottie animations can be directly rendered using `lottie-web` via CDN:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js"></script>
<div id="anim-container" style="width: 48px; height: 48px;"></div>
<script>
  lottie.loadAnimation({
    container: document.getElementById('anim-container'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: '/assets/animations/loading.json'
  });
</script>
```

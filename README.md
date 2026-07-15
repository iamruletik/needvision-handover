# Need Vision — Webflow Custom Code

Custom JavaScript/CSS for the Need Vision website built in Webflow. Animations, sliders, smooth scroll and (eventually) a 3D city scene — developed locally with Vite, loaded into Webflow via a single script tag.

## How it works

- **Dev:** `npm run dev` starts Vite on `http://localhost:5173` (fixed port). Webflow Site Settings → Custom Code → Footer contains:

  ```html
  <script type="module" src="http://localhost:5173/src/main.js"></script>
  ```

  Save a file → the published Webflow page reloads itself. No publish button involved.

- **Prod:** `npm run build` outputs a minified IIFE bundle (`dist/main.js`) to be hosted on GitHub Pages; the localhost tag in Webflow gets swapped for the hosted URL.

## Structure

```
src/                  new code (entry: src/main.js)
handover-files/       previous developer's work — reference/backup, do not edit
  README.md           original handover doc (Russian)
  */*.js              legacy per-file scripts (pre-bundler era)
  three-build/        built dist of the 3D scene
  needvision-main/    3D scene source (Astro + TS + three.js WebGPU/TSL)
  webflow/            what was pasted in Webflow custom code sections
```

## Stack

GSAP (ScrollTrigger, Observer) · Lenis · three.js · Barba (planned) · Vite

## Sites

- Staging: https://need-vision-test.webflow.io/
- Production: https://needvision.com/

# Physics Star Atlas · 物理学星图

**[中文](README.md) · English**

**Live demo → [physics-atlas-sigma.vercel.app](https://physics-atlas-sigma.vercel.app/)**

The app includes an in-app Chinese / English switch in the top-right controls.

Four centuries of physics history rendered as a navigable galaxy of knowledge — every theory is a star, and the lines between them trace who stood on whose shoulders. Zoom and roam the star field, open any star, and find a playable real-time teaching simulation inside.

## Features

- **Navigable galaxy** — 760 objects (160 fully-documented theory stars + 600 secondary "dust stars"), six disciplines each forming a color-coded nebula, woven together by 330 lineage filaments.
- **Four-level zoom** — overview of the discipline map → fly in to reveal star names and lineage threads → open a star's archive card. Exponentially damped throughout, no jumps.
- **Playable teaching sims** — 7 "deep-space lab" demo stages, each a step-by-step lesson with one designed "aha moment": Universal Gravitation (fling a planet into an elliptical orbit), Newton's Laws of Motion, Maxwell's electromagnetic field, Entropy (time reversal), Young's double slit (one photon at a time), Special Relativity light clock, Faraday induction.
- **Three lenses** — Galaxy / Timeline (laid out by year) / Scale (particle → universe); switching flows the whole field to a new layout via GPU interpolation, with a top-down axis annotation.
- **Hover lineage / branch focus** — hover any star to light up its lineage; click a discipline in the legend to focus the whole branch.
- **Search + guided tours** — fuzzy search by law or person name flies you there; three narrated tours ("What is light", "From falling bodies to black holes", "From certainty to randomness").

## Tech stack

- **Three.js** (vanilla) + custom GLSL shaders: nebulae, instanced stars, flowing lineage lines, UnrealBloom post-processing
- **Vite** build · **KaTeX** equation typesetting
- Mini-sims are 2D Canvas, one module each, with a uniform `init/step/render/destroy` lifecycle

## Run locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to dist/
```

Data pipeline (re-run after editing discipline anchors or the star table):

```bash
npm run layout     # compute the three layout coordinate sets offline
npm run validate   # validate the star table / edges / coordinates
```

## Project structure

```
src/
  scene/      star-field rendering: nebulae / stars / edges / labels / camera / lens axes
  sims/       7 teaching sims + demo-stage host
  ui/         archive card / demo stage / search / tours
  interact/   hover-focus and branch-focus state machines
  data/       stars / edges / dust / routes (static JSON) + discipline definitions
tools/        layout.mjs (offline layout) · validate.mjs (data validation)
```

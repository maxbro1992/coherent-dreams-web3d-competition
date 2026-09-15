# Coherent Dreams — AI Morphology Explorer

Coherent Dreams turns a deterministic nanoscale phase-field simulation into an interactive 3D surface and lets an interpretable, browser-native model guide exploration. The application uses Three.js `WebGPURenderer`; capable browsers use WebGPU and other modern browsers fall back automatically to WebGL 2.

## What it does

- Renders a 2.56 μm Cahn–Hilliard scalar field as a responsive 25,600-vertex terrain.
- Offers phase-field, unsupervised-cluster, and interface-focused views.
- Computes four per-sample features locally: composition, gradient magnitude, absolute Laplacian, and local variance.
- Runs deterministic four-cluster k-means in a Web Worker.
- Reports phase balance, interface density, characteristic domain scale, anisotropy, entropy, and connected components.
- Ranks regions for interface activity, morphological rarity, or stable phase interiors and explains every ranking with measured evidence.
- Keeps the scientific field on the device; there is no server, account, tracker, or external model call.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build:

```bash
npm run build
npm run preview
```

The build is emitted to `dist/` and can be hosted as a static site. Because `base` is set to `./`, it also works from a nested path.

## Interaction

- Drag to orbit and scroll or pinch to zoom.
- Choose **Phase field**, **AI clusters**, or **Interfaces**.
- Adjust relief and phase threshold.
- Change the scout objective and cycle through ranked regions.
- Use camera presets or focus the current region.
- Open **Source** to compare the unmodified field and the human-directed artwork.
- Open **Method** for the concise model card.

Keyboard shortcuts: `1`, `2`, `3` select views; `N` advances the ranked region; `R` resets the camera; `Space` pauses or resumes slow orbit.

## Scientific provenance

The scalar source is the deterministic output of a dimensionless Cahn–Hilliard phase-field simulation:

- seed: `19920607`
- grid: 384 × 384
- integration steps: 700
- imagined physical width: 2.56 μm
- browser sample grid: 160 × 160

The source image is normalized using fixed display percentiles before loading. The browser derives geometry and all measurements from this grayscale field. The separate *Coherent Dreams* artwork contributes the visual palette and presentation direction only.

The `provenance/` directory contains the exact NumPy field, the deterministic generator, the original 2048 × 2048 grayscale image, and the simulation metadata needed to reproduce the input.

## Model scope

The local model is an exploratory aid. Cluster assignment certainty describes relative distance to the closest and second-closest centroids. Region scores are deterministic combinations of normalized feature magnitudes. These values are useful for navigating the supplied simulation, but they are not calibrated microscopy measurements or material-property predictions.

See [`docs/MODEL-CARD.md`](docs/MODEL-CARD.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Accessibility and fallback

All controls are keyboard reachable and labelled. The interface supports reduced-motion preferences and includes a live status region. Layouts adapt below 820 px. Three.js selects WebGPU when available and falls back to WebGL 2 when it is not.

## Licence

Application source code is MIT licensed. Scientific data and artwork are excluded from that licence and remain © 2026 Maxime Brodeur / NexusHub Studio; see `ASSET-LICENSE.md`. Three.js and other dependencies retain their own licences.

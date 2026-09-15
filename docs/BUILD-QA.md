# Build and interaction QA

Checked locally on 15 September 2026.

## Build

- `npm run build`: passed (`tsc --noEmit` and Vite production build)
- Generated production files: 11
- Total `dist/` size: 13,864,477 bytes, including source maps and bundled image assets
- Main JavaScript: 706.92 kB minified, 195.61 kB gzip
- CSS: 16.29 kB minified, 4.65 kB gzip
- Production dependency audit: 0 known vulnerabilities at all severities

Vite reports its advisory 500 kB chunk warning for the main Three.js application bundle. This is a performance opportunity, not a build failure. The compressed main script is approximately 196 kB and the application remains a static, zero-backend experience.

## Production-browser verification

The final `dist/` build was served with `vite preview` and tested in Microsoft Edge.

- Renderer reached **WebGPU active**.
- Local worker reached **Analysis ready** in 107 ms on the verification run.
- Baseline results were 44/56% phase balance, 33.4% interface density, 80 nm estimated domain scale, 0.04 anisotropy, 89% normalized entropy, 110 connected islands, and 68% aggregate assignment certainty.
- Phase field, AI clusters, and Interfaces views activated correctly.
- The scout objective changed from active interfaces to rare morphology and updated the title, explanation, and evidence values.
- Focus camera, camera presets, relief, threshold, orbit, reset, and ranked-region controls responded.
- Source and Method dialogs displayed correctly.
- The internal capture helper is hidden from production and appears only with the local `?capture=1` QA query.
- The same QA query forces and verifies the WebGL 2 fallback used for deterministic frame capture.

## Reproducibility

Running the included Cahn–Hilliard generator produced a float32 field exactly equal to `provenance/source-field.npy` (`array_equal: true`, maximum absolute error `0.0`). Resampling the normalized 2048px PNG back to the 384px simulation grid produced a mean grayscale delta of 0.059 levels, consistent with the documented image resize.

## Media

See `VIDEO-QA.md` for the demo video stream, duration, audio, captions, and visual inspection evidence.

## Remaining external verification

The HTTPS-hosted URL, GitHub judge access, EasyChair terms, and final submission form can only be verified after those external resources are created.

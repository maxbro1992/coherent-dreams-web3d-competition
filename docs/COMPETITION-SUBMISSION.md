# AI & Web3D Innovation Competition 2026 — submission copy

This document is ready to paste into the competition form. No account, repository, hosted URL, or external submission has been created.

## Identity

- **Project title:** Coherent Dreams — AI Morphology Explorer
- **Primary category:** AI-Enhanced Visualization & Analytics
- **Secondary theme:** Open Innovation
- **Entrant:** Maxime Brodeur
- **Affiliation:** NexusHub Studio
- **Country:** Canada
- **Contact:** contact@nexushub.nexus
- **Team size:** 1

## One-sentence description

An interpretable, privacy-preserving WebGPU explorer that turns a deterministic nanoscale phase-field simulation into an immersive terrain and ranks scientifically interesting regions with browser-native unsupervised learning.

## Short abstract

Coherent Dreams renders a Cahn–Hilliard phase-field simulation as a responsive 3D terrain using Three.js WebGPURenderer. A Web Worker computes composition, gradient, curvature, and local-variance features, fits deterministic four-cluster k-means, reports morphology metrics, and ranks regions for interface activity, rarity, or phase stability. Every recommendation exposes its evidence. The experience runs without a backend, remote inference, account, or data upload; WebGPU is used when available and WebGL 2 is the automatic fallback. A provenance view separates the unmodified scientific source from its human-directed artistic interpretation.

## Technologies

- TypeScript 5.9
- Vite 7.3
- Three.js r180
- Three.js WebGPURenderer and WebGL 2 fallback backend
- Web Workers and transferable typed arrays
- HTML Canvas for deterministic field sampling
- Browser-native k-means and morphology metrics implemented for this project

## AI model used

The application uses a deterministic, four-cluster unsupervised k-means model implemented in TypeScript. Inputs are standardized composition, gradient magnitude, absolute Laplacian, and local variance. It runs locally in a Web Worker. Semantic labels and ranked recommendations are derived from centroids and measured features; no generative model is used at runtime.

## Web3D framework

Three.js `WebGPURenderer`. It selects WebGPU on compatible browsers and its WebGL 2 backend otherwise. The scientific scalar field becomes an indexed 25,600-vertex, 50,562-triangle terrain with dynamic vertex colors and interactive orbit controls.

## URLs to complete at submission time

- **Working prototype URL:** `[HOSTED URL REQUIRED]`
- **Source repository:** `[GITHUB URL REQUIRED — may remain private if judge access is granted]`
- **Demo video:** `[VIDEO URL REQUIRED]`

## Required innovation statement

Use the exact text in `INNOVATION-STATEMENT.md` (334 words).

## Supporting documentation

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/MODEL-CARD.md`
- `docs/JUDGING-MATRIX.md`
- `docs/DEMO-SCRIPT.md`
- `docs/VIDEO-QA.md`
- `docs/BUILD-QA.md`
- `docs/REVIEWER-WALKTHROUGH.md`
- `docs/OFFICIAL-RULES-NOTES.md`
- `docs/LAUNCH-AND-SUBMIT.md`
- `ASSET-LICENSE.md`

## Official requirements checked on 15 September 2026

The official page says the competition is open to individuals and teams worldwide, including students, professionals, researchers, and hobbyists. Teams may have up to five members. Required deliverables are a browser-accessible working prototype, GitHub source code public or private with judge access, technical documentation, a required three-to-five-minute demonstration video, and an innovation statement of no more than 500 words. The submission deadline is 30 September 2026. Winners are scheduled for 15 October 2026. Prizes are 1,000 USD and 500 USD.

Official source: <https://web3d.siggraph.org/2026/ai-web3d-innovation-competition/>

## Rights and platform notes

The public competition page does not state an assignment or licence of project intellectual property. Source code can be supplied privately to judges. EasyChair may have separate platform terms and requires an account; those terms must be read before account creation or upload. The official page does not list an entry fee, but the final EasyChair form should be checked before submission.

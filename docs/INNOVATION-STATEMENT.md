# Innovation statement

**Word count: 334 (maximum allowed: 500)**

Scientific simulations often end their journey as static figures. A researcher can see a pattern, but cannot easily move through it, compare interpretations, or ask which regions deserve attention. Coherent Dreams turns one deterministic nanoscale phase-field simulation into an explorable 3D environment with an interpretable AI guide that runs entirely in the browser.

The source is a Cahn–Hilliard scalar field representing phase separation across an imagined 2.56-micrometre nickel–aluminum film. The browser samples that unchanged field into 25,600 vertices and renders it through Three.js WebGPURenderer. WebGPU-capable devices receive the modern backend automatically, while WebGL 2 provides a universal fallback. Relief, threshold, camera, and three visual modes let a viewer move between the continuous field, learned clusters, and bright interface boundaries without altering the measurements.

The AI contribution is both useful and inspectable. A Web Worker derives composition, gradient, curvature, and local-variance features at every sample. Deterministic k-means discovers four morphology regimes, then a region-scout layer ranks spatially distinct areas for active interfaces, rare morphology, or stable phase interiors. Each recommendation cites the measured gradient, curvature, and rarity that produced its rank. The app also reports phase balance, interface density, characteristic domain scale, anisotropy, entropy, and connected components. No field data, prompt, or identifier leaves the device.

The project’s novelty is the union of immersive rendering, local machine learning, and scientific provenance in one zero-backend Web experience. The source dialog places the unmodified computational field beside the human-directed Coherent Dreams artwork, making a clear distinction between data and visual interpretation. The artwork informs the palette; the source field drives geometry and metrics. A concise model card documents what the system can and cannot claim.

This pattern extends beyond nanoart. The same architecture can turn microscopy, climate, medical, manufacturing, or materials scalar fields into private interactive explainers, even in classrooms or secure environments where uploading data is unacceptable. Coherent Dreams demonstrates that AI in Web3D can guide attention without hiding its evidence, and that a beautiful immersive experience can remain scientifically honest.

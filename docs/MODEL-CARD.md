# Morphology Intelligence model card

## Intended use

The model helps a viewer navigate a supplied two-dimensional phase-field simulation. It separates morphology regimes, summarizes global structure, and ranks regions worth inspecting. It is designed for exploration, demonstration, and teaching.

## Model type

Deterministic unsupervised k-means with four standardized input features per sample:

- composition intensity;
- gradient magnitude;
- absolute Laplacian;
- local variance.

The model runs entirely in a Web Worker. It neither downloads weights nor sends data to an inference service.

## Outputs

- Four cluster assignments mapped to phase interior, transition, interface, and opposite phase interior.
- Global morphology metrics.
- Eight spatially separated candidates for each scout objective.
- Relative assignment certainty derived from the closest and second-closest centroid distances.

## Determinism

Input sampling, centroid initialization, fitting, semantic mapping, and region ranking contain no runtime randomness. The same application build and source field produce the same outputs.

## Explainability

Every ranked finding exposes normalized gradient, curvature, and rarity evidence. The generated explanation is a fixed, objective-specific template grounded in those measurements. It is not a generative-language-model claim.

## Limitations

- The source is a simulated scalar field, not a calibrated experimental micrograph.
- Downsampling limits the smallest visible and measurable feature.
- K-means assumes roughly compact feature clusters and does not encode spatial connectivity during fitting.
- Semantic cluster names are inferred from centroids and are descriptive, not chemical phase identification.
- The displayed physical scale is an imagined mapping declared with the source simulation.
- Results must not be used for safety, manufacturing, diagnosis, or quantitative materials decisions without independent validation.

## Human role

The human creator selected the scientific model, seed, physical interpretation, features, scoring objectives, visual language, and disclosure boundaries. AI is used as an interpretable navigation layer rather than as an authority over the data.

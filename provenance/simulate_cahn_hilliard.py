"""Generate a deterministic nanoscale spinodal-decomposition field.

The script integrates a dimensionless Cahn-Hilliard phase-field equation on a
periodic 2-D grid with a semi-implicit Fourier method.  The grayscale output is
the unmodified scientific source image for Coherent Dreams and its browser visualization.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image


SEED = 19920607
GRID = 384
STEPS = 700
DT = 0.45
EPSILON = 1.2
MEAN_COMPOSITION = -0.08
NOISE_STD = 0.07
PHYSICAL_WIDTH_MICROMETERS = 2.56


def simulate() -> np.ndarray:
    rng = np.random.default_rng(SEED)
    phi = MEAN_COMPOSITION + NOISE_STD * rng.standard_normal((GRID, GRID))

    # Integer Fourier frequencies keep the equation dimensionless while
    # preserving a clear, reproducible morphology.
    k = 2.0 * np.pi * np.fft.fftfreq(GRID)
    kx, ky = np.meshgrid(k, k, indexing="ij")
    k2 = kx * kx + ky * ky
    k4 = k2 * k2

    phi_hat = np.fft.fft2(phi)
    for _ in range(STEPS):
        phi = np.fft.ifft2(phi_hat).real
        nonlinear_hat = np.fft.fft2(phi**3 - phi)
        phi_hat = (phi_hat - DT * k2 * nonlinear_hat) / (
            1.0 + DT * EPSILON**2 * k4
        )
        # Numerical drift of the conserved mean should remain exactly zero.
        phi_hat[0, 0] = MEAN_COMPOSITION * GRID * GRID

    return np.fft.ifft2(phi_hat).real


def save(field: np.ndarray, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    lo, hi = np.percentile(field, [0.2, 99.8])
    normalized = np.clip((field - lo) / (hi - lo), 0.0, 1.0)
    pixels = np.rint(normalized * 255.0).astype(np.uint8)
    image = Image.fromarray(pixels, mode="L").resize((2048, 2048), Image.Resampling.LANCZOS)
    image.save(output_dir / "source-unmodified-spinodal-field.png")

    np.save(output_dir / "source-field.npy", field.astype(np.float32))
    metadata = {
        "equation": "Cahn-Hilliard phase-field model",
        "seed": SEED,
        "grid": [GRID, GRID],
        "steps": STEPS,
        "dt_dimensionless": DT,
        "epsilon_dimensionless": EPSILON,
        "mean_composition_dimensionless": MEAN_COMPOSITION,
        "initial_noise_std": NOISE_STD,
        "physical_width_micrometers": PHYSICAL_WIDTH_MICROMETERS,
        "pixel_scale_nanometers_at_simulation_grid": (
            PHYSICAL_WIDTH_MICROMETERS * 1000.0 / GRID
        ),
        "display_percentiles": [0.2, 99.8],
        "output_resolution": [2048, 2048],
    }
    (output_dir / "simulation-metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    save(simulate(), Path(__file__).resolve().parent)


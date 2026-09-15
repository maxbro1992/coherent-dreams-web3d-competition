/// <reference lib="webworker" />

type Objective = 'interface' | 'rare' | 'phase';

type AnalyzeRequest = {
  type: 'analyze';
  values: Float32Array;
  width: number;
  height: number;
};

export type Hotspot = {
  x: number;
  y: number;
  objective: Objective;
  score: number;
  value: number;
  gradient: number;
  curvature: number;
  variance: number;
  rarity: number;
  semanticLabel: number;
};

export type AnalysisResult = {
  type: 'result';
  labels: Uint8Array;
  clusterCounts: number[];
  metrics: {
    phaseFraction: number;
    interfaceDensity: number;
    domainScaleNm: number;
    anisotropy: number;
    entropy: number;
    components: number;
    confidence: number;
    elapsedMs: number;
  };
  hotspots: Record<Objective, Hotspot[]>;
};

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<AnalyzeRequest>) => {
  if (event.data.type !== 'analyze') return;
  const started = performance.now();
  const { values, width, height } = event.data;
  const total = width * height;
  const gradient = new Float32Array(total);
  const laplacian = new Float32Array(total);
  const variance = new Float32Array(total);
  const features = new Float32Array(total * 4);

  const at = (x: number, y: number) => {
    const wrappedX = (x + width) % width;
    const wrappedY = (y + height) % height;
    return values[wrappedY * width + wrappedX] ?? 0;
  };

  let sumGxx = 0;
  let sumGyy = 0;
  let sumGxy = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = values[index] ?? 0;
      const gx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const gy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      const grad = Math.hypot(gx, gy);
      const lap = at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1) - 4 * value;

      let localMean = 0;
      let localSquare = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sample = at(x + ox, y + oy);
          localMean += sample;
          localSquare += sample * sample;
        }
      }
      localMean /= 9;
      const localVariance = Math.max(0, localSquare / 9 - localMean * localMean);

      gradient[index] = grad;
      laplacian[index] = Math.abs(lap);
      variance[index] = localVariance;
      features[index * 4] = value;
      features[index * 4 + 1] = grad;
      features[index * 4 + 2] = Math.abs(lap);
      features[index * 4 + 3] = localVariance;
      sumGxx += gx * gx;
      sumGyy += gy * gy;
      sumGxy += gx * gy;
    }
  }

  standardize(features, total, 4);
  const clustered = kMeans(features, total, 4, 4);
  const semanticMap = semanticClusterMap(clustered.centroids);
  const labels = new Uint8Array(total);
  const clusterCounts = [0, 0, 0, 0];
  for (let i = 0; i < total; i += 1) {
    const semantic = semanticMap[clustered.labels[i] ?? 0] ?? 1;
    labels[i] = semantic;
    clusterCounts[semantic] = (clusterCounts[semantic] ?? 0) + 1;
  }

  const confidence = clusterConfidence(features, clustered.labels, clustered.centroids, total, 4);
  const gradThreshold = mean(gradient) + 0.65 * standardDeviation(gradient);
  let highCount = 0;
  let interfaceCount = 0;
  for (let i = 0; i < total; i += 1) {
    if ((values[i] ?? 0) >= 0.5) highCount += 1;
    if ((gradient[i] ?? 0) >= gradThreshold) interfaceCount += 1;
  }

  const trace = sumGxx + sumGyy;
  const discriminant = Math.sqrt(Math.max(0, (sumGxx - sumGyy) ** 2 + 4 * sumGxy ** 2));
  const lambda1 = (trace + discriminant) * 0.5;
  const lambda2 = (trace - discriminant) * 0.5;
  const anisotropy = trace > 0 ? (lambda1 - lambda2) / (lambda1 + lambda2) : 0;

  const rarity = pointRarity(features, clustered.labels, clustered.centroids, total, 4);
  const maxima = {
    gradient: maxOf(gradient),
    curvature: maxOf(laplacian),
    variance: maxOf(variance),
    rarity: maxOf(rarity),
  };
  const hotspots = {
    interface: rankHotspots('interface', values, labels, gradient, laplacian, variance, rarity, width, height, maxima),
    rare: rankHotspots('rare', values, labels, gradient, laplacian, variance, rarity, width, height, maxima),
    phase: rankHotspots('phase', values, labels, gradient, laplacian, variance, rarity, width, height, maxima),
  };

  const result: AnalysisResult = {
    type: 'result',
    labels,
    clusterCounts,
    metrics: {
      phaseFraction: highCount / total,
      interfaceDensity: interfaceCount / total,
      domainScaleNm: estimateDomainScale(values, width, height) * (2560 / width),
      anisotropy,
      entropy: histogramEntropy(values),
      components: countComponents(values, width, height, 0.5),
      confidence,
      elapsedMs: performance.now() - started,
    },
    hotspots,
  };

  ctx.postMessage(result, [labels.buffer]);
};

function standardize(data: Float32Array, rows: number, columns: number) {
  for (let column = 0; column < columns; column += 1) {
    let featureMean = 0;
    for (let row = 0; row < rows; row += 1) featureMean += data[row * columns + column] ?? 0;
    featureMean /= rows;
    let squared = 0;
    for (let row = 0; row < rows; row += 1) {
      const delta = (data[row * columns + column] ?? 0) - featureMean;
      squared += delta * delta;
    }
    const deviation = Math.sqrt(squared / rows) || 1;
    for (let row = 0; row < rows; row += 1) {
      const index = row * columns + column;
      data[index] = ((data[index] ?? 0) - featureMean) / deviation;
    }
  }
}

function kMeans(data: Float32Array, rows: number, columns: number, k: number) {
  const centroids = new Float32Array(k * columns);
  const labels = new Uint8Array(rows);

  let first = 0;
  let smallestNorm = Number.POSITIVE_INFINITY;
  for (let row = 0; row < rows; row += 1) {
    let norm = 0;
    for (let column = 0; column < columns; column += 1) norm += (data[row * columns + column] ?? 0) ** 2;
    if (norm < smallestNorm) {
      smallestNorm = norm;
      first = row;
    }
  }
  copyRow(data, first, centroids, 0, columns);

  for (let cluster = 1; cluster < k; cluster += 1) {
    let farthestRow = 0;
    let farthestDistance = -1;
    for (let row = 0; row < rows; row += 1) {
      let nearest = Number.POSITIVE_INFINITY;
      for (let existing = 0; existing < cluster; existing += 1) {
        nearest = Math.min(nearest, squaredDistance(data, row * columns, centroids, existing * columns, columns));
      }
      if (nearest > farthestDistance) {
        farthestDistance = nearest;
        farthestRow = row;
      }
    }
    copyRow(data, farthestRow, centroids, cluster, columns);
  }

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const sums = new Float64Array(k * columns);
    const counts = new Uint32Array(k);
    let changes = 0;
    let worstRow = 0;
    let worstDistance = -1;

    for (let row = 0; row < rows; row += 1) {
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let cluster = 0; cluster < k; cluster += 1) {
        const distance = squaredDistance(data, row * columns, centroids, cluster * columns, columns);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = cluster;
        }
      }
      if (labels[row] !== bestCluster) changes += 1;
      labels[row] = bestCluster;
      counts[bestCluster] = (counts[bestCluster] ?? 0) + 1;
      for (let column = 0; column < columns; column += 1) {
        sums[bestCluster * columns + column] = (sums[bestCluster * columns + column] ?? 0) + (data[row * columns + column] ?? 0);
      }
      if (bestDistance > worstDistance) {
        worstDistance = bestDistance;
        worstRow = row;
      }
    }

    for (let cluster = 0; cluster < k; cluster += 1) {
      const count = counts[cluster] ?? 0;
      if (count === 0) {
        copyRow(data, worstRow, centroids, cluster, columns);
        continue;
      }
      for (let column = 0; column < columns; column += 1) {
        centroids[cluster * columns + column] = (sums[cluster * columns + column] ?? 0) / count;
      }
    }
    if (iteration > 1 && changes / rows < 0.0005) break;
  }

  return { centroids, labels };
}

function copyRow(source: Float32Array, sourceRow: number, target: Float32Array, targetRow: number, columns: number) {
  for (let column = 0; column < columns; column += 1) {
    target[targetRow * columns + column] = source[sourceRow * columns + column] ?? 0;
  }
}

function squaredDistance(a: Float32Array, ai: number, b: Float32Array, bi: number, columns: number) {
  let sum = 0;
  for (let column = 0; column < columns; column += 1) {
    const delta = (a[ai + column] ?? 0) - (b[bi + column] ?? 0);
    sum += delta * delta;
  }
  return sum;
}

function semanticClusterMap(centroids: Float32Array) {
  const indices = [0, 1, 2, 3];
  const interfaceCluster = indices.reduce((best, current) =>
    (centroids[current * 4 + 1] ?? 0) > (centroids[best * 4 + 1] ?? 0) ? current : best,
  );
  const remaining = indices.filter((index) => index !== interfaceCluster);
  const lowCluster = remaining.reduce((best, current) =>
    (centroids[current * 4] ?? 0) < (centroids[best * 4] ?? 0) ? current : best,
  );
  const highCluster = remaining.reduce((best, current) =>
    (centroids[current * 4] ?? 0) > (centroids[best * 4] ?? 0) ? current : best,
  );
  const transitionCluster = remaining.find((index) => index !== lowCluster && index !== highCluster) ?? remaining[0] ?? 0;
  const mapping = new Uint8Array(4);
  mapping[lowCluster] = 0;
  mapping[transitionCluster] = 1;
  mapping[interfaceCluster] = 2;
  mapping[highCluster] = 3;
  return mapping;
}

function clusterConfidence(data: Float32Array, labels: Uint8Array, centroids: Float32Array, rows: number, columns: number) {
  let score = 0;
  const stride = Math.max(1, Math.floor(rows / 3200));
  let samples = 0;
  for (let row = 0; row < rows; row += stride) {
    const own = labels[row] ?? 0;
    const ownDistance = Math.sqrt(squaredDistance(data, row * columns, centroids, own * columns, columns));
    let alternative = Number.POSITIVE_INFINITY;
    for (let cluster = 0; cluster < 4; cluster += 1) {
      if (cluster === own) continue;
      alternative = Math.min(alternative, Math.sqrt(squaredDistance(data, row * columns, centroids, cluster * columns, columns)));
    }
    // Relative assignment certainty: 0.5 means the nearest alternative is
    // equally close; 1.0 means the chosen centroid is effectively exact.
    score += alternative / Math.max(alternative + ownDistance, 1e-6);
    samples += 1;
  }
  return Math.min(0.97, Math.max(0.5, score / Math.max(1, samples)));
}

function pointRarity(data: Float32Array, labels: Uint8Array, centroids: Float32Array, rows: number, columns: number) {
  const result = new Float32Array(rows);
  for (let row = 0; row < rows; row += 1) {
    const cluster = labels[row] ?? 0;
    result[row] = Math.sqrt(squaredDistance(data, row * columns, centroids, cluster * columns, columns));
  }
  return result;
}

function rankHotspots(
  objective: Objective,
  values: Float32Array,
  labels: Uint8Array,
  gradient: Float32Array,
  laplacian: Float32Array,
  variance: Float32Array,
  rarity: Float32Array,
  width: number,
  height: number,
  maxima: { gradient: number; curvature: number; variance: number; rarity: number },
) {
  const candidates: Hotspot[] = [];
  for (let y = 3; y < height - 3; y += 2) {
    for (let x = 3; x < width - 3; x += 2) {
      const index = y * width + x;
      const grad = (gradient[index] ?? 0) / maxima.gradient;
      const curve = (laplacian[index] ?? 0) / maxima.curvature;
      const localVar = (variance[index] ?? 0) / maxima.variance;
      const rare = (rarity[index] ?? 0) / maxima.rarity;
      const value = values[index] ?? 0;
      let score = 0;
      if (objective === 'interface') score = grad * 0.58 + curve * 0.2 + localVar * 0.16 + rare * 0.06;
      if (objective === 'rare') score = rare * 0.5 + localVar * 0.25 + curve * 0.17 + grad * 0.08;
      if (objective === 'phase') score = Math.abs(value - 0.5) * 1.25 + (1 - grad) * 0.22 + (1 - localVar) * 0.08;
      candidates.push({
        x,
        y,
        objective,
        score,
        value,
        gradient: grad,
        curvature: curve,
        variance: localVar,
        rarity: rare,
        semanticLabel: labels[index] ?? 0,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: Hotspot[] = [];
  const exclusion = Math.max(10, Math.floor(width * 0.1));
  for (const candidate of candidates) {
    if (selected.every((picked) => Math.hypot(candidate.x - picked.x, candidate.y - picked.y) > exclusion)) {
      selected.push(candidate);
      if (selected.length === 8) break;
    }
  }
  const maximumScore = selected[0]?.score || 1;
  return selected.map((hotspot) => ({ ...hotspot, score: hotspot.score / maximumScore }));
}

function estimateDomainScale(values: Float32Array, width: number, height: number) {
  const runs: number[] = [];
  const sampleRun = (samples: number[]) => {
    let start = 0;
    let state = (samples[0] ?? 0) >= 0.5;
    for (let i = 1; i < samples.length; i += 1) {
      const next = (samples[i] ?? 0) >= 0.5;
      if (next !== state) {
        const length = i - start;
        if (length >= 2) runs.push(length);
        start = i;
        state = next;
      }
    }
    const tail = samples.length - start;
    if (tail >= 2) runs.push(tail);
  };

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 24));
  for (let y = 0; y < height; y += stride) {
    sampleRun(Array.from({ length: width }, (_, x) => values[y * width + x] ?? 0));
  }
  for (let x = 0; x < width; x += stride) {
    sampleRun(Array.from({ length: height }, (_, y) => values[y * width + x] ?? 0));
  }
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length * 0.5)] ?? 0;
}

function countComponents(values: Float32Array, width: number, height: number, threshold: number) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let meaningfulComponents = 0;
  for (let start = 0; start < values.length; start += 1) {
    if (visited[start] || (values[start] ?? 0) < threshold) continue;
    let head = 0;
    let tail = 0;
    let size = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++] ?? 0;
      size += 1;
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        y * width + ((x + 1) % width),
        y * width + ((x - 1 + width) % width),
        ((y + 1) % height) * width + x,
        ((y - 1 + height) % height) * width + x,
      ];
      for (const neighbor of neighbors) {
        if (!visited[neighbor] && (values[neighbor] ?? 0) >= threshold) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }
    if (size >= 5) meaningfulComponents += 1;
  }
  return meaningfulComponents;
}

function histogramEntropy(values: Float32Array) {
  const bins = new Uint32Array(32);
  for (const value of values) {
    const bin = Math.min(31, Math.max(0, Math.floor(value * 32)));
    bins[bin] = (bins[bin] ?? 0) + 1;
  }
  let entropy = 0;
  for (const count of bins) {
    if (count === 0) continue;
    const probability = count / values.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy / Math.log2(bins.length);
}

function mean(values: Float32Array) {
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}

function standardDeviation(values: Float32Array) {
  const average = mean(values);
  let total = 0;
  for (const value of values) total += (value - average) ** 2;
  return Math.sqrt(total / values.length);
}

function maxOf(values: Float32Array) {
  let maximum = Number.MIN_VALUE;
  for (const value of values) maximum = Math.max(maximum, value);
  return Math.max(maximum, 1e-9);
}

export {};

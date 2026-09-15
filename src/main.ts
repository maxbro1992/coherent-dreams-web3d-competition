import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AnalysisResult, Hotspot } from './analysis.worker';
import './style.css';

type ViewMode = 'field' | 'clusters' | 'interfaces';
type Objective = 'interface' | 'rare' | 'phase';

const SAMPLE_SIZE = 160;
const PHYSICAL_SIZE = 2.56;
const DEFAULT_RELIEF = 0.68;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CAPTURE_MODE = new URLSearchParams(window.location.search).has('capture');

const ui = {
  viewport: required<HTMLDivElement>('viewport'),
  rendererChip: required<HTMLDivElement>('renderer-chip'),
  loadingCard: required<HTMLDivElement>('loading-card'),
  loadingDetail: required<HTMLSpanElement>('loading-detail'),
  relief: required<HTMLInputElement>('relief-control'),
  reliefValue: required<HTMLOutputElement>('relief-value'),
  threshold: required<HTMLInputElement>('threshold-control'),
  thresholdValue: required<HTMLOutputElement>('threshold-value'),
  phaseBalance: required<HTMLElement>('phase-balance'),
  interfaceDensity: required<HTMLElement>('interface-density'),
  domainScale: required<HTMLElement>('domain-scale'),
  anisotropy: required<HTMLElement>('anisotropy'),
  confidenceRing: required<HTMLDivElement>('confidence-ring'),
  confidence: required<HTMLSpanElement>('confidence'),
  analysisSummary: required<HTMLParagraphElement>('analysis-summary'),
  objective: required<HTMLSelectElement>('scout-objective'),
  findingIndex: required<HTMLSpanElement>('finding-index'),
  findingScore: required<HTMLSpanElement>('finding-score'),
  findingTitle: required<HTMLHeadingElement>('finding-title'),
  findingCopy: required<HTMLParagraphElement>('finding-copy'),
  evidence: required<HTMLDivElement>('evidence-row'),
  nextRegion: required<HTMLButtonElement>('next-region'),
  focusButton: required<HTMLButtonElement>('focus-button'),
  resetButton: required<HTMLButtonElement>('reset-button'),
  motionToggle: required<HTMLButtonElement>('motion-toggle'),
  referenceButton: required<HTMLButtonElement>('reference-button'),
  methodButton: required<HTMLButtonElement>('method-button'),
  captureButton: required<HTMLButtonElement>('capture-button'),
  referenceDialog: required<HTMLDialogElement>('reference-dialog'),
  methodDialog: required<HTMLDialogElement>('method-dialog'),
  liveStatus: required<HTMLDivElement>('live-status'),
};

let fieldValues = new Float32Array();
let analysis: AnalysisResult | null = null;
let fieldMesh: THREE.Mesh | null = null;
let fieldGeometry: THREE.BufferGeometry | null = null;
let currentMode: ViewMode = 'field';
let currentObjective: Objective = 'interface';
let currentFinding = 0;
let threshold = 0.5;
let relief = DEFAULT_RELIEF;
let motionEnabled = !REDUCED_MOTION;
let cameraTween: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#020b13');
scene.fog = new THREE.FogExp2('#020b13', 0.19);

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
camera.position.set(3.25, 2.5, 3.25);

const renderer = new THREE.WebGPURenderer({
  antialias: true,
  forceWebGL: CAPTURE_MODE,
  preserveDrawingBuffer: CAPTURE_MODE,
} as ConstructorParameters<typeof THREE.WebGPURenderer>[0]);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
ui.viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 2.25;
controls.maxDistance = 7.2;
controls.maxPolarAngle = Math.PI * 0.47;
controls.target.set(0, -0.03, 0);

const fieldGroup = new THREE.Group();
scene.add(fieldGroup);

const markers = new THREE.Group();
fieldGroup.add(markers);

addEnvironment();
bindInterface();
setRangeFill(ui.relief);
setRangeFill(ui.threshold);

void initialize();

async function initialize() {
  try {
    ui.loadingDetail.textContent = 'Starting WebGPU with WebGL 2 fallback…';
    await renderer.init();
    const backend = (renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    const backendLabel = backend?.isWebGPUBackend ? 'WebGPU active' : CAPTURE_MODE ? 'WebGL 2 capture' : 'WebGL 2 fallback';
    ui.rendererChip.classList.add('is-ready');
    ui.rendererChip.querySelector('span:last-child')!.textContent = backendLabel;

    ui.loadingDetail.textContent = 'Sampling the deterministic source field…';
    fieldValues = await loadScalarField('./data/spinodal-field.png', SAMPLE_SIZE);
    createFieldMesh(fieldValues, SAMPLE_SIZE);

    ui.loadingDetail.textContent = 'Clustering morphology locally…';
    analysis = await analyzeField(fieldValues, SAMPLE_SIZE);
    applyAnalysis();
    ui.loadingCard.classList.add('is-hidden');
    window.setTimeout(() => ui.loadingCard.remove(), 420);
    announce(`Analysis ready. ${analysis.metrics.components} connected phase regions detected.`);

    if (new URLSearchParams(window.location.search).has('tour')) startGuidedTour();
  } catch (error) {
    console.error(error);
    ui.loadingDetail.textContent = 'The field could not initialize. Reload to try again.';
    ui.rendererChip.querySelector('span:last-child')!.textContent = 'Initialization failed';
    announce('The morphology field could not initialize.');
  }
}

function addEnvironment() {
  const hemisphere = new THREE.HemisphereLight('#58dfff', '#07111a', 1.15);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight('#bdefff', 4.8);
  key.position.set(-2.2, 4.5, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const warm = new THREE.PointLight('#ff6f35', 18, 8, 2);
  warm.position.set(2.4, 1.3, -1.4);
  scene.add(warm);

  const cool = new THREE.PointLight('#19d8ff', 11, 7, 2);
  cool.position.set(-2.1, 1.1, 2.2);
  scene.add(cool);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 96),
    new THREE.MeshBasicMaterial({ color: '#03111c', transparent: true, opacity: 0.62, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.33;
  scene.add(ground);

  const grid = new THREE.GridHelper(5.6, 28, '#0d5271', '#082a3b');
  grid.position.y = -0.32;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.18;
  });
  scene.add(grid);

  const stars = new THREE.BufferGeometry();
  const starCount = 240;
  const starPositions = new Float32Array(starCount * 3);
  const random = mulberry32(4421);
  for (let i = 0; i < starCount; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 2.3 + random() * 5.3;
    starPositions[i * 3] = Math.cos(angle) * radius;
    starPositions[i * 3 + 1] = 0.5 + random() * 4.8;
    starPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  stars.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const particles = new THREE.Points(
    stars,
    new THREE.PointsMaterial({ color: '#65c9eb', size: 0.012, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  scene.add(particles);
}

function createFieldMesh(values: Float32Array, size: number) {
  const positions = new Float32Array(size * size * 3);
  const colors = new Float32Array(size * size * 3);
  const indices = new Uint32Array((size - 1) * (size - 1) * 6);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      positions[index * 3] = (x / (size - 1) - 0.5) * PHYSICAL_SIZE;
      positions[index * 3 + 1] = fieldHeight(values[index] ?? 0);
      positions[index * 3 + 2] = (y / (size - 1) - 0.5) * PHYSICAL_SIZE;
    }
  }

  let cursor = 0;
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const a = y * size + x;
      const b = a + 1;
      const c = a + size;
      const d = c + 1;
      indices[cursor++] = a;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = d;
    }
  }

  fieldGeometry = new THREE.BufferGeometry();
  fieldGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  fieldGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fieldGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  fieldGeometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.2,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  fieldMesh = new THREE.Mesh(fieldGeometry, material);
  fieldMesh.castShadow = true;
  fieldMesh.receiveShadow = true;
  fieldGroup.add(fieldMesh);
  updateFieldColors();

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(PHYSICAL_SIZE + 0.06, 0.02, PHYSICAL_SIZE + 0.06)),
    new THREE.LineBasicMaterial({ color: '#1eb3d5', transparent: true, opacity: 0.16 }),
  );
  frame.position.y = -0.3;
  fieldGroup.add(frame);
}

function updateFieldColors() {
  if (!fieldGeometry || fieldValues.length === 0) return;
  const colorAttribute = fieldGeometry.getAttribute('color') as THREE.BufferAttribute;
  for (let index = 0; index < fieldValues.length; index += 1) {
    const value = fieldValues[index] ?? 0;
    const semantic = analysis?.labels[index] ?? (Math.abs(value - threshold) < 0.08 ? 2 : value > threshold ? 3 : 0);
    const color = colorFor(value, semantic, currentMode);
    colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
}

function colorFor(value: number, semantic: number, mode: ViewMode) {
  const low = new THREE.Color('#011726');
  const cyan = new THREE.Color('#16d9ff');
  const pink = new THREE.Color('#ff4fbd');
  const orange = new THREE.Color('#ff792d');
  const gold = new THREE.Color('#ffd470');

  if (mode === 'clusters') {
    const palette = ['#063453', '#7c4e9d', '#23dfff', '#ff8a35'];
    return new THREE.Color(palette[semantic] ?? palette[1]);
  }

  if (mode === 'interfaces') {
    const distance = Math.min(1, Math.abs(value - threshold) / 0.24);
    const base = low.clone().multiplyScalar(0.8 + value * 0.35);
    if (semantic === 2 || distance < 0.22) return cyan.clone().lerp(pink, 0.22 + value * 0.32);
    return base.lerp(new THREE.Color('#0b3852'), Math.max(0, 1 - distance) * 0.45);
  }

  const blend = smoothstep(threshold - 0.15, threshold + 0.15, value);
  const result = low.clone().lerp(orange, blend);
  if (semantic === 2 || Math.abs(value - threshold) < 0.055) result.lerp(cyan, 0.72);
  if (value > 0.78) result.lerp(gold, (value - 0.78) / 0.22);
  return result;
}

function updateRelief() {
  if (!fieldGeometry) return;
  const position = fieldGeometry.getAttribute('position') as THREE.BufferAttribute;
  for (let index = 0; index < fieldValues.length; index += 1) {
    position.setY(index, fieldHeight(fieldValues[index] ?? 0));
  }
  position.needsUpdate = true;
  fieldGeometry.computeVertexNormals();
  const normal = fieldGeometry.getAttribute('normal') as THREE.BufferAttribute;
  normal.needsUpdate = true;
  updateMarkerPositions();
}

function fieldHeight(value: number) {
  return (value - 0.5) * (0.15 + relief * 0.72) - 0.03;
}

function analyzeField(values: Float32Array, size: number) {
  return new Promise<AnalysisResult>((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AnalysisResult>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message));
      worker.terminate();
    };
    const copy = values.slice();
    worker.postMessage({ type: 'analyze', values: copy, width: size, height: size }, [copy.buffer]);
  });
}

function applyAnalysis() {
  if (!analysis) return;
  const { metrics } = analysis;
  ui.phaseBalance.textContent = `${Math.round(metrics.phaseFraction * 100)} / ${Math.round((1 - metrics.phaseFraction) * 100)}%`;
  ui.interfaceDensity.textContent = `${(metrics.interfaceDensity * 100).toFixed(1)}%`;
  ui.domainScale.textContent = `${Math.round(metrics.domainScaleNm)} nm`;
  ui.anisotropy.textContent = metrics.anisotropy.toFixed(2);
  const confidencePercent = Math.round(metrics.confidence * 100);
  ui.confidence.textContent = `${confidencePercent}%`;
  ui.confidenceRing.style.setProperty('--confidence', `${confidencePercent}%`);
  ui.analysisSummary.textContent = `Four morphology regimes resolved in ${metrics.elapsedMs.toFixed(0)} ms. ${metrics.components} connected islands and ${Math.round(metrics.entropy * 100)}% normalized field entropy support the ranked regions below.`;
  updateFieldColors();
  showFinding(0);
}

function showFinding(index: number, focus = false) {
  if (!analysis) return;
  const candidates = analysis.hotspots[currentObjective];
  if (candidates.length === 0) return;
  currentFinding = (index + candidates.length) % candidates.length;
  const finding = candidates[currentFinding]!;
  const rank = currentFinding + 1;
  const labelNames = ['Ni-rich interior', 'Transition zone', 'Coherent interface', 'Al-rich interior'];
  const objectiveCopy = {
    interface: {
      title: `${labelNames[finding.semanticLabel] ?? 'Interface'} with coupled curvature`,
      copy: `Composition changes rapidly here while local curvature stays elevated. This makes the patch useful for inspecting boundary continuity and possible coarsening fronts.`,
    },
    rare: {
      title: `Rare ${labelNames[finding.semanticLabel]?.toLowerCase() ?? 'morphology'} signature`,
      copy: `This sample sits unusually far from its learned cluster center. Local variance and curvature explain the rank without relying on a black-box narrative.`,
    },
    phase: {
      title: `Stable ${labelNames[finding.semanticLabel]?.toLowerCase() ?? 'phase'} reference`,
      copy: `Low boundary activity and a strong composition signal make this region a clean baseline for comparing phase interiors across the field.`,
    },
  } as const;
  const text = objectiveCopy[currentObjective];
  ui.findingIndex.textContent = `REGION ${String(rank).padStart(2, '0')} / ${String(candidates.length).padStart(2, '0')}`;
  ui.findingScore.textContent = `RANK ${Math.round(finding.score * 100)}`;
  ui.findingTitle.textContent = text.title;
  ui.findingCopy.textContent = text.copy;
  ui.evidence.replaceChildren(
    evidenceChip(`gradient ${percent(finding.gradient)}`),
    evidenceChip(`curvature ${percent(finding.curvature)}`),
    evidenceChip(`rarity ${percent(finding.rarity)}`),
  );
  updateMarkers(candidates, finding);
  announce(`${text.title}. Region ${rank} of ${candidates.length}.`);
  if (focus) focusOn(finding);
}

function updateMarkers(candidates: Hotspot[], active: Hotspot) {
  markers.clear();
  candidates.slice(0, 4).forEach((candidate, index) => {
    const isActive = candidate === active;
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(isActive ? 0.082 : 0.052, isActive ? 0.008 : 0.0045, 12, 64),
      new THREE.MeshBasicMaterial({
        color: isActive ? '#ff5bc4' : '#42ddff',
        transparent: true,
        opacity: isActive ? 0.95 : 0.42,
        depthTest: false,
      }),
    );
    marker.rotation.x = Math.PI / 2;
    marker.renderOrder = 20;
    marker.userData.gridX = candidate.x;
    marker.userData.gridY = candidate.y;
    marker.userData.active = isActive;
    marker.userData.phase = index * 0.9;
    markers.add(marker);
  });
  updateMarkerPositions();
}

function updateMarkerPositions() {
  markers.children.forEach((marker) => {
    const x = Number(marker.userData.gridX);
    const y = Number(marker.userData.gridY);
    const value = fieldValues[y * SAMPLE_SIZE + x] ?? 0;
    marker.position.set(
      (x / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE,
      fieldHeight(value) + 0.035,
      (y / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE,
    );
  });
}

function focusOn(finding: Hotspot) {
  const x = (finding.x / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE;
  const z = (finding.y / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE;
  const y = fieldHeight(finding.value);
  cameraTween = {
    target: new THREE.Vector3(x, y, z),
    position: new THREE.Vector3(x + 1.62, y + 1.18, z + 1.62),
  };
  activateCameraPreset('macro');
}

function setCameraPreset(name: string) {
  if (name === 'top') {
    cameraTween = { position: new THREE.Vector3(0, 4.45, 0.001), target: new THREE.Vector3(0, -0.02, 0) };
  } else if (name === 'macro') {
    const active = analysis?.hotspots[currentObjective][currentFinding];
    if (active) {
      const x = (active.x / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE;
      const z = (active.y / (SAMPLE_SIZE - 1) - 0.5) * PHYSICAL_SIZE;
      const y = fieldHeight(active.value);
      cameraTween = { position: new THREE.Vector3(x + 1.62, y + 1.18, z + 1.62), target: new THREE.Vector3(x, y, z) };
    } else {
      cameraTween = { position: new THREE.Vector3(1.55, 1.3, 1.55), target: new THREE.Vector3(0, 0, 0) };
    }
  } else {
    cameraTween = { position: new THREE.Vector3(3.25, 2.5, 3.25), target: new THREE.Vector3(0, -0.03, 0) };
  }
  activateCameraPreset(name);
}

function activateCameraPreset(name: string) {
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.camera === name);
  });
}

function setMode(mode: ViewMode) {
  currentMode = mode;
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  updateFieldColors();
  announce(`${mode === 'field' ? 'Phase field' : mode === 'clusters' ? 'AI clusters' : 'Interface'} view active.`);
}

function bindInterface() {
  ui.relief.addEventListener('input', () => {
    relief = Number(ui.relief.value) / 100;
    ui.reliefValue.textContent = `${ui.relief.value}%`;
    setRangeFill(ui.relief);
    updateRelief();
  });
  ui.threshold.addEventListener('input', () => {
    threshold = Number(ui.threshold.value) / 100;
    ui.thresholdValue.textContent = threshold.toFixed(2);
    setRangeFill(ui.threshold);
    updateFieldColors();
  });
  ui.objective.addEventListener('change', () => {
    currentObjective = ui.objective.value as Objective;
    showFinding(0);
  });
  ui.nextRegion.addEventListener('click', () => showFinding(currentFinding + 1));
  ui.focusButton.addEventListener('click', () => {
    const finding = analysis?.hotspots[currentObjective][currentFinding];
    if (finding) focusOn(finding);
  });
  ui.resetButton.addEventListener('click', () => setCameraPreset('perspective'));
  ui.motionToggle.addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    ui.motionToggle.classList.toggle('is-on', motionEnabled);
    ui.motionToggle.setAttribute('aria-checked', String(motionEnabled));
    announce(`Slow orbit ${motionEnabled ? 'enabled' : 'paused'}.`);
  });
  if (!motionEnabled) {
    ui.motionToggle.classList.remove('is-on');
    ui.motionToggle.setAttribute('aria-checked', 'false');
  }

  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode as ViewMode));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach((button) => {
    button.addEventListener('click', () => setCameraPreset(button.dataset.camera ?? 'perspective'));
  });

  ui.referenceButton.addEventListener('click', () => ui.referenceDialog.showModal());
  ui.methodButton.addEventListener('click', () => ui.methodDialog.showModal());
  if (CAPTURE_MODE) {
    ui.captureButton.hidden = false;
    ui.captureButton.addEventListener('click', () => void captureFrame());
  }
  document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
    button.addEventListener('click', () => required<HTMLDialogElement>(button.dataset.close ?? '').close());
  });
  [ui.referenceDialog, ui.methodDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === '1') setMode('field');
    if (event.key === '2') setMode('clusters');
    if (event.key === '3') setMode('interfaces');
    if (event.key.toLowerCase() === 'n') showFinding(currentFinding + 1);
    if (event.key.toLowerCase() === 'r') setCameraPreset('perspective');
    if (CAPTURE_MODE && event.key.toLowerCase() === 'c') void captureFrame();
    if (event.code === 'Space') {
      event.preventDefault();
      ui.motionToggle.click();
    }
  });

  const observer = new ResizeObserver(resizeRenderer);
  observer.observe(ui.viewport);
}

async function captureFrame() {
  const { default: html2canvas } = await import('html2canvas');
  renderer.render(scene, camera);
  const sceneFrame = renderer.domElement.toDataURL('image/png');
  const activeDialogId = ui.referenceDialog.open ? 'reference-dialog' : ui.methodDialog.open ? 'method-dialog' : null;
  const dialogName = activeDialogId === 'reference-dialog' ? 'provenance' : activeDialogId === 'method-dialog' ? 'method' : `${currentMode}-${currentObjective}`;
  const dialogImageFrames = activeDialogId
    ? Array.from(document.querySelectorAll<HTMLImageElement>(`#${activeDialogId} img`)).map(imageToDataUrl)
    : [];
  const capture = await html2canvas(document.body, {
    backgroundColor: '#020b13',
    height: window.innerHeight,
    logging: false,
    scale: 1,
    useCORS: true,
    width: window.innerWidth,
    windowHeight: window.innerHeight,
    windowWidth: window.innerWidth,
    onclone: (clonedDocument) => {
      clonedDocument.body.style.height = `${window.innerHeight}px`;
      clonedDocument.body.style.overflow = 'hidden';
      const captureButton = clonedDocument.getElementById('capture-button');
      if (captureButton) captureButton.style.display = 'none';
      const rendererText = clonedDocument.querySelector('#renderer-chip span:last-child');
      if (rendererText) rendererText.textContent = 'WebGPU · WebGL 2';
      const clonedCanvas = clonedDocument.querySelector<HTMLCanvasElement>('#viewport canvas');
      if (clonedCanvas) {
        const image = clonedDocument.createElement('img');
        image.src = sceneFrame;
        image.alt = '';
        image.style.position = 'absolute';
        image.style.inset = '0';
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'cover';
        clonedCanvas.replaceWith(image);
      }

      if (activeDialogId) {
        const originalDialog = clonedDocument.getElementById(activeDialogId);
        if (originalDialog) {
          originalDialog.style.display = 'none';
          const backdrop = clonedDocument.createElement('div');
          backdrop.style.position = 'fixed';
          backdrop.style.inset = '0';
          backdrop.style.zIndex = '9998';
          backdrop.style.background = 'rgba(0, 5, 9, 0.8)';
          const panel = createCaptureDialog(clonedDocument, activeDialogId, dialogImageFrames);
          clonedDocument.body.append(backdrop, panel);
        }
      }
    },
  });
  const blob = await new Promise<Blob>((resolve, reject) => {
    capture.toBlob((result) => result ? resolve(result) : reject(new Error('Frame encoding failed')), 'image/png');
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `web3d-frame-${dialogName}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  announce(`Captured ${dialogName} demo frame.`);
}

function imageToDataUrl(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context || canvas.width === 0 || canvas.height === 0) return image.currentSrc || image.src;
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function createCaptureDialog(documentClone: Document, dialogId: string, imageFrames: string[]) {
  const panel = documentClone.createElement('section');
  Object.assign(panel.style, {
    position: 'fixed',
    zIndex: '9999',
    left: '50%',
    top: '50%',
    width: dialogId === 'reference-dialog' ? '780px' : '690px',
    maxWidth: 'calc(100vw - 40px)',
    padding: '20px',
    transform: 'translate(-50%, -50%)',
    border: '1px solid rgba(113, 199, 230, 0.34)',
    borderRadius: '14px',
    background: '#061622',
    boxShadow: '0 40px 100px rgba(0, 0, 0, 0.7)',
    color: '#edf7ff',
    fontFamily: 'Inter, Segoe UI, sans-serif',
  });

  const eyebrow = documentClone.createElement('p');
  eyebrow.textContent = dialogId === 'reference-dialog' ? 'SOURCE → INTERPRETATION' : 'MODEL CARD';
  Object.assign(eyebrow.style, { margin: '0 0 4px', color: '#66bada', fontSize: '11px', fontWeight: '750', letterSpacing: '0.15em' });
  const title = documentClone.createElement('h2');
  title.textContent = dialogId === 'reference-dialog' ? 'Scientific provenance' : 'What the AI measures';
  Object.assign(title.style, { margin: '0 0 18px', fontSize: '20px', fontWeight: '660' });
  panel.append(eyebrow, title);

  if (dialogId === 'reference-dialog') {
    const grid = documentClone.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' });
    const cards = [
      { src: imageFrames[0] ?? './data/spinodal-field.png', title: 'Unmodified field', note: 'Deterministic phase-field output' },
      { src: imageFrames[1] ?? './art/coherent-dreams.png', title: 'Coherent Dreams', note: 'Human-directed AI interpretation' },
    ];
    for (const card of cards) {
      const figure = documentClone.createElement('figure');
      Object.assign(figure.style, { margin: '0', overflow: 'hidden', border: '1px solid rgba(135, 194, 225, 0.2)', borderRadius: '9px', background: '#07131d' });
      const image = documentClone.createElement('img');
      image.src = card.src;
      Object.assign(image.style, { display: 'block', width: '100%', aspectRatio: '1', objectFit: 'cover' });
      const caption = documentClone.createElement('figcaption');
      Object.assign(caption.style, { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px', fontSize: '12px' });
      const label = documentClone.createElement('b');
      label.textContent = card.title;
      const note = documentClone.createElement('span');
      note.textContent = card.note;
      note.style.color = '#638094';
      caption.append(label, note);
      figure.append(image, caption);
      grid.append(figure);
    }
    const copy = documentClone.createElement('p');
    copy.textContent = 'The 3D surface is computed from the unmodified scalar field. The artwork supplies the visual palette, never the measurements.';
    Object.assign(copy.style, { margin: '14px 0 0', color: '#7992a2', fontSize: '13px', lineHeight: '1.5' });
    panel.append(grid, copy);
  } else {
    const grid = documentClone.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' });
    const steps = [
      ['01', 'Feature field', 'Composition, gradient magnitude, absolute Laplacian, and local variance describe every sample.'],
      ['02', 'Unsupervised clustering', 'Seeded k-means separates phase interiors, transition zones, and high-energy interfaces.'],
      ['03', 'Grounded scout', 'Ranked regions cite measured gradient, curvature, and rarity. Nothing leaves the browser.'],
    ];
    for (const [number, heading, copy] of steps) {
      const card = documentClone.createElement('article');
      Object.assign(card.style, { minHeight: '180px', padding: '16px', border: '1px solid rgba(113, 184, 211, 0.16)', borderRadius: '8px', background: 'rgba(10, 31, 44, 0.78)' });
      const numberLabel = documentClone.createElement('span');
      numberLabel.textContent = number ?? '';
      Object.assign(numberLabel.style, { color: '#ff4fc3', fontFamily: 'Consolas, monospace', fontSize: '11px' });
      const headingLabel = documentClone.createElement('h3');
      headingLabel.textContent = heading ?? '';
      Object.assign(headingLabel.style, { margin: '32px 0 10px', color: '#edf7ff', fontSize: '15px' });
      const paragraph = documentClone.createElement('p');
      paragraph.textContent = copy ?? '';
      Object.assign(paragraph.style, { margin: '0', color: '#7891a0', fontSize: '12px', lineHeight: '1.55' });
      card.append(numberLabel, headingLabel, paragraph);
      grid.append(card);
    }
    const scope = documentClone.createElement('p');
    scope.innerHTML = '<b style="color:#d8e8ef">Scientific scope</b><br><span style="color:#7891a0">Exploratory visualization, not calibrated microscopy or a materials-property prediction.</span>';
    Object.assign(scope.style, { margin: '14px 0 0', padding: '12px 14px', borderLeft: '2px solid #ff8a35', background: 'rgba(255, 138, 53, 0.06)', fontSize: '12px', lineHeight: '1.5' });
    panel.append(grid, scope);
  }
  return panel;
}

function resizeRenderer() {
  const { width, height } = ui.viewport.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function startGuidedTour() {
  const tourSteps: Array<() => void> = [
    () => { setMode('field'); setCameraPreset('perspective'); },
    () => { setMode('clusters'); currentObjective = 'rare'; ui.objective.value = 'rare'; showFinding(0, true); },
    () => { setMode('interfaces'); currentObjective = 'interface'; ui.objective.value = 'interface'; showFinding(1, true); },
    () => { setMode('field'); setCameraPreset('top'); },
  ];
  let step = 0;
  tourSteps[0]!();
  window.setInterval(() => {
    step = (step + 1) % tourSteps.length;
    tourSteps[step]!();
  }, 9000);
}

function animate(time: number) {
  const seconds = time * 0.001;
  if (motionEnabled && controls.enabled) fieldGroup.rotation.y += 0.00032;
  markers.children.forEach((marker) => {
    const pulse = 1 + Math.sin(seconds * 2.3 + Number(marker.userData.phase ?? 0)) * (marker.userData.active ? 0.1 : 0.06);
    marker.scale.setScalar(pulse);
  });
  if (cameraTween) {
    camera.position.lerp(cameraTween.position, 0.055);
    controls.target.lerp(cameraTween.target, 0.065);
    if (camera.position.distanceTo(cameraTween.position) < 0.012 && controls.target.distanceTo(cameraTween.target) < 0.008) {
      camera.position.copy(cameraTween.position);
      controls.target.copy(cameraTween.target);
      cameraTween = null;
    }
  }
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
resizeRenderer();

async function loadScalarField(url: string, size: number) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, size, size);
  const rgba = context.getImageData(0, 0, size, size).data;
  const values = new Float32Array(size * size);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = (rgba[index * 4] ?? 0) / 255;
  }
  return values;
}

function evidenceChip(text: string) {
  const chip = document.createElement('span');
  chip.textContent = text;
  return chip;
}

function setRangeFill(input: HTMLInputElement) {
  const min = Number(input.min);
  const max = Number(input.max);
  const fill = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--range-fill', `${fill}%`);
}

function required<T extends HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}

function announce(message: string) {
  ui.liveStatus.textContent = '';
  window.setTimeout(() => { ui.liveStatus.textContent = message; }, 20);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

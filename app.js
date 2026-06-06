// ─── Emotion Mirror · app.js ───────────────────────────────────────────────

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];

const EMOTION_META = {
  happy:     { icon: '😄', color: '#e8ff47', label: 'Happy' },
  sad:       { icon: '😢', color: '#4da6ff', label: 'Sad' },
  angry:     { icon: '😠', color: '#ff4757', label: 'Angry' },
  surprised: { icon: '😲', color: '#ff9f43', label: 'Surprised' },
  fearful:   { icon: '😨', color: '#cd84f1', label: 'Fearful' },
  disgusted: { icon: '🤢', color: '#2ecc71', label: 'Disgusted' },
  neutral:   { icon: '😐', color: '#a0a0a0', label: 'Neutral' },
};

// ─── Sensitivity boosts ───────────────────────────────────────────────────────
// The model is biased toward neutral. These multipliers amplify non-neutral
// signals so they can compete. Tune these if needed.
const BOOST = {
  neutral:   0.6,   // dampened — it wins too easily
  happy:     1.2,
  sad:       1.8,
  angry:     1.8,
  fearful:   2.0,
  disgusted: 2.0,
  surprised: 1.5,
};

// ─── Smoothing ────────────────────────────────────────────────────────────────
// EMA alpha: higher = reacts faster but noisier; lower = smoother but slower
const EMA_ALPHA = 0.25;
let smoothed = { neutral:1, happy:0, sad:0, angry:0, fearful:0, disgusted:0, surprised:0 };

function applyEMA(raw) {
  EMOTIONS.forEach(e => {
    smoothed[e] = EMA_ALPHA * (raw[e] || 0) + (1 - EMA_ALPHA) * smoothed[e];
  });
  return { ...smoothed };
}

function applyBoost(expressions) {
  const boosted = {};
  let total = 0;
  EMOTIONS.forEach(e => {
    boosted[e] = (expressions[e] || 0) * BOOST[e];
    total += boosted[e];
  });
  // Renormalize so scores still sum to ~1
  if (total > 0) EMOTIONS.forEach(e => boosted[e] /= total);
  return boosted;
}

// ─── State ──────────────────────────────────────────────────────────────────
let lastEmotion = null;
let history = [];
let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 0;
let noFaceFrames = 0;
const NO_FACE_THRESHOLD = 8;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const video          = document.getElementById('video');
const overlay        = document.getElementById('overlay');
const ctx            = overlay.getContext('2d');
const statusDot      = document.getElementById('statusDot');
const statusLabel    = document.getElementById('statusLabel');
const noFaceOverlay  = document.getElementById('noFaceOverlay');
const multiFaceBadge = document.getElementById('multiFaceBadge');
const emotionIcon    = document.getElementById('emotionIcon');
const emotionName    = document.getElementById('emotionName');
const emotionSub     = document.getElementById('emotionSub');
const barsContainer  = document.getElementById('barsContainer');
const historyTrack   = document.getElementById('historyTrack');
const fpsLabel       = document.getElementById('fpsLabel');
const faceCountInfo  = document.getElementById('faceCountInfo');
const confLabel      = document.getElementById('confLabel');
const faceCountLabel = document.getElementById('faceCountLabel');
const dominantEmotion = document.getElementById('dominantEmotion');

// ─── Build bars ──────────────────────────────────────────────────────────────
function buildBars() {
  barsContainer.innerHTML = '';
  EMOTIONS.forEach(e => {
    const meta = EMOTION_META[e];
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${meta.label}</span>
      <div class="bar-track">
        <div class="bar-fill" id="bar-${e}" style="background:${meta.color};"></div>
      </div>
      <span class="bar-pct" id="pct-${e}">0%</span>
    `;
    barsContainer.appendChild(row);
  });
}

// ─── Set status ──────────────────────────────────────────────────────────────
function setStatus(state, label) {
  statusDot.className = 'status-dot ' + state;
  statusLabel.textContent = label;
}

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  buildBars();
  setStatus('loading', 'LOADING MODELS');

  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL);
    setStatus('loading', 'STARTING CAMERA');
    await startCamera();
    setStatus('ready', 'LIVE');
    requestAnimationFrame(detect);
  } catch (err) {
    console.error(err);
    setStatus('error', 'ERROR — check console');
  }
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
  });
  video.srcObject = stream;
  return new Promise(res => { video.onloadedmetadata = () => { video.play(); res(); }; });
}

// ─── Resize canvas ───────────────────────────────────────────────────────────
function syncCanvas() {
  const rect = video.getBoundingClientRect();
  if (overlay.width !== rect.width || overlay.height !== rect.height) {
    overlay.width  = rect.width;
    overlay.height = rect.height;
  }
}

// ─── Main detection loop ─────────────────────────────────────────────────────
async function detect() {
  requestAnimationFrame(detect);

  if (video.readyState < 2) return;
  syncCanvas();

  // FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fps = frameCount;
    frameCount = 0;
    lastFpsTime = now;
    fpsLabel.textContent = `${fps} FPS`;
  }

  const scaleX = overlay.width  / video.videoWidth;
  const scaleY = overlay.height / video.videoHeight;

  const detections = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
    .withFaceExpressions();

  ctx.clearRect(0, 0, overlay.width, overlay.height);

  const faceCount = detections.length;
  faceCountInfo.textContent = `${faceCount} face${faceCount !== 1 ? 's' : ''}`;

  if (faceCount > 1) {
    faceCountLabel.textContent = `${faceCount} FACES`;
    multiFaceBadge.classList.add('visible');
  } else {
    multiFaceBadge.classList.remove('visible');
  }

  if (faceCount === 0) {
    noFaceFrames++;
    if (noFaceFrames >= NO_FACE_THRESHOLD) {
      noFaceOverlay.classList.add('visible');
      clearEmotionPanel();
    }
    return;
  }

  noFaceFrames = 0;
  noFaceOverlay.classList.remove('visible');

  // Primary = largest face
  const primary = detections.reduce((a, b) =>
    a.detection.box.area > b.detection.box.area ? a : b
  );

  // Draw boxes
  detections.forEach((d, i) => {
    const box = d.detection.box;
    const x = box.x * scaleX;
    const y = box.y * scaleY;
    const w = box.width  * scaleX;
    const h = box.height * scaleY;

    const isPrimary = d === primary;
    // For display on box, use raw top emotion (no boost — just for the label)
    const rawTop = getRawTopEmotion(d.expressions);
    const color = isPrimary ? EMOTION_META[rawTop.name].color : '#ffffff44';

    ctx.strokeStyle = color;
    ctx.lineWidth   = isPrimary ? 2 : 1;
    ctx.strokeRect(x, y, w, h);

    const cs = 12;
    ctx.lineWidth = isPrimary ? 2.5 : 1.5;
    [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,dx,dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx*cs, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy*cs);
      ctx.stroke();
    });

    if (isPrimary) {
      const label = `${EMOTION_META[rawTop.name].icon} ${rawTop.name.toUpperCase()}`;
      ctx.font = 'bold 13px Syne, sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(label, x + 6, y - 8 > 0 ? y - 8 : y + 18);
    } else {
      ctx.font = '11px DM Mono, monospace';
      ctx.fillStyle = '#ffffff88';
      ctx.fillText(`FACE ${i+1}`, x + 4, y - 6 > 0 ? y - 6 : y + 14);
    }
  });

  // Pipeline: raw → boost → smooth → display
  const boosted  = applyBoost(primary.expressions);
  const final    = applyEMA(boosted);
  const topEmotion = getTopEmotion(final);

  updatePanel(final, topEmotion);
}

function getRawTopEmotion(expressions) {
  let name = 'neutral', score = 0;
  for (const [k, v] of Object.entries(expressions)) {
    if (v > score) { score = v; name = k; }
  }
  return { name, score };
}

function getTopEmotion(expressions) {
  let name = 'neutral', score = 0;
  for (const [k, v] of Object.entries(expressions)) {
    if (v > score) { score = v; name = k; }
  }
  return { name, score };
}

function updatePanel(expressions, top) {
  const meta = EMOTION_META[top.name] || EMOTION_META.neutral;

  if (top.name !== lastEmotion) {
    emotionIcon.classList.remove('pop');
    void emotionIcon.offsetWidth;
    emotionIcon.classList.add('pop');
    emotionIcon.textContent = meta.icon;
    emotionName.textContent = meta.label.toUpperCase();
    dominantEmotion.style.setProperty('--current-color', meta.color);
    emotionName.style.color = meta.color;
    addHistory(top.name, meta);
    lastEmotion = top.name;
  }

  emotionSub.textContent = `confidence ${(top.score * 100).toFixed(0)}%`;
  confLabel.textContent  = `CONF ${(top.score * 100).toFixed(0)}%`;

  EMOTIONS.forEach(e => {
    const pct = ((expressions[e] || 0) * 100).toFixed(1);
    const bar   = document.getElementById('bar-' + e);
    const pctEl = document.getElementById('pct-' + e);
    if (bar)   bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

function clearEmotionPanel() {
  emotionIcon.textContent = '—';
  emotionName.textContent = 'WAITING';
  emotionName.style.color = 'var(--text)';
  emotionSub.textContent = 'look into the camera';
  EMOTIONS.forEach(e => {
    const bar   = document.getElementById('bar-' + e);
    const pctEl = document.getElementById('pct-' + e);
    if (bar)   bar.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';
  });
  lastEmotion = null;
  confLabel.textContent = 'CONF —%';
  smoothed = { neutral:1, happy:0, sad:0, angry:0, fearful:0, disgusted:0, surprised:0 };
}

function addHistory(name, meta) {
  history.push({ name, meta });
  if (history.length > 18) history.shift();
  renderHistory();
}

function renderHistory() {
  historyTrack.innerHTML = '';
  history.forEach(h => {
    const pip = document.createElement('div');
    pip.className = 'history-pip';
    pip.title = h.meta.label;
    pip.textContent = h.meta.icon;
    pip.style.background = h.meta.color + '22';
    historyTrack.appendChild(pip);
  });
}

function waitForFaceApi() {
  if (typeof faceapi !== 'undefined') init();
  else setTimeout(waitForFaceApi, 100);
}

waitForFaceApi();
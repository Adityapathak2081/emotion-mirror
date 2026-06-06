# 🪞 Emotion Mirror

A real-time webcam app that detects faces and predicts emotions live — built with `face-api.js` on top of TensorFlow.js.

![Emotion Mirror UI](https://placeholder.co/800x400)

## Features

- 🎯 **Real-time emotion detection** — happy, sad, angry, surprised, fearful, disgusted, neutral
- 👥 **Multi-face support** — detects all faces; uses the closest/largest as primary
- 📊 **Live probability bars** — full spectrum of emotion scores, updated per frame
- 🕓 **Emotion history trail** — rolling history of recent emotion shifts
- 🚫 **No-face state** — graceful overlay when nobody is in frame
- ⚡ **FPS counter** — live performance monitoring
- 🎨 **Polished dark UI** — grain texture, animated logo, per-emotion accent colors

---

## Setup

### Option A — Quickest (Python, no install)

```bash
cd emotion-mirror
python3 -m http.server 8080
```

Then open: [http://localhost:8080](http://localhost:8080)

> **Why a local server?** Browsers block webcam access and ES module imports from `file://` URLs. A local server solves both.

### Option B — Node.js

```bash
cd emotion-mirror
npx serve .
```

Or with `live-server`:

```bash
npm install -g live-server
live-server
```

### Option C — VS Code

Install the **Live Server** extension by Ritwick Dey, right-click `index.html` → **Open with Live Server**.

---

## First-time load

On the very first visit, the browser will:
1. Download the face-api.js models (~6 MB total) from jsDelivr CDN
2. Request webcam permission — click **Allow**

After that, the status bar turns green and detection begins immediately.

---

## How it works

| Component | Library / Tech |
|-----------|---------------|
| Face detection | `TinyFaceDetector` (face-api.js) |
| Emotion classification | `FaceExpressionNet` (face-api.js) |
| Rendering | HTML5 Canvas overlay |
| UI | Vanilla HTML/CSS/JS — zero framework |

### Detection strategy

- All faces in frame are detected and drawn with bounding boxes
- The **largest bounding box** (person closest to camera) is treated as primary — its emotions drive the main panel
- A "MULTI-FACE" badge appears when more than one person is detected
- After ~8 consecutive frames with no face, a "no face" overlay fades in gracefully

---

## What I learned / found challenging

Building this surfaced a few interesting challenges:

**Model loading UX** was the first hurdle — face-api.js fetches several model files at startup, and without feedback the app just looks broken. Adding a clear `LOADING MODELS → STARTING CAMERA → LIVE` status flow made a huge difference to the perceived experience.

**The mirroring problem** was subtler than expected. The video element is CSS-mirrored (`scaleX(-1)`) so it feels natural to users, but the canvas overlay draws in raw video coordinates. The fix is to also apply `scaleX(-1)` to the canvas so the bounding boxes align correctly — took some debugging to land on.

**Multi-face handling** required a deliberate design decision: rather than averaging emotions across faces or showing a list, picking the primary face (largest area = closest = most prominent) keeps the UI focused and readable without becoming chaotic.

**Smoothing vs. responsiveness** is an ongoing tension in real-time detection. The current approach prioritises responsiveness (no smoothing) which can cause flickering between similar emotions (e.g. neutral ↔ happy at low confidence). A simple exponential moving average on the expression scores would reduce jitter — left as a future improvement.

---

## File structure

```
emotion-mirror/
├── index.html   ← markup & layout
├── style.css    ← all styles (CSS variables, animations)
├── app.js       ← detection loop, canvas drawing, UI updates
└── README.md    ← this file
```

---

## Browser compatibility

Tested on Chrome 120+, Firefox 121+, Safari 17+. Requires a device with a camera and a browser that supports `getUserMedia`.
#  Emotion Mirror

A real-time webcam app that detects faces and predicts emotions live — built with `face-api.js` on top of TensorFlow.js.

## Features

-  **Real-time emotion detection** — happy, sad, angry, surprised, fearful, disgusted, neutral
-  **Multi-face support** — detects all faces; uses the closest/largest as primary
-  **Live probability bars** — full spectrum of emotion scores, updated per frame
-  **Emotion history trail** — rolling history of recent emotion shifts
-  **No-face state** — graceful overlay when nobody is in frame
-  **FPS counter** — live performance monitoring
-  **Polished dark UI** — grain texture, animated logo, per-emotion accent colors

---

## Setup & Running Locally

### Prerequisites
- Python 3 installed
- A webcam
- A modern browser (Chrome recommended)

### Steps

1. Clone the repository:
```bash
git clone https://github.com/Adityapathak2081/emotion-mirror.git
cd emotion-mirror
```

2. Start a local server:
```bash
python -m http.server 8080
```

3. Open your browser and go to:
```
http://localhost:8080
```

4. Allow camera access when prompted — detection starts automatically.

> **Why a local server?** Browsers block webcam access from `file://` URLs. A local server solves this.

---

## How It Works

| Component | Library / Tech |
|-----------|---------------|
| Face detection | `TinyFaceDetector` (face-api.js) |
| Emotion classification | `FaceExpressionNet` (face-api.js) |
| Smoothing | Exponential Moving Average (EMA) across frames |
| Rendering | HTML5 Canvas overlay |
| UI | Vanilla HTML, CSS, JavaScript — no frameworks |

### Detection Pipeline
```
Webcam frame
    → TinyFaceDetector CNN → face bounding boxes
    → FaceExpressionNet CNN → raw emotion scores
    → Sensitivity boost (amplify non-neutral emotions)
    → EMA smoothing (stabilize across frames)
    → Display
```

### Edge Cases Handled
- **No face detected** — a pulsing overlay appears after a few empty frames
- **Multiple faces** — all faces are boxed; the largest (closest) drives the emotion panel
- **Noisy predictions** — EMA smoothing prevents flickering between similar emotions

---

## File Structure

```
emotion-mirror/
├── index.html   ← markup and layout
├── style.css    ← all styles, animations, CSS variables
├── app.js       ← detection loop, canvas drawing, UI updates
└── README.md    ← this file
```

---

## What I Learned & Found Challenging

The most interesting challenge was dealing with the model's bias toward **neutral**. The pre-trained `FaceExpressionNet` tends to predict neutral far too often because most real-world faces at rest look neutral, which is what the training data reflects. To fix this, I applied per-emotion sensitivity multipliers to the raw scores (boosting sad, angry, fearful, etc. while dampening neutral), then renormalized so scores still sum to 1. This made a huge difference in responsiveness.

Another tricky part was the **canvas mirroring problem**. The video is CSS-mirrored so it feels natural to the user, but the canvas draws in raw video coordinates — so bounding boxes were appearing on the wrong side of the face. The fix was to apply the same `scaleX(-1)` transform to the canvas element.

Finally, implementing **Exponential Moving Average smoothing** across frames taught me a lot about the tradeoff between responsiveness and stability in real-time ML applications — reacting too fast causes jitter, too slow and the app feels laggy.

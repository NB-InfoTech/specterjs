# SpecterJS - Browser Environment Audit & Fingerprinting Framework

A modern, modular, high-precision browser auditing and lie-detection tool in TypeScript. Evaluates browser runtime integrity, detects prototype tampering ("lies"), cross-checks window execution vs. web workers, and measures hardware entropy without relying on third-party tracking backend services.

## Features

- **Prototype Integrity** - Detects proxy overrides, modified native functions on `navigator`, `screen`, `canvas`, `WebGL`
- **Worker Cross-Check** - Spawns Dedicated Workers to detect execution context discrepancies
- **Hardware Entropy** - Canvas 2D, WebGL/WebGL2, shader fingerprinting with unmasked vendor/renderer
- **Web Audio Fingerprinting** - OfflineAudioContext oscillator + dynamics compressor entropy
- **Network & Timing** - WebRTC ICE candidate analysis, high-resolution timer precision
- **Trust Scoring** - Dynamic 0-100% integrity score with verdict classification
- **Cyber-Lab Dashboard** - Dark-mode real-time audit UI with anomaly visualization

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build (outputs to docs/)
npm run build

# Preview production build
npm run preview
```

## GitHub Pages Deployment

### Automatic (Recommended)

1. Push to `main`/`master` branch
2. GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys automatically
3. Enable GitHub Pages in repository settings: **Source** → **GitHub Actions**

### Manual

```bash
# Build and deploy to gh-pages branch
npm run deploy
```

**Configuration required:**
- Update `REPO_NAME` in `vite.config.ts` to match your repository name
- The `base` path is set to `/${REPO_NAME}/` for GitHub Pages project sites

### Custom Domain

If using a custom domain, set `base: '/'` in `vite.config.ts` and configure DNS accordingly.

## Architecture

```
src/
├── core/
│   ├── Engine.ts         # Async module orchestrator
│   ├── TrustScore.ts     # Weighted integrity scoring
│   └── types.ts          # Core type definitions
├── modules/
│   ├── prototypeIntegrity.ts   # Proxy/function tampering detection
│   ├── workerCrossCheck.ts     # Worker vs window context comparison
│   ├── canvasWebGL.ts          # Canvas/WebGL entropy probing
│   ├── webAudio.ts             # Audio fingerprinting
│   └── networkProbing.ts       # WebRTC/timing analysis
├── ui/
│   ├── Dashboard.ts      # Real-time audit dashboard
│   └── AnomalyVisualizer.ts    # Interactive anomaly tree
├── index.ts              # Entry point
└── style.css             # Cyber-lab dark theme
```

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

Requires: Web Workers, OffscreenCanvas, WebGL2, OfflineAudioContext, WebRTC

## License

MIT
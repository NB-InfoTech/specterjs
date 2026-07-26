# Project Overview

SpecterJS is a pure TypeScript browser environment audit and fingerprinting framework built with Vite. It runs 5 modular security checks (prototype integrity, worker cross-context verification, canvas/WebGL entropy, WebAudio fingerprinting, and network probing) to detect browser tampering, spoofing, and anomalies, displaying results via a custom dark-themed dashboard UI.

# Architecture & Coding Rules

- **Module isolation**: Each audit module lives in `src/modules/` as a standalone runner exporting a `ModuleRunner<T>` with `name`, `run()`, and `validate()`; modules are registered in the Engine and consumed by the Dashboard.
- **Type-driven core**: All data contracts (`Anomaly`, `AuditResult`, `TrustScore`, etc.) are defined in `src/core/types.ts` and imported across modules — no type duplication allowed.
- **UI layer separation**: UI components in `src/ui/` (Dashboard, AnomalyVisualizer) are pure DOM manipulation classes with no framework dependency; all styling lives in `src/style.css` under CSS custom properties.
- **File placement by concern**: Business logic in `src/core/`, audit checks in `src/modules/`, UI in `src/ui/`, entry point at `src/index.ts`, and static assets at project root.

# Completed Features

- [x] **Dashboard UI** — Dark-themed dashboard with trust score circle, module cards, metrics grid, anomaly list, config toggles, and progress bar during audit
- [x] **Trust Score Engine** — Weighted scoring across 5 dimensions (prototypeIntegrity, executionContext, hardwareEntropy, networkIntegrity, timingIntegrity) with verdict levels (trusted/suspicious/compromised/unknown)
- [x] **Prototype Integrity Module** — Checks navigator, screen, canvas, WebGL object prototypes for missing properties, unexpected own properties, getter anomalies, proxy detection, and function source tampering (23 native function checks)
- [x] **Worker Cross-Check Module** — Spawns a Web Worker to collect the same environment data (navigator, screen, timezone, hardwareConcurrency, timing) and compares against main thread values to detect execution context lies
- [x] **Canvas/WebGL Entropy Module** — Generates canvas 2D fingerprints (text, emoji rendering, gradients) and WebGL fingerprints (vendor, renderer, shader output, extensions) with vendor/renderer spoofing detection
- [x] **WebAudio Fingerprint Module** — Runs offline audio context rendering (oscillator, compressor, complex signal) to generate audio fingerprint and detect audio stack tampering
- [x] **Network Probing Module** — Gathers WebRTC ICE candidates for local IP leak detection, public IP exposure, and timing precision analysis with worker timing comparison
- [x] **Anomaly Legend Panel** — Togglable legend explaining severity levels (Critical/High/Medium/Low/Info) and anomaly categories (prototype tampering, execution context lie, hardware spoofing, network anomaly, timing anomaly, entropy anomaly)

# Active Task

- [ ] **Export report improvements** — The current export generates a JSON file; no planned improvements yet. Consider adding visual report export (PDF/screenshot) or anomaly filtering/search in the dashboard.

# Known Bugs / Open Edge Cases

- None currently

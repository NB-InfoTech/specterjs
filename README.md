# 👻 SpecterJS: High-Precision Browser Environment Audit & Fingerprinting Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0%2B-646CFF?logo=vite)](https://vitejs.dev/)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20On-GitHub%20Pages-brightgreen?logo=github)](https://NB-InfoTech.github.io/SpecterJS/)
[![YouTube Channel](https://img.shields.io/badge/YouTube-NB%20InfoTech-red?logo=youtube)](https://www.youtube.com/@NBInfoTech)

> **Live Demo:** [https://NB-InfoTech.github.io/SpecterJS/](https://NB-InfoTech.github.io/SpecterJS/)

---

## 📌 Overview

**SpecterJS** is an open-source, client-side browser runtime integrity framework engineered to expose browser inconsistencies, anti-fingerprinting overrides, and privacy hardening. Inspired by tools like *CreepJS*, SpecterJS probes deeply into client APIs to evaluate whether your browser environment is revealing authentic execution behavior or injecting synthetic data.

Developed and maintained by **NB InfoTech**, SpecterJS delivers technical transparency for security analysts, anti-detect browser developers, and privacy enthusiasts.

---

## 🔥 Key Features

- **🔍 Prototype Integrity & Lie Detection:** Inspects native function prototypes (`Function.prototype.toString`), detects JavaScript `Proxy` traps, and catches overridden browser objects on `navigator`, `screen`, and canvas contexts.
- **🧵 Web Worker Execution Cross-Checking:** Spawns an isolated Inline Web Worker thread via Blob to collect standard metrics (`userAgent`, `hardwareConcurrency`, `timezone`) and compares them against the main `window` context to uncover execution mismatches.
- **🎨 Hardware Entropy Engine (Canvas & WebGL):** 
  - Extracts 2D canvas rendered hashes using font fallback stacks and complex shape layers.
  - Queries unmasked GPU vendors and renderers (`WEBGL_debug_renderer_info`) and flags dynamic canvas noise spoofing (e.g., Brave Farbling or Canvas Defender).
- **🎵 Web Audio & Timing Fingerprinting:** Measures sample buffer outputs using an `OfflineAudioContext` with dynamics compressors and tracks micro-architectural timing signatures via `performance.now()`.
- **🌐 Network & WebRTC Diagnostics:** Collects local ICE candidate generation speeds and identifies network protocol behaviors.
- **🛡️ Security Extension & Privacy Hardening Detection:** 
  - **Bait Testing:** Detects active ad blockers and content filters (like uBlock Origin or AdGuard) via DOM and network baiting.
  - **Hardening Signals:** Detects Global Privacy Control (`GPC`), Do Not Track (`DNT`), and Firefox Resist Fingerprinting (`privacy.resistFingerprinting`).
- **📊 Dynamic Integrity Trust Scoring:** Computes a real-time integrity score (0% - 100%) highlighting detected anomalies and execution lies in a high-tech "Cyber Lab" dark dashboard UI.

---

## 🛠️ Architecture & Tech Stack

SpecterJS is built from the ground up for maximum performance and zero server overhead:

* **Language:** TypeScript (Strict Mode)
* **Bundler & Server:** Vite
* **Deployment:** GitHub Pages (Static Client-Side Execution)
* **Styling:** Custom Cyber-Lab Dark UI Theme

### Project Structure

```text
specterjs/
├── src/
│   ├── types/               # TypeScript interfaces & telemetry schemas
│   ├── core/                # Engine orchestration & dynamic Trust Score logic
│   ├── modules/
│   │   ├── prototypeIntegrity.ts  # Prototype overrides & Proxy trap detection
│   │   ├── workerCrossCheck.ts    # Web Worker context cross-referencing
│   │   ├── canvasWebGL.ts         # Hardware GPU entropy & noise analysis
│   │   ├── webAudio.ts            # AudioContext dynamics fingerprinting
│   │   ├── networkProbing.ts      # WebRTC timing & ICE gathering
│   │   └── hardeningProbing.ts    # Ad blocker & privacy signal detection
│   ├── ui/                  # Cyber Lab UI Dashboard & anomaly visualizers
│   ├── index.ts             # Entry point
│   └── style.css            # Cyber Lab UI theme
├── index.html
├── package.json
└── vite.config.ts

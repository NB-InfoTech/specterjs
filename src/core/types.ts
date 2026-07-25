export interface AuditResult {
  module: string;
  timestamp: number;
  duration: number;
  success: boolean;
  data: Record<string, unknown>;
  anomalies: Anomaly[];
  error?: string;
}

export interface Anomaly {
  id: string;
  module: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'prototype_tampering' | 'execution_context_lie' | 'hardware_spoofing' | 'network_anomaly' | 'timing_anomaly' | 'entropy_anomaly';
  description: string;
  expected: unknown;
  actual: unknown;
  evidence: Record<string, unknown>;
  confidence: number;
  timestamp: number;
}

export interface TrustScore {
  overall: number;
  breakdown: {
    prototypeIntegrity: number;
    executionContext: number;
    hardwareEntropy: number;
    networkIntegrity: number;
    timingIntegrity: number;
  };
  verdict: 'trusted' | 'suspicious' | 'compromised' | 'unknown';
  anomalies: Anomaly[];
  timestamp: number;
}

export interface PrototypeIntegrityResult {
  navigator: PrototypeCheckResult;
  screen: PrototypeCheckResult;
  canvas: PrototypeCheckResult;
  webgl: PrototypeCheckResult;
  globalPrototypes: PrototypeCheckResult[];
  proxyDetection: ProxyDetectionResult[];
  functionIntegrity: FunctionIntegrityResult[];
}

export interface PrototypeCheckResult {
  objectName: string;
  ownProperties: string[];
  prototypeProperties: string[];
  anomalies: PrototypeAnomaly[];
}

export interface PrototypeAnomaly {
  property: string;
  type: 'missing_prototype_property' | 'unexpected_own_property' | 'proxy_detected' | 'function_tampered' | 'getter_anomaly' | 'type_mismatch';
  expected: unknown;
  actual: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: Record<string, unknown>;
}

export interface ProxyDetectionResult {
  target: string;
  isProxy: boolean;
  traps?: string[];
  evidence: Record<string, unknown>;
}

export interface FunctionIntegrityResult {
  functionName: string;
  expectedSource: string;
  actualSource: string;
  isNative: boolean;
  isTampered: boolean;
  anomalies: string[];
}

export interface WorkerCrossCheckResult {
  navigator: WorkerComparisonResult;
  screen: WorkerComparisonResult;
  hardwareConcurrency: WorkerComparisonResult;
  language: WorkerComparisonResult;
  timezone: WorkerComparisonResult;
  timing: WorkerTimingResult;
  anomalies: WorkerAnomaly[];
}

export interface WorkerComparisonResult {
  windowValue: unknown;
  workerValue: unknown;
  match: boolean;
  discrepancy?: string;
}

export interface WorkerTimingResult {
  windowTiming: number;
  workerTiming: number;
  delta: number;
  anomaly: boolean;
}

export interface WorkerAnomaly {
  type: 'execution_context_lie';
  property: string;
  windowValue: unknown;
  workerValue: unknown;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

export interface CanvasWebGLResult {
  canvas2d: Canvas2DResult;
  webgl: WebGLResult;
  webgl2: WebGLResult;
  anomalies: CanvasWebGLAnomaly[];
}

export interface Canvas2DResult {
  fingerprint: string;
  emojiFingerprint: string;
  gradientFingerprint: string;
  textMetrics: TextMetricsResult;
  anomalies: Canvas2DAnomaly[];
}

export interface TextMetricsResult {
  width: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
}

export interface Canvas2DAnomaly {
  type: 'canvas_tampering' | 'emoji_rendering_anomaly' | 'font_metrics_anomaly' | 'gradient_anomaly';
  expected: unknown;
  actual: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface WebGLResult {
  vendor: string;
  renderer: string;
  version: string;
  shadingLanguageVersion: string;
  unmaskedVendor: string;
  unmaskedRenderer: string;
  extensions: string[];
  parameters: Record<string, number | string | boolean>;
  fingerprint: string;
  anomalies: WebGLAnomaly[];
}

export interface WebGLAnomaly {
  type: 'vendor_spoofing' | 'renderer_spoofing' | 'parameter_anomaly' | 'extension_anomaly' | 'shader_anomaly';
  parameter: string;
  expected: unknown;
  actual: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface WebAudioResult {
  fingerprint: string;
  oscillatorFingerprint: string;
  compressorFingerprint: string;
  latency: number;
  sampleRate: number;
  channelCount: number;
  anomalies: WebAudioAnomaly[];
}

export interface WebAudioAnomaly {
  type: 'audio_context_tampering' | 'oscillator_anomaly' | 'compressor_anomaly' | 'latency_anomaly' | 'sample_rate_anomaly';
  expected: unknown;
  actual: unknown;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface NetworkProbingResult {
  webrtc: WebRTCResult;
  timing: TimingResult;
  anomalies: NetworkAnomaly[];
}

export interface WebRTCResult {
  candidates: RTCIceCandidate[];
  candidateGenerationTime: number;
  candidateTypes: Record<string, number>;
  localIPs: string[];
  publicIPs: string[];
  anomalies: WebRTCAnomaly[];
}

export interface WebRTCAnomaly {
  type: 'ice_candidate_anomaly' | 'ip_leak' | 'candidate_generation_timing' | 'protocol_anomaly';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: Record<string, unknown>;
}

export interface TimingResult {
  highResolutionTiming: number[];
  timingPrecision: number;
  timingConsistency: number;
  anomalies: TimingAnomaly[];
}

export interface TimingAnomaly {
  type: 'timing_attack_mitigation' | 'timing_inconsistency' | 'reduced_precision';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: Record<string, unknown>;
}

export interface NetworkAnomaly {
  type: 'webrtc_anomaly' | 'timing_anomaly';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidence: Record<string, unknown>;
}

export interface SpecterConfig {
  modules: {
    prototypeIntegrity: boolean;
    workerCrossCheck: boolean;
    canvasWebGL: boolean;
    webAudio: boolean;
    networkProbing: boolean;
  };
  thresholds: {
    prototypeIntegrity: number;
    executionContext: number;
    hardwareEntropy: number;
    networkIntegrity: number;
    timingIntegrity: number;
  };
  workerTimeout: number;
  webRTCTimeout: number;
  audioTimeout: number;
  canvasTimeout: number;
}

export const DEFAULT_CONFIG: SpecterConfig = {
  modules: {
    prototypeIntegrity: true,
    workerCrossCheck: true,
    canvasWebGL: true,
    webAudio: true,
    networkProbing: true
  },
  thresholds: {
    prototypeIntegrity: 0.85,
    executionContext: 0.9,
    hardwareEntropy: 0.75,
    networkIntegrity: 0.8,
    timingIntegrity: 0.85
  },
  workerTimeout: 5000,
  webRTCTimeout: 10000,
  audioTimeout: 5000,
  canvasTimeout: 5000
};

export type ModuleName = keyof SpecterConfig['modules'];

export interface ModuleRunner<T> {
  name: ModuleName;
  run(config: SpecterConfig): Promise<AuditResult<T>>;
  validate(data: T): Anomaly[];
}

export type AuditResult<T> = Omit<AuditResult, 'data'> & { data: T };
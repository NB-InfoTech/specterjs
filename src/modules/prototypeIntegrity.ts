import type {
  AuditResult,
  Anomaly,
  PrototypeIntegrityResult,
  PrototypeCheckResult,
  PrototypeAnomaly,
  ProxyDetectionResult,
  FunctionIntegrityResult,
  SpecterConfig,
  ModuleRunner
} from '../core/types.js';

const EXPECTED_NAVIGATOR_PROTOTYPE_PROPS = [
  'appCodeName', 'appName', 'appVersion', 'platform', 'product',
  'userAgent', 'vendor', 'language', 'languages', 'cookieEnabled',
  'onLine', 'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints',
  'vendorSub', 'productSub', 'buildID', 'oscpu', 'connection',
  'mediaCapabilities', 'gpu', 'mediaDevices', 'bluetooth',
  'credentials', 'keyboard', 'locks', 'managed', 'mediaSession',
  'permissions', 'presentation', 'serviceWorker', 'storage',
  'wakeLock', 'xr', 'clipboard', 'hid', 'serial', 'usb',
  'getGamepads', 'getVRDisplays', 'javaEnabled', 'taintEnabled',
  'sendBeacon', 'vibrate', 'getBattery', 'registerProtocolHandler',
  'unregisterProtocolHandler', 'geolocation', 'doNotTrack',
  'deviceMemory', 'maxTouchPoints', 'hardwareConcurrency',
  'connection', 'userActivation', 'scheduling', 'virtualKeyboard',
  'windowControlsOverlay', 'onLine'
];

const EXPECTED_SCREEN_PROTOTYPE_PROPS = [
  'width', 'height', 'availWidth', 'availHeight', 'colorDepth',
  'pixelDepth', 'orientation', 'pixelDepth', 'deviceXDPI', 'deviceYDPI',
  'logicalXDPI', 'logicalYDPI', 'systemXDPI', 'systemYDPI',
  'availTop', 'availLeft', 'bufferDepth', 'updateInterval',
  'onchange', 'onorientationchange'
];

const EXPECTED_CANVAS_PROTOTYPE_PROPS = [
  'width', 'height', 'style', 'getContext', 'toDataURL', 'toBlob',
  'toBlobCallback', 'transferControlToOffscreen', 'captureStream',
  'getContextAttributes', 'requestPointerLock', 'exitPointerLock',
  'onpointerlockchange', 'onpointerlockerror'
];

const EXPECTED_WEBGL_PROTOTYPE_PROPS = [
  'canvas', 'drawingBufferWidth', 'drawingBufferHeight',
  'getContextAttributes', 'isContextLost', 'getExtension',
  'getSupportedExtensions', 'getParameter', 'getError',
  'getContextAttributes', 'isContextLost', 'getSupportedExtensions'
];

const NATIVE_FUNCTION_NAMES = [
  'toString', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
  'constructor', 'apply', 'call', 'bind', 'length', 'name',
  'prototype', 'arguments', 'caller'
];

const NATIVE_FUNCTION_SOURCES = new Map([
  ['navigator.getBattery', 'function getBattery() { [native code] }'],
  ['navigator.getGamepads', 'function getGamepads() { [native code] }'],
  ['navigator.javaEnabled', 'function javaEnabled() { [native code] }'],
  ['navigator.sendBeacon', 'function sendBeacon() { [native code] }'],
  ['navigator.vibrate', 'function vibrate() { [native code] }'],
  ['navigator.registerProtocolHandler', 'function registerProtocolHandler() { [native code] }'],
  ['navigator.unregisterProtocolHandler', 'function unregisterProtocolHandler() { [native code] }'],
  ['screen.orientation.lock', 'function lock() { [native code] }'],
  ['screen.orientation.unlock', 'function unlock() { [native code] }'],
  ['canvas.getContext', 'function getContext() { [native code] }'],
  ['canvas.toDataURL', 'function toDataURL() { [native code] }'],
  ['canvas.toBlob', 'function toBlob() { [native code] }'],
  ['WebGLRenderingContext.getParameter', 'function getParameter() { [native code] }'],
  ['WebGLRenderingContext.getExtension', 'function getExtension() { [native code] }'],
  ['AudioContext.createOscillator', 'function createOscillator() { [native code] }'],
  ['AudioContext.createDynamicsCompressor', 'function createDynamicsCompressor() { [native code] }'],
  ['RTCPeerConnection.createDataChannel', 'function createDataChannel() { [native code] }'],
  ['RTCPeerConnection.createOffer', 'function createOffer() { [native code] }'],
  ['RTCPeerConnection.createAnswer', 'function createAnswer() { [native code] }'],
  ['performance.now', 'function now() { [native code] }'],
  ['crypto.getRandomValues', 'function getRandomValues() { [native code] }'],
  ['crypto.subtle.digest', 'function digest() { [native code] }']
]);

const KNOWN_PROXY_TRAPS = [
  'get', 'set', 'has', 'deleteProperty', 'defineProperty',
  'getOwnPropertyDescriptor', 'ownKeys', 'getPrototypeOf',
  'setPrototypeOf', 'isExtensible', 'preventExtensions',
  'apply', 'construct'
];

function isProxy(target: unknown): { isProxy: boolean; traps?: string[] } {
  if ((typeof target !== 'object' && typeof target !== 'function') || target === null) {
    return { isProxy: false };
  }

  try {
    const proxy = new Proxy(target, {});
    const traps: string[] = [];
    
    for (const trap of KNOWN_PROXY_TRAPS) {
      try {
        const desc = Object.getOwnPropertyDescriptor(proxy, trap);
        if (desc) traps.push(trap);
      } catch {
        // trap might not exist
      }
    }
    
    return { isProxy: false };
  } catch {
    try {
      new Proxy(target, {});
      return { isProxy: true, traps: [] };
    } catch {
      return { isProxy: false };
    }
  }
}

function getPrototypeChain(obj: object): object[] {
  const chain: object[] = [];
  let current: object | null = obj;
  while (current && current !== Object.prototype) {
    chain.push(current);
    current = Object.getPrototypeOf(current);
  }
  return chain;
}

function getOwnPropertyNamesSafe(obj: object): string[] {
  try {
    return Object.getOwnPropertyNames(obj);
  } catch {
    return [];
  }
}

function getPropertyDescriptorSafe(obj: object, prop: string): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(obj, prop);
  } catch {
    return undefined;
  }
}

function isNativeFunction(fn: Function): boolean {
  const source = fn.toString();
  return source.includes('[native code]');
}

function getFunctionSource(fn: Function): string {
  try {
    return fn.toString();
  } catch {
    return '[unable to get source]';
  }
}

function checkPrototypeIntegrity(
  obj: object,
  expectedProps: string[],
  objectName: string
): PrototypeCheckResult {
  const ownProperties = getOwnPropertyNamesSafe(obj);
  const prototypeProperties: string[] = [];
  const anomalies: PrototypeAnomaly[] = [];
  
  const proto = Object.getPrototypeOf(obj);
  if (proto) {
    prototypeProperties.push(...getOwnPropertyNamesSafe(proto));
  }
  
  for (const prop of expectedProps) {
    const hasOwn = ownProperties.includes(prop);
    const hasProto = prototypeProperties.includes(prop);
    
    if (!hasOwn && !hasProto) {
      anomalies.push({
        property: prop,
        type: 'missing_prototype_property',
        expected: 'present on prototype',
        actual: 'missing',
        severity: 'medium',
        evidence: { objectName, property: prop, location: 'prototype chain' }
      });
    }
    
    if (hasOwn && !hasProto) {
      const desc = getPropertyDescriptorSafe(obj, prop);
      if (desc && (desc.get || desc.set)) {
        anomalies.push({
          property: prop,
          type: 'getter_anomaly',
          expected: 'data property on prototype',
          actual: 'accessor property on instance',
          severity: 'high',
          evidence: { objectName, property: prop, descriptor: desc }
        });
      }
    }
  }
  
  for (const prop of ownProperties) {
    if (!expectedProps.includes(prop) && !prop.startsWith('__') && !prop.startsWith('_')) {
      const desc = getPropertyDescriptorSafe(obj, prop);
      if (desc && typeof desc.value === 'function') {
        anomalies.push({
          property: prop,
          type: 'unexpected_own_property',
          expected: 'not present on instance',
          actual: 'function on instance',
          severity: 'low',
          evidence: { objectName, property: prop, type: 'function' }
        });
      }
    }
  }
  
  const proxyCheck = isProxy(obj);
  if (proxyCheck.isProxy) {
    anomalies.push({
      property: '[Proxy]',
      type: 'proxy_detected',
      expected: 'native object',
      actual: 'Proxy object detected',
      severity: 'critical',
      evidence: { objectName, traps: proxyCheck.traps }
    });
  }
  
  return {
    objectName,
    ownProperties,
    prototypeProperties,
    anomalies
  };
}

function detectProxies(targets: Record<string, unknown>): ProxyDetectionResult[] {
  const results: ProxyDetectionResult[] = [];
  
  for (const [name, target] of Object.entries(targets)) {
    if (target && typeof target === 'object') {
      try {
        const proxy = new Proxy(target as object, {});
        const isProxy = proxy !== target;
        
        let traps: string[] | undefined;
        if (isProxy) {
          try {
            const handler = {
              get: () => {},
              set: () => true,
              has: () => true
            };
            for (const trap of KNOWN_PROXY_TRAPS) {
              traps = traps || [];
              traps.push(trap);
            }
          } catch {
          }
        }
        
        results.push({
          target: name,
          isProxy,
          traps,
          evidence: { targetType: typeof target, constructor: (target as object).constructor?.name }
        });
      } catch {
        results.push({
          target: name,
          isProxy: false,
          evidence: { error: 'Unable to test proxy' }
        });
      }
    }
  }
  
  return results;
}

function checkFunctionIntegrity(): FunctionIntegrityResult[] {
  const results: FunctionIntegrityResult[] = [];
  
  for (const [name, expectedSource] of NATIVE_FUNCTION_SOURCES.entries()) {
    const parts = name.split('.');
    let obj: unknown = window;
    
    for (const part of parts.slice(0, -1)) {
      obj = (obj as Record<string, unknown>)?.[part];
      if (!obj) break;
    }
    
    const fnName = parts[parts.length - 1];
    const fn = obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[fnName] : undefined;
    
    if (typeof fn === 'function') {
      const actualSource = getFunctionSource(fn as Function);
      const isNative = isNativeFunction(fn as Function);
      const expectedBody = expectedSource.split('{')[1]?.split('}')[0] || '';
      const isTampered = !actualSource.includes('[native code]') || 
                         (expectedBody !== '' && !actualSource.includes(expectedBody));
      
      const anomalies: string[] = [];
      if (!isNative) anomalies.push('Function is not native');
      if (isTampered) anomalies.push('Function source code appears modified');
      if (actualSource.length > 500) anomalies.push('Function source unusually long');
      
      results.push({
        functionName: name,
        expectedSource,
        actualSource: actualSource.slice(0, 500),
        isNative,
        isTampered,
        anomalies
      });
    } else {
      results.push({
        functionName: name,
        expectedSource,
        actualSource: '[function not found]',
        isNative: false,
        isTampered: true,
        anomalies: ['Function not found or not a function']
      });
    }
  }
  
  return results;
}

function checkGlobalPrototypes(): PrototypeCheckResult[] {
  const results: PrototypeCheckResult[] = [];
  
  const globalObjects = [
    { obj: Array.prototype, name: 'Array.prototype', expected: ['push', 'pop', 'shift', 'unshift', 'slice', 'splice', 'map', 'filter', 'forEach', 'reduce', 'find', 'includes', 'indexOf', 'join', 'toString', 'length'] },
    { obj: Object.prototype, name: 'Object.prototype', expected: ['toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'] },
    { obj: Function.prototype, name: 'Function.prototype', expected: ['apply', 'call', 'bind', 'toString', 'length', 'name', 'prototype'] },
    { obj: String.prototype, name: 'String.prototype', expected: ['length', 'charAt', 'charCodeAt', 'slice', 'substring', 'substr', 'indexOf', 'lastIndexOf', 'toLowerCase', 'toUpperCase', 'trim', 'split', 'replace', 'match', 'search', 'includes', 'startsWith', 'endsWith'] },
    { obj: Number.prototype, name: 'Number.prototype', expected: ['toString', 'toFixed', 'toPrecision', 'toExponential', 'valueOf'] },
    { obj: Promise.prototype, name: 'Promise.prototype', expected: ['then', 'catch', 'finally', 'constructor'] },
    { obj: Map.prototype, name: 'Map.prototype', expected: ['get', 'set', 'has', 'delete', 'clear', 'size', 'forEach', 'keys', 'values', 'entries'] },
    { obj: Set.prototype, name: 'Set.prototype', expected: ['add', 'has', 'delete', 'clear', 'size', 'forEach', 'keys', 'values', 'entries'] }
  ];
  
  for (const { obj, name, expected } of globalObjects) {
    results.push(checkPrototypeIntegrity(obj, expected, name));
  }
  
  return results;
}

function calculatePrototypeIntegrityScore(result: PrototypeIntegrityResult): number {
  let totalChecks = 0;
  let passedChecks = 0;
  
  const allChecks = [
    ...Object.values(result).flatMap(r => 
      Array.isArray(r) ? r.flatMap((x: PrototypeCheckResult) => x.anomalies) : (r as PrototypeCheckResult).anomalies
    )
  ];
  
  for (const check of [result.navigator, result.screen, result.canvas, result.webgl, ...result.globalPrototypes]) {
    totalChecks += check.anomalies.length + check.prototypeProperties.length;
    passedChecks += check.prototypeProperties.length - check.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  }
  
  totalChecks += result.proxyDetection.length;
  passedChecks += result.proxyDetection.filter(p => !p.isProxy).length;
  
  totalChecks += result.functionIntegrity.length;
  passedChecks += result.functionIntegrity.filter(f => !f.isTampered).length;
  
  return totalChecks > 0 ? passedChecks / totalChecks : 1;
}

export async function runPrototypeIntegrity(config: SpecterConfig): Promise<AuditResult<PrototypeIntegrityResult>> {
  const startTime = performance.now();
  const anomalies: Anomaly[] = [];
  
  try {
    const navigatorResult = checkPrototypeIntegrity(navigator, EXPECTED_NAVIGATOR_PROTOTYPE_PROPS, 'navigator');
    const screenResult = checkPrototypeIntegrity(screen, EXPECTED_SCREEN_PROTOTYPE_PROPS, 'screen');
    
    const canvas = document.createElement('canvas');
    const canvasResult = checkPrototypeIntegrity(canvas, EXPECTED_CANVAS_PROTOTYPE_PROPS, 'HTMLCanvasElement.prototype');
    
    let webglResult: PrototypeCheckResult;
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        webglResult = checkPrototypeIntegrity(gl, EXPECTED_WEBGL_PROTOTYPE_PROPS, 'WebGLRenderingContext');
      } else {
        webglResult = {
          objectName: 'WebGLRenderingContext',
          ownProperties: [],
          prototypeProperties: [],
          anomalies: [{
            property: 'WebGLRenderingContext',
            type: 'missing_prototype_property',
            expected: 'available',
            actual: 'not available',
            severity: 'low',
            evidence: { reason: 'WebGL not supported' }
          }]
        };
      }
    } catch {
      webglResult = {
        objectName: 'WebGLRenderingContext',
        ownProperties: [],
        prototypeProperties: [],
        anomalies: [{
          property: 'WebGLRenderingContext',
          type: 'missing_prototype_property',
          expected: 'available',
          actual: 'error accessing',
          severity: 'low',
          evidence: { reason: 'Error accessing WebGL context' }
        }]
      };
    }
    
    const proxyTargets = {
      navigator,
      screen,
      window,
      document,
      canvas: HTMLCanvasElement.prototype,
      console,
      performance,
      crypto,
      localStorage,
      sessionStorage,
      indexedDB
    };
    const proxyDetection = detectProxies(proxyTargets);
    
    const functionIntegrity = checkFunctionIntegrity();
    
    const globalPrototypes = checkGlobalPrototypes();
    
    const result: PrototypeIntegrityResult = {
      navigator: navigatorResult,
      screen: screenResult,
      canvas: canvasResult,
      webgl: webglResult,
      globalPrototypes,
      proxyDetection,
      functionIntegrity
    };
    
    for (const check of [navigatorResult, screenResult, canvasResult, webglResult, ...globalPrototypes]) {
      for (const anomaly of check.anomalies) {
        anomalies.push({
          id: `proto-${check.objectName}-${anomaly.property}-${Date.now()}`,
          module: 'prototypeIntegrity',
          severity: anomaly.severity,
          category: anomaly.type === 'proxy_detected' ? 'execution_context_lie' : 'prototype_tampering',
          description: `Prototype anomaly on ${check.objectName}.${anomaly.property}: ${anomaly.type}`,
          expected: anomaly.expected,
          actual: anomaly.actual,
          evidence: anomaly.evidence,
          confidence: anomaly.severity === 'critical' ? 0.95 : anomaly.severity === 'high' ? 0.85 : 0.7,
          timestamp: Date.now()
        });
      }
    }
    
    for (const proxy of proxyDetection) {
      if (proxy.isProxy) {
        anomalies.push({
          id: `proxy-${proxy.target}-${Date.now()}`,
          module: 'prototypeIntegrity',
          severity: 'critical',
          category: 'execution_context_lie',
          description: `Proxy detected on ${proxy.target}`,
          expected: 'Native object',
          actual: 'Proxy object',
          evidence: proxy.evidence,
          confidence: 0.9,
          timestamp: Date.now()
        });
      }
    }
    
    for (const fn of functionIntegrity) {
      if (fn.isTampered) {
        anomalies.push({
          id: `fn-${fn.functionName}-${Date.now()}`,
          module: 'prototypeIntegrity',
          severity: fn.isNative ? 'high' : 'critical',
          category: 'prototype_tampering',
          description: `Function tampering detected: ${fn.functionName}`,
          expected: fn.expectedSource,
          actual: fn.actualSource,
          evidence: { anomalies: fn.anomalies },
          confidence: fn.isNative ? 0.8 : 0.95,
          timestamp: Date.now()
        });
      }
    }
    
    const duration = performance.now() - startTime;
    const score = calculatePrototypeIntegrityScore(result);
    
    return {
      module: 'prototypeIntegrity',
      timestamp: Date.now(),
      duration,
      success: true,
      data: result,
      anomalies
    };
  } catch (error) {
    return {
      module: 'prototypeIntegrity',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as PrototypeIntegrityResult,
      anomalies: [{
        id: `proto-error-${Date.now()}`,
        module: 'prototypeIntegrity',
        severity: 'critical',
        category: 'prototype_tampering',
        description: `Module execution failed: ${error instanceof Error ? error.message : String(error)}`,
        expected: 'Successful execution',
        actual: 'Error',
        evidence: { error: String(error) },
        confidence: 0.9,
        timestamp: Date.now()
      }],
      error: String(error)
    };
  }
}

export const prototypeIntegrityRunner: ModuleRunner<PrototypeIntegrityResult> = {
  name: 'prototypeIntegrity',
  run: runPrototypeIntegrity,
  validate: (data) => {
    const anomalies: Anomaly[] = [];
    // Additional validation logic here if needed
    return anomalies;
  }
};

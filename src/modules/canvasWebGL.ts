import type {
  AuditResult,
  Anomaly,
  CanvasWebGLResult,
  Canvas2DResult,
  Canvas2DAnomaly,
  WebGLResult,
  WebGLAnomaly,
  TextMetricsResult,
  SpecterConfig,
  ModuleRunner
} from '../core/types.js';

const CANVAS_WIDTH = 256;
const CANVAS_HEIGHT = 256;
const EMOJIS = ['🎨', '🖼️', '🎭', '🎪', '🎯', '🎲', '🃏', '🎴', '🀄', '🎰'];
const FONTS = ['12px Arial', '12px sans-serif', '12px monospace', '12px system-ui'];

function hashBuffer(buffer: ArrayBuffer | ArrayBufferView): string {
  const data = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function getCanvasFingerprint(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-context';
  
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.fillStyle = '#333';
  ctx.font = '14px Arial';
  ctx.fillText('SpecterJS Canvas Fingerprint', 10, 30);
  
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.fillText(`Canvas: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, 10, 50);
  ctx.fillText(`UA: ${navigator.userAgent.slice(0, 50)}`, 10, 70);
  
  for (let i = 0; i < 10; i++) {
    const x = Math.sin(i * 0.5) * 80 + 128;
    const y = Math.cos(i * 0.5) * 80 + 128;
    ctx.beginPath();
    ctx.arc(x, y, 10 + i * 2, 0, Math.PI * 2);
    ctx.strokeStyle = `hsl(${i * 36}, 70%, 50%)`;
    ctx.lineWidth = 1 + i * 0.2;
    ctx.stroke();
  }
  
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(50, 50, 100, 100);
  ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
  ctx.fillRect(100, 100, 100, 100);
  ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
  ctx.fillRect(150, 50, 100, 100);
  
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#ff0000');
  gradient.addColorStop(0.5, '#00ff00');
  gradient.addColorStop(1, '#0000ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 200, CANVAS_WIDTH, 56);
  
  const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
  return hashBuffer(data);
}

function getEmojiFingerprint(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-context';
  
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  ctx.font = '48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (let i = 0; i < EMOJIS.length; i++) {
    const x = (i % 5) * 50 + 25;
    const y = Math.floor(i / 5) * 60 + 80;
    ctx.fillText(EMOJIS[i], x, y);
  }
  
  const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
  return hashBuffer(data);
}

function getGradientFingerprint(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'no-context';
  
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  const grad1 = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  grad1.addColorStop(0, '#ff0000');
  grad1.addColorStop(0.25, '#ffff00');
  grad1.addColorStop(0.5, '#00ff00');
  grad1.addColorStop(0.75, '#00ffff');
  grad1.addColorStop(1, '#0000ff');
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  
  const grad2 = ctx.createRadialGradient(
    CANVAS_WIDTH / 2, CANVAS_HEIGHT * 3 / 4, 0,
    CANVAS_WIDTH / 2, CANVAS_HEIGHT * 3 / 4, Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2
  );
  grad2.addColorStop(0, '#ffffff');
  grad2.addColorStop(0.5, '#ff00ff');
  grad2.addColorStop(1, '#000000');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  
  const pattern = ctx.createPattern(canvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, 10, 10);
  }
  
  const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).data;
  return hashBuffer(data);
}

function getTextMetrics(ctx: CanvasRenderingContext2D): TextMetricsResult {
  const text = 'SpecterJS 🎨 Fingerprint Test';
  const metrics = ctx.measureText(text);
  
  return {
    width: metrics.width,
    actualBoundingBoxLeft: metrics.actualBoundingBoxLeft ?? 0,
    actualBoundingBoxRight: metrics.actualBoundingBoxRight ?? 0,
    fontBoundingBoxAscent: metrics.fontBoundingBoxAscent ?? 0,
    fontBoundingBoxDescent: metrics.fontBoundingBoxDescent ?? 0
  };
}

function getCanvas2DResult(): Canvas2DResult {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      fingerprint: 'no-context',
      emojiFingerprint: 'no-context',
      gradientFingerprint: 'no-context',
      textMetrics: { width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0, fontBoundingBoxAscent: 0, fontBoundingBoxDescent: 0 },
      anomalies: []
    };
  }
  
  const anomalies: Canvas2DAnomaly[] = [];
  
  const fingerprint = getCanvasFingerprint(canvas);
  const emojiFingerprint = getEmojiFingerprint(canvas);
  const gradientFingerprint = getGradientFingerprint(canvas);
  const textMetrics = getTextMetrics(ctx);
  
  const expectedWidth = ctx.measureText('SpecterJS 🎨 Fingerprint Test').width;
  if (Math.abs(textMetrics.width - expectedWidth) > 2) {
    anomalies.push({
      type: 'font_metrics_anomaly',
      expected: expectedWidth,
      actual: textMetrics.width,
      severity: 'medium'
    });
  }
  
  return {
    fingerprint,
    emojiFingerprint,
    gradientFingerprint,
    textMetrics,
    anomalies
  };
}

function getWebGLResult(version: 1 | 2): WebGLResult {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  
  const ctx = version === 1 
    ? canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    : canvas.getContext('webgl2');
  
  if (!ctx) {
    return {
      vendor: 'unavailable',
      renderer: 'unavailable',
      version: 'unavailable',
      shadingLanguageVersion: 'unavailable',
      unmaskedVendor: 'unavailable',
      unmaskedRenderer: 'unavailable',
      extensions: [],
      parameters: {},
      fingerprint: 'no-context',
      anomalies: []
    };
  }
  
  const gl = ctx as WebGLRenderingContext | WebGL2RenderingContext;
  const anomalies: WebGLAnomaly[] = [];
  
  const getParam = (param: number): unknown => {
    try {
      return gl.getParameter(param);
    } catch {
      return 'error';
    }
  };
  
  const getExtension = (name: string) => gl.getExtension(name);
  
  const vendor = getParam(gl.VENDOR) as string;
  const renderer = getParam(gl.RENDERER) as string;
  const versionStr = getParam(gl.VERSION) as string;
  const shadingLanguageVersion = getParam(gl.SHADING_LANGUAGE_VERSION) as string;
  
  let unmaskedVendor = 'unavailable';
  let unmaskedRenderer = 'unavailable';
  
  const debugRendererInfo = getExtension('WEBGL_debug_renderer_info');
  if (debugRendererInfo) {
    unmaskedVendor = getParam(debugRendererInfo.UNMASKED_VENDOR_WEBGL) as string;
    unmaskedRenderer = getParam(debugRendererInfo.UNMASKED_RENDERER_WEBGL) as string;
  }
  
  const extensions = gl.getSupportedExtensions() || [];
  extensions.sort();
  
  const parameters: Record<string, number | string | boolean> = {};
  const paramNames: Record<string, number> = {
    'MAX_TEXTURE_SIZE': gl.MAX_TEXTURE_SIZE,
    'MAX_VIEWPORT_DIMS': gl.MAX_VIEWPORT_DIMS,
    'MAX_VERTEX_ATTRIBS': gl.MAX_VERTEX_ATTRIBS,
    'MAX_VERTEX_UNIFORM_VECTORS': gl.MAX_VERTEX_UNIFORM_VECTORS,
    'MAX_FRAGMENT_UNIFORM_VECTORS': gl.MAX_FRAGMENT_UNIFORM_VECTORS,
    'MAX_VARYING_VECTORS': gl.MAX_VARYING_VECTORS,
    'MAX_VERTEX_TEXTURE_IMAGE_UNITS': gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS,
    'MAX_TEXTURE_IMAGE_UNITS': gl.MAX_TEXTURE_IMAGE_UNITS,
    'MAX_COMBINED_TEXTURE_IMAGE_UNITS': gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS,
    'ALIASED_POINT_SIZE_RANGE': gl.ALIASED_POINT_SIZE_RANGE,
    'ALIASED_LINE_WIDTH_RANGE': gl.ALIASED_LINE_WIDTH_RANGE,
    'RED_BITS': gl.RED_BITS,
    'GREEN_BITS': gl.GREEN_BITS,
    'BLUE_BITS': gl.BLUE_BITS,
    'ALPHA_BITS': gl.ALPHA_BITS,
    'DEPTH_BITS': gl.DEPTH_BITS,
    'STENCIL_BITS': gl.STENCIL_BITS,
    'SUBPIXEL_BITS': gl.SUBPIXEL_BITS,
    'SAMPLES': gl.SAMPLES,
    'SAMPLE_BUFFERS': gl.SAMPLE_BUFFERS
  };
  
  if (version === 2) {
    Object.assign(paramNames, {
      'MAX_3D_TEXTURE_SIZE': (gl as WebGL2RenderingContext).MAX_3D_TEXTURE_SIZE,
      'MAX_ARRAY_TEXTURE_LAYERS': (gl as WebGL2RenderingContext).MAX_ARRAY_TEXTURE_LAYERS,
      'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS': (gl as WebGL2RenderingContext).MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS,
      'MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS': (gl as WebGL2RenderingContext).MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS,
      'MAX_UNIFORM_BLOCK_SIZE': (gl as WebGL2RenderingContext).MAX_UNIFORM_BLOCK_SIZE,
      'MAX_UNIFORM_BUFFER_BINDINGS': (gl as WebGL2RenderingContext).MAX_UNIFORM_BUFFER_BINDINGS,
      'MAX_VARYING_COMPONENTS': (gl as WebGL2RenderingContext).MAX_VARYING_COMPONENTS,
      'MAX_VERTEX_OUTPUT_COMPONENTS': (gl as WebGL2RenderingContext).MAX_VERTEX_OUTPUT_COMPONENTS,
      'MAX_FRAGMENT_INPUT_COMPONENTS': (gl as WebGL2RenderingContext).MAX_FRAGMENT_INPUT_COMPONENTS,
      'MIN_PROGRAM_TEXEL_OFFSET': (gl as WebGL2RenderingContext).MIN_PROGRAM_TEXEL_OFFSET,
      'MAX_PROGRAM_TEXEL_OFFSET': (gl as WebGL2RenderingContext).MAX_PROGRAM_TEXEL_OFFSET,
      'MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS': (gl as WebGL2RenderingContext).MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS
    });
  }
  
  for (const [name, param] of Object.entries(paramNames)) {
    parameters[name] = getParam(param) as number | string | boolean;
  }
  
  const fragShaderSrc = `
    precision mediump float;
    void main() {
      gl_FragColor = vec4(
        fract(sin(gl_FragCoord.x * 12.9898 + gl_FragCoord.y * 78.233) * 43758.5453),
        fract(sin(gl_FragCoord.x * 39.346 + gl_FragCoord.y * 11.135) * 43758.5453),
        fract(sin(gl_FragCoord.x * 17.987 + gl_FragCoord.y * 23.456) * 43758.5453),
        1.0
      );
    }
  `;
  
  const vertShaderSrc = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;
  
  let shaderFingerprint = 'shader-error';
  
  try {
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertShader) throw new Error('Unable to create vertex shader');
    gl.shaderSource(vertShader, vertShaderSrc);
    gl.compileShader(vertShader);
    
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragShader) throw new Error('Unable to create fragment shader');
    gl.shaderSource(fragShader, fragShaderSrc);
    gl.compileShader(fragShader);
    
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.useProgram(program);
      
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
      ]), gl.STATIC_DRAW);
      
      const positionLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
      
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      const pixels = new Uint8Array(4 * 4);
      gl.readPixels(0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      shaderFingerprint = hashBuffer(pixels);
    }
    
    gl.deleteProgram(program);
    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
  } catch {
    shaderFingerprint = 'shader-exception';
  }
  
  const fingerprintData = `${vendor}|${renderer}|${versionStr}|${shadingLanguageVersion}|${unmaskedVendor}|${unmaskedRenderer}|${extensions.join(',')}|${JSON.stringify(parameters)}|${shaderFingerprint}`;
  const fingerprint = hashString(fingerprintData);
  
  if (vendor !== unmaskedVendor && unmaskedVendor !== 'unavailable') {
    anomalies.push({
      type: 'vendor_spoofing',
      parameter: 'VENDOR',
      expected: unmaskedVendor,
      actual: vendor,
      severity: 'high'
    });
  }
  
  if (renderer !== unmaskedRenderer && unmaskedRenderer !== 'unavailable') {
    anomalies.push({
      type: 'renderer_spoofing',
      parameter: 'RENDERER',
      expected: unmaskedRenderer,
      actual: renderer,
      severity: 'high'
    });
  }
  
  const expectedExtensions = ['OES_texture_float', 'OES_texture_half_float', 'WEBGL_debug_renderer_info'];
  for (const ext of expectedExtensions) {
    if (!extensions.includes(ext)) {
      anomalies.push({
        type: 'extension_anomaly',
        parameter: ext,
        expected: 'present',
        actual: 'missing',
        severity: 'low'
      });
    }
  }
  
  return {
    vendor,
    renderer,
    version: versionStr,
    shadingLanguageVersion,
    unmaskedVendor,
    unmaskedRenderer,
    extensions,
    parameters,
    fingerprint,
    anomalies
  };
}

function calculateCanvasWebGLScore(result: CanvasWebGLResult): number {
  let score = 1;
  let totalChecks = 0;
  
  for (const anomaly of result.canvas2d.anomalies) {
    totalChecks++;
    if (anomaly.severity !== 'critical') score -= 0.1;
  }
  
  for (const glResult of [result.webgl, result.webgl2]) {
    for (const anomaly of glResult.anomalies) {
      totalChecks++;
      if (anomaly.severity === 'critical') score -= 0.3;
      else if (anomaly.severity === 'high') score -= 0.2;
      else if (anomaly.severity === 'medium') score -= 0.1;
      else score -= 0.05;
    }
    totalChecks++;
    if (glResult.unmaskedVendor !== 'unavailable' && glResult.vendor !== glResult.unmaskedVendor) {
      score -= 0.2;
    }
    if (glResult.unmaskedRenderer !== 'unavailable' && glResult.renderer !== glResult.unmaskedRenderer) {
      score -= 0.2;
    }
  }
  
  return Math.max(0, Math.min(1, score));
}

export async function runCanvasWebGL(config: SpecterConfig): Promise<AuditResult<CanvasWebGLResult>> {
  const startTime = performance.now();
  const anomalies: Anomaly[] = [];
  
  try {
    const canvas2d = getCanvas2DResult();
    const webgl = getWebGLResult(1);
    const webgl2 = getWebGLResult(2);
    
    const result: CanvasWebGLResult = {
      canvas2d,
      webgl,
      webgl2,
      anomalies: []
    };
    
    for (const anomaly of canvas2d.anomalies) {
      anomalies.push({
        id: `canvas2d-${anomaly.type}-${Date.now()}`,
        module: 'canvasWebGL',
        severity: anomaly.severity,
        category: 'hardware_spoofing',
        description: `Canvas 2D anomaly: ${anomaly.type}`,
        expected: anomaly.expected,
        actual: anomaly.actual,
        evidence: { type: anomaly.type },
        confidence: anomaly.severity === 'critical' ? 0.9 : 0.7,
        timestamp: Date.now()
      });
    }
    
    for (const [glResult, label] of [[webgl, 'webgl1'], [webgl2, 'webgl2']] as const) {
      for (const anomaly of glResult.anomalies) {
        anomalies.push({
          id: `${label}-${anomaly.type}-${Date.now()}`,
          module: 'canvasWebGL',
          severity: anomaly.severity,
          category: anomaly.type.includes('spoofing') ? 'hardware_spoofing' : 'entropy_anomaly',
          description: `WebGL (${label}) anomaly: ${anomaly.type} on ${anomaly.parameter}`,
          expected: anomaly.expected,
          actual: anomaly.actual,
          evidence: { parameter: anomaly.parameter, type: anomaly.type, context: label },
          confidence: anomaly.severity === 'critical' ? 0.95 : anomaly.severity === 'high' ? 0.85 : 0.7,
          timestamp: Date.now()
        });
      }
    }
    
    const duration = performance.now() - startTime;
    const score = calculateCanvasWebGLScore(result);
    
    return {
      module: 'canvasWebGL',
      timestamp: Date.now(),
      duration,
      success: true,
      data: result,
      anomalies
    };
  } catch (error) {
    return {
      module: 'canvasWebGL',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as CanvasWebGLResult,
      anomalies: [{
        id: `canvas-error-${Date.now()}`,
        module: 'canvasWebGL',
        severity: 'critical',
        category: 'hardware_spoofing',
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

export const canvasWebGLRunner: ModuleRunner<CanvasWebGLResult> = {
  name: 'canvasWebGL',
  run: runCanvasWebGL,
  validate: (data) => {
    const anomalies: Anomaly[] = [];
    if (!data.canvas2d.fingerprint || data.canvas2d.fingerprint === 'no-context') {
      anomalies.push({
        id: `canvas-validate-${Date.now()}`,
        module: 'canvasWebGL',
        severity: 'high',
        category: 'entropy_anomaly',
        description: 'Canvas 2D fingerprint unavailable',
        expected: 'Valid fingerprint',
        actual: data.canvas2d.fingerprint,
        evidence: {},
        confidence: 0.8,
        timestamp: Date.now()
      });
    }
    return anomalies;
  }
};

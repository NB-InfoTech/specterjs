import type { Anomaly } from '../core/types.js';

const ANOMALY_IMPACT: Record<string, { label: string; impact: string }> = {
  prototype_tampering: {
    label: 'Prototype Tampering',
    impact: 'Built-in JavaScript prototypes (Object, Array, Navigator, etc.) have been modified — indicates a browser extension, anti-fingerprinting tool, or malware is intercepting and altering core browser APIs to fake environment properties, which compromises all downstream fingerprinting checks.'
  },
  execution_context_lie: {
    label: 'Execution Context Lie',
    impact: 'Values reported on the main thread differ from those inside a Web Worker — the most reliable indicator of spoofing, because Workers run in a separate context that most spoofing tools cannot intercept. Discrepancies mean an extension/proxy is modifying property access only on the main thread.'
  },
  hardware_spoofing: {
    label: 'Hardware Spoofing',
    impact: 'GPU vendor/renderer strings or canvas/audio fingerprints deviate from expected hardware identifiers — confirms a spoofing tool is fabricating graphics or audio hardware identity to bypass device fingerprinting and evade tracking detection.'
  },
  network_anomaly: {
    label: 'Network Anomaly',
    impact: 'WebRTC ICE candidate gathering or timing behavior is abnormal — suggests a VPN, proxy, Docker/VM environment, or network-level interception is altering the browser\'s network view, which can be used to bypass geo-restrictions or hide the true origin.'
  },
  timing_anomaly: {
    label: 'Timing Anomaly',
    impact: 'High-resolution timer precision is reduced or timing measurements are inconsistent across contexts — privacy-focused browsers and anti-fingerprinting tools deliberately reduce timer precision (e.g., 100ms rounding) to prevent timing-based side-channel attacks and canvas fingerprinting via elapsed measurement.'
  },
  entropy_anomaly: {
    label: 'Entropy Anomaly',
    impact: 'Canvas, WebGL, or WebAudio fingerprints exhibit abnormal uniformity, zero variance, or match known spoofing tool signatures — genuine hardware produces unique, varied rendering output; uniform/deterministic output almost certainly means a spoofing layer is intercepting and returning synthetic values.'
  }
};

const SEVERITY_LEGEND = [
  { level: 'critical', label: 'Critical', color: '#ff3344', description: 'Critical security issue - immediate action required. Indicates active tampering, spoofing, or compromise.' },
  { level: 'high', label: 'High', color: '#ff6600', description: 'High severity anomaly - strong indicator of manipulation. Likely spoofing or tampering detected.' },
  { level: 'medium', label: 'Medium', color: '#ffaa00', description: 'Moderate anomaly - suspicious behavior detected. May indicate partial spoofing or unusual configuration.' },
  { level: 'low', label: 'Low', color: '#00aaee', description: 'Low severity - minor deviation from expected behavior. Could be benign configuration difference.' },
  { level: 'info', label: 'Info', color: '#888888', description: 'Informational - deviation noted but likely benign. Useful for fingerprinting identification.' }
];

const CATEGORY_LEGEND = [
  { category: 'prototype_tampering', label: 'Prototype Tampering', description: 'JavaScript prototype manipulation detected. Properties added/removed/modified on built-in prototypes (Object, Array, Navigator, etc.) or proxies intercepting property access.' },
  { category: 'execution_context_lie', label: 'Execution Context Lie', description: 'Discrepancy between main thread and Web Worker execution contexts. Values like navigator, screen, hardwareConcurrency, or timing differ between contexts - indicates spoofing.' },
  { category: 'hardware_spoofing', label: 'Hardware Spoofing', description: 'Canvas/WebGL/WebGPU or Web Audio fingerprint anomalies. GPU vendor/renderer spoofing, canvas fingerprint manipulation, or audio stack tampering detected.' },
  { category: 'network_anomaly', label: 'Network Anomaly', description: 'WebRTC ICE candidate anomalies: local IP leaks, unexpected candidate types, unusual candidate generation timing, or protocol anomalies suggesting VPN/proxy/tampering.' },
  { category: 'timing_anomaly', label: 'Timing Anomaly', description: 'High-resolution timing inconsistencies: reduced precision (privacy budget), timing attack mitigations, or inconsistent timing measurements across contexts.' },
  { category: 'entropy_anomaly', label: 'Entropy Anomaly', description: 'Abnormal entropy/fingerprint values: canvas/WebGL/WebAudio fingerprints with unexpected uniformity, missing variance, or values matching known spoofing tools.' }
];

export class AnomalyVisualizer {
  private container: HTMLElement;
  private anomalies: Anomaly[] = [];
  private showLegend = false;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }
  
  setAnomalies(anomalies: Anomaly[]): void {
    this.anomalies = anomalies;
    this.render();
  }
  
  private render(): void {
    if (!this.container) return;
    
    if (this.anomalies.length === 0) {
      this.container.innerHTML = `
        <div class="anomaly-empty">
          <div class="empty-icon">✓</div>
          <div class="empty-text">No anomalies detected</div>
          <div class="empty-subtext">Browser environment appears clean</div>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = `
      <div class="anomaly-header-row">
        <h3 class="anomaly-title">Detected Anomalies <span class="anomaly-count">${this.anomalies.length}</span></h3>
        <button class="btn btn-ghost legend-toggle" id="legend-toggle" aria-expanded="false">
          <span class="legend-icon">ⓘ</span> Legend
        </button>
      </div>
      <div class="anomaly-legend" id="anomaly-legend" hidden>
        ${this.renderLegend()}
      </div>
      <div class="anomaly-tree" role="tree" aria-label="Detected anomalies">
        ${this.anomalies.map(anomaly => this.renderAnomalyItem(anomaly)).join('')}
      </div>
    `;
    
    this.container.querySelector('#legend-toggle')?.addEventListener('click', () => this.toggleLegend());
    this.container.querySelectorAll('.anomaly-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.anomaly-item');
        item?.classList.toggle('expanded');
      });
    });
  }
  
  private toggleLegend(): void {
    this.showLegend = !this.showLegend;
    const legend = this.container.querySelector('#anomaly-legend') as HTMLElement;
    const toggle = this.container.querySelector('#legend-toggle') as HTMLButtonElement;
    if (legend) legend.hidden = !this.showLegend;
    if (toggle) toggle.setAttribute('aria-expanded', String(this.showLegend));
  }
  
  private renderLegend(): string {
    return `
      <div class="legend-section">
        <h4>Severity Levels</h4>
        <div class="legend-grid severity-grid">
          ${SEVERITY_LEGEND.map(s => `
            <div class="legend-item">
              <div class="legend-color" style="background: ${s.color}; box-shadow: 0 0 8px ${s.color}80;"></div>
              <div class="legend-info">
                <span class="legend-label">${s.label}</span>
                <span class="legend-desc">${s.description}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="legend-section">
        <h4>Anomaly Categories</h4>
        <div class="legend-grid category-grid">
          ${CATEGORY_LEGEND.map(c => `
            <div class="legend-item">
              <span class="legend-category-badge">${c.label}</span>
              <span class="legend-desc">${c.description}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  private renderAnomalyItem(anomaly: Anomaly): string {
    const severityColors: Record<string, string> = {
      critical: '#ff3344',
      high: '#ff6600',
      medium: '#ffaa00',
      low: '#00aaee',
      info: '#888888'
    };
    
    const color = severityColors[anomaly.severity] || '#888888';
    const timestamp = new Date(anomaly.timestamp).toLocaleTimeString();
    
    return `
      <div class="anomaly-item" data-id="${anomaly.id}" data-severity="${anomaly.severity}">
        <div class="anomaly-header">
          <div class="anomaly-severity" style="background: ${color}; box-shadow: 0 0 8px ${color}80;"></div>
          <span class="anomaly-module">${anomaly.module}</span>
          <span class="anomaly-category">${anomaly.category.replace(/_/g, ' ')}</span>
          <span class="anomaly-description">${this.escapeHtml(anomaly.description)}</span>
          <span class="anomaly-time">${timestamp}</span>
          <span class="anomaly-toggle">▶</span>
        </div>
        <div class="anomaly-details">
          <div class="detail-banner" style="border-left: 3px solid ${color}; background: ${color}08; padding: 12px; margin-bottom: 12px; border-radius: var(--radius-sm);">
            <div class="detail-banner-title" style="font-weight: 700; font-size: 0.8rem; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">⚠ Why This Matters</div>
            <div class="detail-banner-text" style="font-size: 0.8rem; line-height: 1.6; color: var(--text-secondary);">${anomaly.severity === 'critical' || anomaly.severity === 'high' ? '<strong style="color: var(--text-primary);">This requires attention.</strong> ' : ''}${ANOMALY_IMPACT[anomaly.category]?.impact || 'No additional context available for this anomaly category.'}</div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Severity:</span>
            <span class="detail-value" style="color: ${color}; text-transform: uppercase;">${anomaly.severity}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Confidence:</span>
            <span class="detail-value">${Math.round(anomaly.confidence * 100)}%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Expected:</span>
            <span class="detail-value">${this.formatValue(anomaly.expected)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Actual:</span>
            <span class="detail-value">${this.formatValue(anomaly.actual)}</span>
          </div>
          ${Object.keys(anomaly.evidence || {}).length > 0 ? `
            <div class="detail-row">
              <span class="detail-label">Evidence:</span>
              <div class="evidence-grid">
                ${Object.entries(anomaly.evidence).map(([key, value]) => `
                  <div class="evidence-item">
                    <strong>${key}:</strong> ${this.formatValue(value)}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  }
  
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
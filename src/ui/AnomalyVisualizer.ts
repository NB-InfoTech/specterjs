import type { Anomaly } from '../core/types.js';

export class AnomalyVisualizer {
  private container: HTMLElement;
  private anomalies: Anomaly[] = [];
  
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
      <div class="anomaly-tree" role="tree" aria-label="Detected anomalies">
        ${this.anomalies.map(anomaly => this.renderAnomalyItem(anomaly)).join('')}
      </div>
    `;
    
    this.container.querySelectorAll('.anomaly-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.anomaly-item');
        item?.classList.toggle('expanded');
      });
    });
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
          <span class="anomaly-category">${anomaly.category}</span>
          <span class="anomaly-description">${this.escapeHtml(anomaly.description)}</span>
          <span class="anomaly-time">${timestamp}</span>
          <span class="anomaly-toggle">▶</span>
        </div>
        <div class="anomaly-details">
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
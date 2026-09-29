import React from 'react';

export default function StatusBadge({ status, type, confidence }) {
  let label = status;
  let colorClass = 'badge-default';

  // Handle confidence badge if confidence prop is passed
  if (confidence !== undefined) {
    let confNum = typeof confidence === 'number' ? confidence : parseFloat(confidence);
    if (!isNaN(confNum)) {
      if (confNum > 1) confNum = confNum / 100;
      if (confNum >= 0.7) {
        colorClass = 'badge-confidence-high';
        label = `High (${Math.round(confNum * 100)}%)`;
      } else if (confNum >= 0.4) {
        colorClass = 'badge-confidence-med';
        label = `Medium (${Math.round(confNum * 100)}%)`;
      } else {
        colorClass = 'badge-confidence-low';
        label = `Low (${Math.round(confNum * 100)}%)`;
      }
    } else if (typeof confidence === 'string') {
      const lower = confidence.toLowerCase();
      if (lower.includes('high')) colorClass = 'badge-confidence-high';
      else if (lower.includes('med')) colorClass = 'badge-confidence-med';
      else colorClass = 'badge-confidence-low';
      label = confidence;
    }
    return <span className={`badge ${colorClass}`}>{label}</span>;
  }

  const s = String(status || '').toLowerCase().trim();

  // Severity badges
  if (s === 'critical') {
    colorClass = 'badge-critical';
  } else if (s === 'high') {
    colorClass = 'badge-high';
  } else if (s === 'medium') {
    colorClass = 'badge-medium';
  } else if (s === 'low') {
    colorClass = 'badge-low';
  }
  // Status badges
  else if (type === 'success' || s === 'resolved' || s === 'healthy' || s === 'ok') {
    colorClass = 'badge-success';
  } else if (type === 'warning' || s === 'open' || s === 'mitigated' || s === 'partially resolved' || s === 'investigating') {
    colorClass = 'badge-warning';
  } else if (type === 'error' || s === 'unhealthy' || s === 'not resolved' || s === 'failed') {
    colorClass = 'badge-error';
  }

  return <span className={`badge ${colorClass}`}>{label || status}</span>;
}

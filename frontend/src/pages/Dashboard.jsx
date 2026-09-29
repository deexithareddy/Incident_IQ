import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getHealth, getIncidents } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const [healthRes, incidentsRes] = await Promise.all([getHealth(), getIncidents()]);
    const errors = [];
    if (healthRes.error) errors.push(`Health API: ${healthRes.error}`);
    else setHealth(healthRes.data);

    if (incidentsRes.error) errors.push(`Incidents API: ${incidentsRes.error}`);
    else setIncidents(incidentsRes.data || []);

    if (errors.length > 0) setError(errors.join(' | '));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner message="Connecting to IncidentIQ backend &amp; Hindsight…" />;

  const totalIncidents = incidents.length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const openCount = incidents.filter((i) => i.status === 'open').length;

  const lastWithAnalysis = [...incidents].reverse().find((i) => i.analysis);
  const memoriesUsed = lastWithAnalysis?.analysis?.memories_used_count ?? 0;

  const recent = [...incidents]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);

  return (
    <div>
      <div className="flex-between">
        <h1>Dashboard</h1>
        <button type="button" onClick={loadData} title="Refresh dashboard data">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="banner error flex-between">
          <div>
            <strong>Error connecting to services:</strong> {error}
          </div>
          <button type="button" onClick={loadData} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* System Health Status Cards with Colored Dots (Requirement 7) */}
      <h2 style={{ marginTop: '12px' }}>System Status</h2>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-label">FastAPI Backend</div>
          <div className="status-indicator margin-top">
            <span className={`status-dot ${health?.backend ? 'healthy' : 'unhealthy'}`} />
            <span>{health?.backend ? 'Connected (port 8000)' : 'Offline'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Hindsight Memory</div>
          <div className="status-indicator margin-top">
            <span className={`status-dot ${health?.hindsight ? 'healthy' : 'unhealthy'}`} />
            <span>{health?.hindsight ? 'Healthy (Docker 8888)' : 'Disconnected'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Groq Reasoning LLM</div>
          <div className="status-indicator margin-top">
            <span className={`status-dot ${health?.groq_configured ? 'healthy' : 'unhealthy'}`} />
            <span>{health?.groq_configured ? 'Configured (on_demand)' : 'Missing API Key'}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Active Memory Bank</div>
          <div className="margin-top">
            <span className="bank-chip">
              <span>🧠</span> {health?.bank_id || 'incidentiq-demo'}
            </span>
          </div>
        </div>
      </div>

      {/* Incident Statistics */}
      <h2>Incident Metrics</h2>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{totalIncidents}</div>
          <div className="stat-label">Total Incidents</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>
            {resolvedCount}
          </div>
          <div className="stat-label">Resolved &amp; Memorized</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: openCount > 0 ? 'var(--warning-color)' : '#fff' }}>
            {openCount}
          </div>
          <div className="stat-label">Open Incidents</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--memory-accent)' }}>
            {memoriesUsed}
          </div>
          <div className="stat-label">Memories in Last Analysis</div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <h2>Recent Incidents</h2>
      <div className="card">
        {recent.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p className="muted">No incidents recorded yet in the runtime datastore.</p>
            <Link to="/new-incident">
              <button type="button" className="primary">Submit First Incident →</button>
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Service</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Memories Used</th>
                <th>Logged At</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <strong className="incident-id-highlight">{inc.id}</strong>
                  </td>
                  <td style={{ fontWeight: 500 }}>{inc.title}</td>
                  <td className="muted">{inc.service}</td>
                  <td><StatusBadge status={inc.severity} /></td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>
                    {inc.analysis?.memories_used_count !== undefined ? (
                      <span className="entity-pill">
                        {inc.analysis.memories_used_count} recalled
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="muted" style={{ fontSize: '0.8rem' }}>
                    {inc.created_at ? new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

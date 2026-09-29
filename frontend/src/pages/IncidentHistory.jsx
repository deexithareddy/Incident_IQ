import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getIncidents, loadSampleData } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import CopyButton from '../components/CopyButton';

export default function IncidentHistory() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [sampleMsg, setSampleMsg] = useState('');
  const [sampleLoading, setSampleLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: apiError } = await getIncidents();
    if (apiError) {
      setError(apiError);
    } else {
      setIncidents(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const viewAnalysis = (inc) => {
    if (inc.analysis) {
      navigate('/analysis', { state: { analysis: inc.analysis, incident: inc } });
    }
  };

  const handleLoadSample = async () => {
    setSampleLoading(true);
    setSampleMsg('');
    const { data, error: apiError } = await loadSampleData();
    if (apiError) {
      setSampleMsg(`Error: ${apiError}`);
    } else {
      setSampleMsg(data?.message || 'Sample incidents loaded.');
      await loadData();
    }
    setSampleLoading(false);
    // Auto-clear success message after 4 seconds
    setTimeout(() => setSampleMsg(''), 4000);
  };

  if (loading) return <LoadingSpinner message="Loading incident store…" />;

  return (
    <div>
      <div className="flex-between">
        <h1>Incident History</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="primary"
            onClick={handleLoadSample}
            disabled={sampleLoading}
            title="Populate the incident store with 3 realistic sample incidents for the demo"
          >
            {sampleLoading ? 'Loading…' : '⚡ Load Sample Data'}
          </button>
          <button type="button" onClick={loadData} title="Reload history from backend store">
            ↻ Refresh
          </button>
        </div>
      </div>
      <p className="muted">
        Review all recorded production incidents, their diagnosis traces, and their resolutions stored in Hindsight memory.
      </p>

      {sampleMsg && (
        <div
          className={`banner ${sampleMsg.startsWith('Error') ? 'error' : 'success'}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{sampleMsg}</span>
          <button
            type="button"
            onClick={() => setSampleMsg('')}
            style={{ padding: '2px 8px', fontSize: '0.75rem', marginLeft: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="banner error flex-between">
          <div>
            <strong>Error loading incidents:</strong> {error}
          </div>
          <button type="button" onClick={loadData} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            Retry
          </button>
        </div>
      )}


      <div className="card">
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>
            <p className="muted" style={{ fontSize: '1.05rem', marginBottom: '10px' }}>
              No incidents recorded in the system yet.
            </p>
            <Link to="/new-incident">
              <button type="button" className="primary">Record First Incident →</button>
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '12%' }}>ID</th>
                <th style={{ width: '30%' }}>Title</th>
                <th style={{ width: '18%' }}>Service</th>
                <th style={{ width: '12%' }}>Severity</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '16%' }}>Logged At</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const isExpanded = expandedId === inc.id;
                return (
                  <React.Fragment key={inc.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                      style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(255,255,255,0.03)' : undefined }}
                      title="Click to toggle details"
                    >
                      <td>
                        <strong className="incident-id-highlight">{inc.id}</strong>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {inc.title} {isExpanded ? '▲' : '▼'}
                      </td>
                      <td className="muted">{inc.service}</td>
                      <td><StatusBadge status={inc.severity} /></td>
                      <td><StatusBadge status={inc.status} /></td>
                      <td className="muted" style={{ fontSize: '0.82rem' }}>
                        {inc.created_at ? new Date(inc.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="6" style={{ backgroundColor: 'rgba(13, 17, 23, 0.6)', padding: '20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="flex-between">
                              <span className="stat-label">Incident Details</span>
                              {inc.analysis && (
                                <button
                                  type="button"
                                  className="accent"
                                  onClick={() => viewAnalysis(inc)}
                                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                >
                                  Open Analysis &amp; Recall View →
                                </button>
                              )}
                            </div>

                            <div>
                              <strong>Symptoms:</strong>
                              <p style={{ marginTop: '4px' }}>{inc.symptoms}</p>
                            </div>

                            {inc.metrics && (
                              <div>
                                <div className="block-header">
                                  <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>METRICS</span>
                                  <CopyButton text={inc.metrics} label="Copy metrics" />
                                </div>
                                <pre className="metrics-block">{inc.metrics}</pre>
                              </div>
                            )}

                            {inc.logs && (
                              <div>
                                <div className="block-header">
                                  <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ERROR LOGS</span>
                                  <CopyButton text={inc.logs} label="Copy logs" />
                                </div>
                                <pre className="log-block">{inc.logs}</pre>
                              </div>
                            )}

                            {inc.recent_change && (
                              <div>
                                <strong>Recent Change:</strong> {inc.recent_change}
                              </div>
                            )}

                            {inc.resolution && (
                              <div
                                style={{
                                  background: 'rgba(63, 185, 80, 0.08)',
                                  border: '1px solid rgba(63, 185, 80, 0.3)',
                                  borderRadius: '6px',
                                  padding: '14px',
                                  marginTop: '6px',
                                }}
                              >
                                <div style={{ color: 'var(--success-color)', fontWeight: 600, marginBottom: '6px' }}>
                                  Stored Resolution &amp; Lessons (in Hindsight)
                                </div>
                                {inc.resolution.root_cause && (
                                  <p style={{ margin: '4px 0' }}>
                                    <strong>Root cause:</strong> {inc.resolution.root_cause}
                                  </p>
                                )}
                                {inc.resolution.resolution && (
                                  <p style={{ margin: '4px 0' }}>
                                    <strong>Resolution:</strong> {inc.resolution.resolution}
                                  </p>
                                )}
                                {inc.resolution.outcome && (
                                  <p style={{ margin: '4px 0' }}>
                                    <strong>Outcome:</strong> {inc.resolution.outcome}
                                  </p>
                                )}
                                {inc.resolution.lesson && (
                                  <p style={{ margin: '4px 0' }}>
                                    <strong>Lesson:</strong> {inc.resolution.lesson}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

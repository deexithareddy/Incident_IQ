import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { getIncidents, resolveIncident } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import CopyButton from '../components/CopyButton';

function entityList(entities) {
  if (!entities) return [];
  if (Array.isArray(entities)) return entities;
  return Object.keys(entities);
}

// Highlight incident IDs (e.g. INC-101, TEST-001) in text without altering content
function renderHighlightedText(text) {
  if (!text || typeof text !== 'string') return text;
  const regex = /\b([A-Z]{2,}-\d+)\b/g;
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.match(/^[A-Z]{2,}-\d+$/)) {
      return (
        <span key={i} className="incident-id-highlight">
          {part}
        </span>
      );
    }
    return part;
  });
}

const defaultResolveForm = {
  root_cause: '',
  investigation: '',
  resolution: '',
  outcome: 'Resolved',
  lesson: '',
};

export default function IncidentAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState(location.state?.analysis || null);
  const [incident, setIncident] = useState(location.state?.incident || null);
  const [hydrateError, setHydrateError] = useState('');
  const [hydrating, setHydrating] = useState(!location.state?.analysis);

  const [resolveForm, setResolveForm] = useState(defaultResolveForm);
  const [resolving, setResolving] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [growthHistory, setGrowthHistory] = useState([]);

  // Load from sessionStorage or API if not provided in location.state
  useEffect(() => {
    if (analysis && incident) {
      setHydrating(false);
      return;
    }

    try {
      const stored = sessionStorage.getItem('incidentiq:lastAnalysis');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.analysis && parsed.incident) {
          setAnalysis(parsed.analysis);
          setIncident(parsed.incident);
          setHydrating(false);
          return;
        }
      }
    } catch {
      /* ignore */
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await getIncidents();
      if (cancelled) return;
      if (error) {
        setHydrateError(error);
        setHydrating(false);
        return;
      }
      const last = [...(data || [])].reverse().find((item) => item.analysis);
      if (last) {
        setIncident(last);
        setAnalysis(last.analysis);
      }
      setHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [analysis, incident]);

  const incidentId = incident?.id || incident?.incident_id;

  // Reset form whenever a new incident loads (Requirement 1)
  useEffect(() => {
    setResolveForm(defaultResolveForm);
    setResolveSuccess(false);
    setResolveError('');
  }, [incidentId]);

  // Track session memory growth (Requirement 3)
  useEffect(() => {
    if (!analysis || !incidentId) return;
    const memCount = analysis.memories_used_count ?? (analysis.recalled_memories?.length || 0);

    try {
      const storedHistory = JSON.parse(sessionStorage.getItem('incidentiq:sessionGrowth') || '[]');
      const existingIdx = storedHistory.findIndex((item) => item.id === incidentId);
      let updated;
      if (existingIdx >= 0) {
        updated = [...storedHistory];
        updated[existingIdx] = { id: incidentId, count: memCount };
      } else {
        updated = [...storedHistory, { id: incidentId, count: memCount }];
      }
      sessionStorage.setItem('incidentiq:sessionGrowth', JSON.stringify(updated));
      setGrowthHistory(updated);
    } catch {
      setGrowthHistory([{ id: incidentId, count: memCount }]);
    }
  }, [analysis, incidentId]);

  const handleAnalyzeAnother = () => {
    // Reset form fields and navigate to New Incident
    setResolveForm(defaultResolveForm);
    setResolveSuccess(false);
    setResolveError('');
    navigate('/new-incident');
  };

  const submitResolve = async (e) => {
    e.preventDefault();
    setResolving(true);
    setResolveError('');
    const { error } = await resolveIncident(incidentId, resolveForm);
    setResolving(false);
    if (error) {
      setResolveError(error);
    } else {
      setResolveSuccess(true);
    }
  };

  if (hydrating) return <LoadingSpinner message="Loading incident analysis…" />;

  if (!analysis || !incident) {
    return (
      <div>
        <h1>Incident Analysis</h1>
        {hydrateError && <div className="banner error">{hydrateError}</div>}
        <div className="card">
          <p>No active incident analysis found. Submit an incident from New Incident to see real recall and reasoning.</p>
          <div className="margin-top">
            <Link to="/new-incident">
              <button type="button" className="primary">Go to New Incident</button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const memories = analysis.recalled_memories || [];
  const memCount = analysis.memories_used_count ?? memories.length;

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h1>Incident Analysis</h1>
        <button type="button" onClick={handleAnalyzeAnother} title="Start new analysis">
          Analyze another incident
        </button>
      </div>

      {/* Memory Growth Strip (Requirement 3: hidden until at least one earlier analysis exists) */}
      {growthHistory.length >= 2 && (
        <div className="memory-growth-strip">
          <div className="growth-label">
            <span>📈</span> Session Memory Growth:
          </div>
          <div className="growth-timeline">
            {growthHistory.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx > 0 && <span className="growth-arrow">→</span>}
                <span className={`growth-step ${item.id === incidentId ? 'active' : ''}`}>
                  <strong>{item.count}</strong> memories
                  <span className="muted" style={{ fontSize: '0.75rem' }}>({item.id})</span>
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Current Incident Details */}
      <section className="card">
        <div className="flex-between">
          <h2>Current Incident</h2>
          <div className="gap-8">
            <span className="muted">ID: <strong>{incidentId}</strong></span>
            <StatusBadge status={incident.severity} />
          </div>
        </div>
        <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{incident.title}</p>
        <p><strong>Service:</strong> {incident.service}</p>
        <p><strong>Symptoms:</strong> {incident.symptoms}</p>

        {incident.metrics && (
          <div style={{ marginTop: '12px' }}>
            <div className="block-header">
              <span className="stat-label">Metrics</span>
              <CopyButton text={incident.metrics} label="Copy metrics" />
            </div>
            <pre className="metrics-block">{incident.metrics}</pre>
          </div>
        )}

        {incident.logs && (
          <div style={{ marginTop: '12px' }}>
            <div className="block-header">
              <span className="stat-label">Error Logs</span>
              <CopyButton text={incident.logs} label="Copy logs" />
            </div>
            <pre className="log-block">{incident.logs}</pre>
          </div>
        )}

        {incident.recent_change && (
          <p style={{ marginTop: '12px' }}>
            <strong>Recent change:</strong> {incident.recent_change}
          </p>
        )}
      </section>

      {/* HINDSIGHT MEMORY CENTERPIECE (Requirement 2) */}
      <section className={`memory-centerpiece ${memCount === 0 ? 'empty' : ''}`}>
        <div className="memory-centerpiece-header">
          <div className="memory-centerpiece-title-group">
            <span className="memory-centerpiece-icon">{memCount > 0 ? '🧠' : '🔍'}</span>
            <div>
              <div className="memory-centerpiece-count">
                {memCount > 0
                  ? `${memCount} ${memCount === 1 ? 'memory' : 'memories'} recalled from Hindsight`
                  : 'No relevant memories found'}
              </div>
              <div className="memory-centerpiece-sub">
                {memCount > 0
                  ? 'Historical incidents matched by semantic relevance and fused by cross-encoder reranker'
                  : 'First-time incident, so the agent is working without historical incident memory'}
              </div>
            </div>
          </div>
          {memCount > 0 ? (
            <span className="badge badge-success">Recalled &amp; Active</span>
          ) : (
            <span className="badge badge-default">No Prior Memory</span>
          )}
        </div>

        {memories.length === 0 ? (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            Hindsight returned no matching historical units for this diagnosis query. Reasoning will rely strictly on general knowledge.
          </p>
        ) : (
          <div className="recalled-facts-list">
            {memories.map((m, i) => {
              const entities = entityList(m.entities);
              return (
                <div key={m.id || i} className="recalled-fact-card">
                  <div className="fact-header-row">
                    <div className="fact-text">{m.text}</div>
                    <CopyButton text={m.text} label="Copy fact" />
                  </div>
                  <div className="fact-meta-row">
                    {m.document_id && (
                      <span className="muted">
                        Doc: <strong className="incident-id-highlight">{m.document_id}</strong>
                      </span>
                    )}
                    {m.type && <span className="muted">Type: {m.type}</span>}
                    {m.score !== undefined && m.score !== null && (
                      <span className="muted">
                        Relevance: {(m.score * 100).toFixed(1)}%
                      </span>
                    )}
                    {entities.length > 0 && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {entities.map((ent, eIdx) => (
                          <span key={eIdx} className="entity-pill">
                            {ent}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AI Analysis Diagnosis */}
      <section className="card">
        <h2>AI Analysis</h2>
        <p style={{ fontSize: '1rem', lineHeight: 1.6 }}>{analysis.summary}</p>

        <h3 style={{ marginTop: '20px' }}>Likely Causes</h3>
        {(analysis.likely_causes || []).length === 0 ? (
          <p className="muted">No structured causes returned.</p>
        ) : (
          (analysis.likely_causes || []).map((cause, i) => (
            <div key={i} className="list-item">
              <div className="flex-between">
                <strong style={{ fontSize: '0.98rem' }}>{cause.cause}</strong>
                <StatusBadge confidence={cause.confidence} />
              </div>
              <div className="confidence-track">
                <div
                  className="confidence-bar"
                  style={{ width: `${Math.min(100, Math.max(5, (cause.confidence || 0) * 100))}%` }}
                />
              </div>
              <p className="muted" style={{ margin: 0 }}>{cause.reasoning}</p>
            </div>
          ))
        )}
      </section>

      {/* Past Incidents Table */}
      <section className="card">
        <h2>Past Incidents That Influenced This</h2>
        {(analysis.relevant_past_incidents || []).length === 0 ? (
          <p className="muted">None — no historical incidents were cited as evidence for this analysis.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Incident</th>
                <th style={{ width: '27%' }}>Relevance</th>
                <th style={{ width: '30%' }}>Previous Resolution</th>
                <th style={{ width: '25%' }}>Lesson</th>
              </tr>
            </thead>
            <tbody>
              {analysis.relevant_past_incidents.map((past, i) => (
                <tr key={i}>
                  <td>
                    <span className="incident-id-highlight">{past.incident}</span>
                  </td>
                  <td>{past.relevance}</td>
                  <td>{past.previous_resolution}</td>
                  <td>{past.lesson}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Investigation Plan */}
      <section className="card">
        <h2>Investigation Plan</h2>
        <ol className="plan-list">
          {(analysis.investigation_steps || []).map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      {/* Recommended Next Action */}
      <section className="banner info">
        <h2 style={{ marginTop: 0, fontSize: '1.2rem', color: '#79c0ff' }}>
          Recommended Next Action
        </h2>
        <p style={{ fontSize: '1rem', marginBottom: '8px' }}>
          {analysis.recommended_next_action}
        </p>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Guidance only — IncidentIQ does not execute modifications in production.
        </span>
      </section>

      {/* How Memory Influenced This Analysis Panel (Requirement 4) */}
      <section className="influence-panel">
        <h2>
          <span>💡</span> How Memory Influenced This Analysis
        </h2>
        <div className="influence-text">
          {renderHighlightedText(analysis.memory_influence)}
        </div>
        <div className="muted" style={{ marginTop: '10px', fontSize: '0.82rem' }}>
          Memories recalled from Hindsight: <strong>{memCount}</strong>
        </div>
      </section>

      {/* Resolve & Learn Form (Requirements 1 & 6) */}
      <section className="card">
        <h2>Resolve &amp; Learn</h2>
        <p className="muted">
          Record the real resolution to retain it in Hindsight. Future incidents will recall these facts to diagnose similar issues.
        </p>

        {resolveSuccess ? (
          <div className="banner success" style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '6px' }}>
              ✓ Stored in Hindsight. Future incidents can now recall this.
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Incident <strong>{incidentId}</strong> is now marked as resolved and committed to long-term memory.
            </p>
            <div style={{ marginTop: '14px' }}>
              <button type="button" className="primary" onClick={handleAnalyzeAnother}>
                Analyze another incident to test recall →
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitResolve} style={{ marginTop: '16px' }}>
            {resolveError && <div className="banner error">{resolveError}</div>}

            <div className="form-group">
              <label htmlFor="root_cause">Actual Root Cause *</label>
              <textarea
                id="root_cause"
                name="root_cause"
                required
                placeholder="What actually went wrong in the service?"
                value={resolveForm.root_cause}
                onChange={(e) => setResolveForm((p) => ({ ...p, root_cause: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="investigation">Investigation Performed *</label>
              <textarea
                id="investigation"
                name="investigation"
                required
                placeholder="What commands, telemetry, or logs isolated the problem?"
                value={resolveForm.investigation}
                onChange={(e) => setResolveForm((p) => ({ ...p, investigation: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="resolution">Resolution *</label>
              <textarea
                id="resolution"
                name="resolution"
                required
                placeholder="What actions were taken to fix the incident?"
                value={resolveForm.resolution}
                onChange={(e) => setResolveForm((p) => ({ ...p, resolution: e.target.value }))}
              />
            </div>

            {/* Outcome Dropdown (Requirement 1) */}
            <div className="form-group">
              <label htmlFor="outcome">Outcome *</label>
              <select
                id="outcome"
                name="outcome"
                required
                value={resolveForm.outcome}
                onChange={(e) => setResolveForm((p) => ({ ...p, outcome: e.target.value }))}
              >
                <option value="Resolved">Resolved</option>
                <option value="Partially resolved">Partially resolved</option>
                <option value="Not resolved">Not resolved</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lesson">Lesson Learned (optional)</label>
              <textarea
                id="lesson"
                name="lesson"
                placeholder="Key takeaway to prevent recurrence or aid future responders."
                value={resolveForm.lesson}
                onChange={(e) => setResolveForm((p) => ({ ...p, lesson: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
              <button type="submit" className="primary" disabled={resolving}>
                {resolving ? (
                  <>
                    <span className="spinner" style={{ width: '16px', height: '16px', margin: 0, borderWidth: '2px' }} />
                    Saving to Hindsight (this can take a few seconds)...
                  </>
                ) : (
                  'Save to Memory'
                )}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Footer Note (Requirement 10) */}
      <div className="analysis-footer-note">
        AI recommendations only. The engineer makes the final decision.
      </div>
    </div>
  );
}

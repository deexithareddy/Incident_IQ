import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeIncident } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const emptyForm = {
  id: '',
  title: '',
  service: '',
  severity: 'high',
  symptoms: '',
  logs: '',
  metrics: '',
  recent_change: '',
};

const demoIncident = {
  id: 'INC-201',
  title: 'Postgres read replica lag causing slow queries',
  service: 'database-cluster',
  severity: 'high',
  symptoms: 'Read queries returning stale data, replica lag ~30s, slower reads, DB alerts firing.',
  metrics: 'replica_lag_seconds: 30, read_query_p99_ms: 8500, replication_throughput_mbps: 12 (normal: 100)',
  logs: '[WARNING] Replication lag on replica-3 exceeded threshold: 30s\n[ERROR] Read query timeout on replica-3 after 8500ms\n[WARNING] WAL sender on primary showing high pending bytes: 2.3GB',
  recent_change: 'Write throughput increased ~3x after a batch import feature deployed two hours ago.',
};

export default function NewIncident() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(emptyForm);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setActiveStep(0);
    setError('');

    // Step 1: Hindsight recall (first ~3.5s) -> Step 2: Groq reasoning
    const stepTimer = setTimeout(() => {
      setActiveStep(1);
    }, 3800);

    const { data, error: apiError } = await analyzeIncident(formData);
    clearTimeout(stepTimer);
    setLoading(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    try {
      sessionStorage.setItem(
        'incidentiq:lastAnalysis',
        JSON.stringify({ analysis: data, incident: formData })
      );
    } catch {
      /* ignore quota */
    }

    navigate('/analysis', { state: { analysis: data, incident: formData } });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0' }}>
        <LoadingSpinner
          message="Analyzing incident with memory recall & reasoning…"
          steps={[
            'Recalling memories from Hindsight...',
            'Reasoning with Groq...',
          ]}
          activeStep={activeStep}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between">
        <h1>New Incident</h1>
        <button
          type="button"
          onClick={() => setFormData(demoIncident)}
          title="Populate form with Postgres replication lag scenario"
        >
          Load demo incident
        </button>
      </div>
      <p className="muted">
        Submit a production incident to trigger historical memory recall from Hindsight and AI diagnosis.
      </p>

      {error && (
        <div className="banner error">
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Analysis Failed</div>
          <div>{error}</div>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleAnalyze}>
          <div className="dashboard-grid">
            <div className="form-group">
              <label htmlFor="id">Incident ID *</label>
              <input
                id="id"
                name="id"
                value={formData.id}
                onChange={handleChange}
                required
                placeholder="INC-201"
              />
            </div>
            <div className="form-group">
              <label htmlFor="service">Service Name *</label>
              <input
                id="service"
                name="service"
                value={formData.service}
                onChange={handleChange}
                required
                placeholder="database-cluster"
              />
            </div>
            <div className="form-group">
              <label htmlFor="severity">Severity Level *</label>
              <select
                id="severity"
                name="severity"
                value={formData.severity}
                onChange={handleChange}
              >
                <option value="critical">critical</option>
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Incident Title *</label>
            <input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="Postgres read replica lag causing slow queries"
            />
          </div>

          <div className="form-group">
            <label htmlFor="symptoms">Symptoms Observed *</label>
            <textarea
              id="symptoms"
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              required
              placeholder="What anomalous behavior or errors are customers/systems seeing?"
            />
          </div>

          <div className="form-group">
            <label htmlFor="logs">Error Logs</label>
            <textarea
              id="logs"
              name="logs"
              value={formData.logs}
              onChange={handleChange}
              placeholder="Relevant stack traces or error logs (paste here)"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="metrics">Telemetry &amp; Metrics</label>
            <textarea
              id="metrics"
              name="metrics"
              value={formData.metrics}
              onChange={handleChange}
              placeholder="Key performance indicators, e.g. replica_lag_seconds: 30, p99_latency: 8500ms"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="recent_change">Recent Changes</label>
            <textarea
              id="recent_change"
              name="recent_change"
              value={formData.recent_change}
              onChange={handleChange}
              placeholder="Recent deployments, configuration changes, or traffic spikes"
            />
          </div>

          <button
            type="submit"
            className="primary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '8px' }}
          >
            Analyze Incident
          </button>
        </form>
      </div>
    </div>
  );
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function formatApiDetail(err, status) {
  const detail = err?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || JSON.stringify(item)).join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  if (err?.message) return err.message;
  return `HTTP ${status}`;
}

async function fetchWithError(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(formatApiDetail(err, response.status));
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

export const getHealth = () => fetchWithError(`${API_URL}/api/health`);

export const getIncidents = () => fetchWithError(`${API_URL}/api/incidents`);

export const analyzeIncident = (incident) => fetchWithError(`${API_URL}/api/incidents/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(incident)
});

export const resolveIncident = (id, resolution) => fetchWithError(`${API_URL}/api/incidents/${id}/resolve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(resolution)
});

export const searchMemory = (query) => fetchWithError(`${API_URL}/api/memory/search?q=${encodeURIComponent(query)}`);

export const loadSampleData = () => fetchWithError(`${API_URL}/api/incidents/sample`, { method: 'POST' });

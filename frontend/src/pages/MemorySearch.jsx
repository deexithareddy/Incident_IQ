import React, { useState } from 'react';
import { searchMemory } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import CopyButton from '../components/CopyButton';

export default function MemorySearch() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeSearch = async (searchQuery) => {
    const q = searchQuery.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setSearchedQuery(q);
    const { data, error: apiError } = await searchMemory(q);
    setLoading(false);
    if (apiError) {
      setError(apiError);
      setResults(null);
      return;
    }
    setResults(data?.results || []);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleQuickSearch = (keyword) => {
    setQuery(keyword);
    executeSearch(keyword);
  };

  return (
    <div>
      <div className="flex-between">
        <h1>Memory Search</h1>
        <span className="bank-chip">🧠 Hindsight Recall</span>
      </div>
      <p className="muted">
        Directly query Hindsight's vector and graph memory bank to inspect stored incident facts, observations, and links.
      </p>

      <div className="card">
        <form onSubmit={handleSearch} className="search-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e);
              }
            }}
            placeholder="Search recalled memories (e.g. replication lag, connection pool, database)..."
          />
          <button type="submit" className="primary" disabled={loading || !query.trim()}>
            Search
          </button>
          {results !== null && (
            <button
              type="button"
              onClick={() => {
                setResults(null);
                setQuery('');
                setSearchedQuery('');
                setError('');
              }}
            >
              Clear
            </button>
          )}
        </form>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: '0.8rem' }}>Suggested queries:</span>
          {['replication lag', 'database connection pool', 'slow queries', 'WAL sender', 'timeout'].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => handleQuickSearch(term)}
              style={{ padding: '3px 9px', fontSize: '0.8rem' }}
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner message={`Searching Hindsight memory for "${searchedQuery}"…`} />}

      {error && (
        <div className="banner error flex-between">
          <div>
            <strong>Error querying Hindsight:</strong> {error}
          </div>
          <button
            type="button"
            onClick={() => executeSearch(searchedQuery || query)}
            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Results view */}
      {results !== null && !loading && (
        <div style={{ marginTop: '20px' }}>
          <div className="flex-between" style={{ marginBottom: '14px' }}>
            <h2>Recalled Memory Units ({results.length})</h2>
            <span className="muted">Query: "{searchedQuery}"</span>
          </div>

          {results.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '30px' }}>
              <p className="muted" style={{ fontSize: '1.05rem', marginBottom: '8px' }}>
                No memory units found for "{searchedQuery}".
              </p>
              <p className="muted" style={{ fontSize: '0.88rem' }}>
                Try broader technical terms, or resolve an incident from the New Incident page to store fresh memories in Hindsight.
              </p>
            </div>
          ) : (
            <div>
              {results.map((mem, i) => {
                const entities = Array.isArray(mem.entities)
                  ? mem.entities
                  : mem.entities && typeof mem.entities === 'object'
                  ? Object.keys(mem.entities)
                  : [];

                return (
                  <div key={mem.id || i} className="recalled-fact-card" style={{ marginBottom: '12px' }}>
                    <div className="fact-header-row">
                      <div className="fact-text">{mem.text}</div>
                      <CopyButton text={mem.text} label="Copy fact" />
                    </div>
                    <div className="fact-meta-row">
                      {mem.document_id && (
                        <span className="muted">
                          Doc: <strong className="incident-id-highlight">{mem.document_id}</strong>
                        </span>
                      )}
                      {mem.type && <span className="muted">Type: {mem.type}</span>}
                      {mem.scores?.final !== undefined && (
                        <span className="muted">
                          Score: {(mem.scores.final * 100).toFixed(1)}%
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
        </div>
      )}

      {/* Initial empty state */}
      {results === null && !loading && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🧠</div>
          <h3>Search Hindsight Long-Term Memory</h3>
          <p className="muted" style={{ maxWidth: '600px', margin: '0 auto 16px' }}>
            Whenever incidents are resolved in IncidentIQ, Hindsight extracts semantic facts and updates the associative memory graph. Query keywords above to inspect what the agent remembers.
          </p>
        </div>
      )}
    </div>
  );
}

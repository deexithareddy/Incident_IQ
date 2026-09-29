import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewIncident from './pages/NewIncident';
import IncidentAnalysis from './pages/IncidentAnalysis';
import MemorySearch from './pages/MemorySearch';
import IncidentHistory from './pages/IncidentHistory';

export default function App() {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <span>⚡</span> IncidentIQ
          </div>
          <div className="brand-sub">REMEMBER → RECALL → REASON → RESOLVE → LEARN</div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/new-incident" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            New Incident
          </NavLink>
          <NavLink to="/analysis" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Incident Analysis
          </NavLink>
          <NavLink to="/memory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Memory
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Incident History
          </NavLink>
        </nav>
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
          }}
        >
          <div>Backend: FastAPI (:8000)</div>
          <div>Memory: Hindsight (:8888)</div>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-incident" element={<NewIncident />} />
          <Route path="/analysis" element={<IncidentAnalysis />} />
          <Route path="/memory" element={<MemorySearch />} />
          <Route path="/history" element={<IncidentHistory />} />
        </Routes>
      </main>
    </div>
  );
}

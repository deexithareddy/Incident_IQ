import React from 'react';

export default function LoadingSpinner({ message = 'Loading...', steps = null, activeStep = 0 }) {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      {message && <p className="loading-message">{message}</p>}
      {Array.isArray(steps) && steps.length > 0 && (
        <div className="progress-steps">
          {steps.map((step, idx) => {
            const isDone = idx < activeStep;
            const isCurrent = idx === activeStep;
            return (
              <div
                key={idx}
                className={`step-item ${isDone ? 'done' : ''} ${isCurrent ? 'active' : ''}`}
              >
                <div className="step-indicator">
                  {isDone ? '✓' : isCurrent ? <span className="step-dot"></span> : idx + 1}
                </div>
                <div className="step-label">{step}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

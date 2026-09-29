import React, { useState } from 'react';

export default function CopyButton({ text, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silent failure
    }
  };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copied' : ''} ${className}`.trim()}
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : `Copy ${label}`}
    >
      {copied ? (
        <>
          <span className="copy-icon">✓</span> Copied
        </>
      ) : (
        <>
          <span className="copy-icon">📋</span> {label}
        </>
      )}
    </button>
  );
}

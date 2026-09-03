import React from "react";

interface LoadingStateProps {
  onCancel?: () => void;
}

export function LoadingState({ onCancel }: LoadingStateProps) {
  return (
    <div className="loading-container" role="status" aria-live="polite">
      <div className="spinner"></div>
      <p className="loading-text">Searching hotels across suppliers...</p>
      {onCancel && (
        <button
          type="button"
          className="cancel-btn"
          onClick={onCancel}
          id="cancel-search-btn"
        >
          Cancel Search
        </button>
      )}
    </div>
  );
}

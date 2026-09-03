import React from "react";
import { SearchApiResponse } from "../types/hotel";

interface SearchResultProps {
  result: SearchApiResponse;
}

export function SearchResult({ result }: SearchResultProps) {
  return (
    <div className="result-card" id="search-result-card">
      <div className="result-header">
        <div className="result-badge">Best Rate Found</div>
        <h2 className="result-title">Best Hotel Rate</h2>
      </div>

      <div className="result-details">
        <div className="result-row">
          <span className="result-label">Hotel Name:</span>
          <span className="result-value hotel-name">{result.name}</span>
        </div>

        <div className="result-row">
          <span className="result-label">Price:</span>
          <span className="result-value hotel-price">${result.price}</span>
        </div>

        <div className="result-row">
          <span className="result-label">Supplier:</span>
          <span className="result-value">
            <span className={`supplier-badge supplier-${result.supplier.toLowerCase()}`}>
              Supplier {result.supplier}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

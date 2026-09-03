"use client";

import React, { useState, useRef } from "react";
import { HotelSearchRequest, SearchApiResponse } from "../types/hotel";
import { searchHotelsApi, cancelSearchApi, ApiError } from "../lib/api";
import { HotelSearchForm } from "../components/HotelSearchForm";
import { LoadingState } from "../components/LoadingState";
import { SearchResult } from "../components/SearchResult";
import { ErrorMessage } from "../components/ErrorMessage";



export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeWorkflowIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = async (request: HotelSearchRequest) => {
    setIsLoading(true);
    setSearchResult(null);
    setErrorMessage(null);

    const workflowId = `hotel-search-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    activeWorkflowIdRef.current = workflowId;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await searchHotelsApi(
        {
          ...request,
          workflowId,
        },
        controller.signal,
      );

      setSearchResult(response);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setErrorMessage("Search was cancelled.");
        return;
      }

      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Unable to search hotels. Please try again.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const workflowIdToCancel = activeWorkflowIdRef.current;
    setIsLoading(false);
    setErrorMessage("Search was cancelled.");

    if (workflowIdToCancel) {
      try {
        await cancelSearchApi(workflowIdToCancel);
      } catch {
        // Workflow may have already stopped or cancellation was requested
      }
    }
  };

  return (
    <main className="page-container">
      {/* ─── HEADER ─── */}
      <header className="header-container">
        <a href="/" className="brand-logo">
          <div className="brand-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 11h2M9 15h2M13 11h2M13 15h2" />
            </svg>
          </div>
          <span>HotelRate</span>
        </a>
        <div className="nav-badge">
          <span className="pulse-dot"></span>
          <span>Temporal Orchestrated</span>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="hero-section">
        <h1 className="hero-title">Hotel Rate Comparator</h1>
        <p className="hero-subtitle">
          A resilient hotel search engine that concurrently fetches rates from two
          mock supplier APIs via Temporal workflows, handles failures, timeouts,
          retries, and returns the cheapest available rate.
        </p>
      </section>

      {/* ─── SEARCH SECTION ─── */}
      <section className="main-wrapper">
        <div className="section-label">Search Hotels</div>

        <div className="search-card">
          <HotelSearchForm isLoading={isLoading} onSearch={handleSearch} />

          {isLoading && <LoadingState onCancel={handleCancel} />}

          {errorMessage && !isLoading && <ErrorMessage message={errorMessage} />}

          {searchResult && !isLoading && <SearchResult result={searchResult} />}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <p>Hotel Rate Comparator &bull; Powered by Temporal.io &amp; Next.js</p>
        <div className="footer-links">
          <a
            href="https://temporal.io"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Temporal Docs
          </a>
          <a
            href="https://nextjs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Next.js
          </a>
        </div>
      </footer>
    </main>
  );
}

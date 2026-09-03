"use client";

import React, { useState, useEffect, useRef } from "react";

interface UploadResponse {
  filename: string;
  row_count: number;
  columns: string[];
  missing_required_columns: string[];
  is_valid: boolean;
  raw_csv: string;
}

interface PreprocessRecord {
  "Jobber Client ID": string;
  "First Name": string;
  "Last Name": string;
  "Phone": string;
  "Email": string;
  "Preferred Language": string;
  "Speak Only English": string;
  "Tags": string;
  "Import Status": string;
  "Data Quality Notes": string;
}

interface TagItem {
  Tag: string;
  Count: number;
}

interface PreprocessResult {
  raw_rows: number;
  total_contacts: number;
  ready_count: number;
  review_count: number;
  reject_count: number;
  tag_delimiter_mode: string;
  status_counts: Record<string, number>;
  ready_sample: PreprocessRecord[];
  review_sample: PreprocessRecord[];
  rejected_sample: PreprocessRecord[];
  tag_inventory: TagItem[];
  total_tags: number;
  ghl_import_ready_csv: string;
  report: string;
}

export default function Home() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState<UploadResponse | null>(null);
  const [result, setResult] = useState<PreprocessResult | null>(null);
  const [activeTab, setActiveTab] = useState<"ready" | "review" | "tags" | "report">("ready");
  const [searchFilter, setSearchFilter] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle File Upload
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMsg("Please select a valid .csv file.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to upload file");
      }

      const data: UploadResponse = await res.json();
      setSession(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload CSV file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Load Built-in Sample
  const handleLoadSample = async () => {
    setIsUploading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/sample");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to load sample dataset");
      }

      const data: UploadResponse = await res.json();
      setSession(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load sample dataset.");
    } finally {
      setIsUploading(false);
    }
  };

  // Run Preprocessing
  const handleRunPreprocessor = async () => {
    if (!session?.raw_csv) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/preprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv_text: session.raw_csv,
          default_language: "French",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Preprocessing failed");
      }

      const data: PreprocessResult = await res.json();
      setResult(data);
      setActiveTab("ready");
    } catch (err: any) {
      setErrorMsg(err.message || "Error running preprocessor.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Direct In-Memory CSV Download (100% Vercel & Client-Compatible)
  const downloadGhlReady = () => {
    if (!result?.ghl_import_ready_csv) return;
    const blob = new Blob(["\ufeff" + result.ghl_import_ready_csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ghl_import_ready.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtered contacts
  const filteredReady = (result?.ready_sample || []).filter((r) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r["First Name"]?.toLowerCase().includes(q) ||
      r["Last Name"]?.toLowerCase().includes(q) ||
      r["Phone"]?.toLowerCase().includes(q) ||
      r["Email"]?.toLowerCase().includes(q) ||
      r["Tags"]?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="container header-inner">
          <div className="brand">
            <div className="brand-icon-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m13 2-2 10h9L7 22l2-10H2l11-10Z" />
              </svg>
            </div>
            <div className="brand-title">
              Jobber to GoHighLevel
              <span className="brand-badge">Pipeline</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ flex: 1, paddingBottom: 48 }}>
        {/* Intro */}
        <section className="page-intro">
          <h1 className="intro-title">Customer CSV Preprocessor</h1>
          <p className="intro-desc">
            Cleans phone numbers for SMS capability, standardizes language values, retains Jobber tags,
            and outputs a clean <code>ghl_import_ready.csv</code> for direct import.
          </p>
        </section>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              background: "var(--status-reject-bg)",
              border: "1px solid var(--status-reject-border)",
              color: "#f87171",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: 20,
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Dataset Source Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-top">
            <h2 className="card-heading">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Dataset Source
            </h2>
            <button
              type="button"
              id="load-sample-btn"
              className="btn btn-subtle"
              onClick={handleLoadSample}
              disabled={isUploading || isProcessing}
            >
              {isUploading ? "Loading..." : "Load Sample CSV"}
            </button>
          </div>

          <div
            className={`minimal-dropzone ${isDragOver ? "active" : ""}`}
            id="csv-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              id="csv-file-input"
              style={{ display: "none" }}
              accept=".csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="drop-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="drop-primary-text">
              {isUploading ? "Reading dataset..." : "Drop Jobber CSV export here, or browse"}
            </p>
            <p className="drop-secondary-text">Standard Jobber export containing J-ID, Phone, and Tags columns</p>
          </div>

          {/* Uploaded File Row */}
          {session && (
            <div className="selected-file-row" id="session-file-banner">
              <div className="file-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-secondary)" }}>
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div>
                  <div className="file-title">{session.filename}</div>
                  <div className="file-subtext">
                    {session.row_count} rows •{" "}
                    {session.is_valid ? (
                      <span style={{ color: "var(--status-ready)" }}>All required columns present</span>
                    ) : (
                      <span style={{ color: "var(--status-reject)" }}>
                        Missing: {session.missing_required_columns.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action button below dataset source */}
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              id="run-preprocess-btn"
              className="btn btn-primary"
              onClick={handleRunPreprocessor}
              disabled={!session || isProcessing || !session.is_valid}
            >
              {isProcessing ? (
                <>
                  <span className="mini-spinner" />
                  <span>Processing contacts...</span>
                </>
              ) : (
                <span>Preprocess Dataset</span>
              )}
            </button>
          </div>
        </div>

        {/* HERO DOWNLOAD SECTION FOR ghl_import_ready.csv */}
        {result && (
          <section className="ready-box" id="ready-download-card">
            <div>
              <div className="ready-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Output Ready
              </div>
              <h2 className="ready-header-text">ghl_import_ready.csv is ready for import</h2>
              <p className="ready-subtext">
                Contains <strong>{result.ready_count} verified contacts</strong> with SMS phones, derived language,
                and preserved tags formatted specifically for GoHighLevel.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                id="download-ghl-ready-btn"
                className="btn btn-download-hero"
                onClick={downloadGhlReady}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download ghl_import_ready.csv
              </button>
            </div>
          </section>
        )}

        {/* Results & Inspection */}
        {result && (
          <div>
            {/* Metric Tiles */}
            <div className="metrics-row">
              <div className="metric-tile">
                <div className="metric-header">
                  <span className="metric-name">Ready for GHL</span>
                  <span className="metric-indicator ready" />
                </div>
                <div className="metric-number">{result.ready_count}</div>
                <div className="metric-footer">
                  {result.total_contacts > 0
                    ? Math.round((result.ready_count / result.total_contacts) * 100)
                    : 0}% of contacts
                </div>
              </div>

              <div className="metric-tile">
                <div className="metric-header">
                  <span className="metric-name">Needs Review</span>
                  <span className="metric-indicator review" />
                </div>
                <div className="metric-number">{result.review_count}</div>
                <div className="metric-footer">Missing phone or duplicate</div>
              </div>

              <div className="metric-tile">
                <div className="metric-header">
                  <span className="metric-name">Rejected</span>
                  <span className="metric-indicator reject" />
                </div>
                <div className="metric-number">{result.reject_count}</div>
                <div className="metric-footer">Archived records</div>
              </div>

              <div className="metric-tile">
                <div className="metric-header">
                  <span className="metric-name">Unique Tags</span>
                  <span className="metric-indicator neutral" />
                </div>
                <div className="metric-number">{result.total_tags}</div>
                <div className="metric-footer">Preserved unchanged</div>
              </div>
            </div>

            {/* Inspection Card */}
            <div className="card">
              {/* Tabs Navigation */}
              <div className="tabs-bar">
                <button
                  type="button"
                  id="tab-ready-btn"
                  className={`tab-link ${activeTab === "ready" ? "active" : ""}`}
                  onClick={() => setActiveTab("ready")}
                >
                  Ready Contacts ({result.ready_count})
                </button>
                <button
                  type="button"
                  id="tab-review-btn"
                  className={`tab-link ${activeTab === "review" ? "active" : ""}`}
                  onClick={() => setActiveTab("review")}
                >
                  Review Queue ({result.review_count})
                </button>
                <button
                  type="button"
                  id="tab-tags-btn"
                  className={`tab-link ${activeTab === "tags" ? "active" : ""}`}
                  onClick={() => setActiveTab("tags")}
                >
                  Tag Inventory ({result.total_tags})
                </button>
                <button
                  type="button"
                  id="tab-report-btn"
                  className={`tab-link ${activeTab === "report" ? "active" : ""}`}
                  onClick={() => setActiveTab("report")}
                >
                  Audit Log
                </button>
              </div>

              {/* TAB 1: READY CONTACTS */}
              {activeTab === "ready" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <input
                      type="text"
                      id="ready-search-input"
                      placeholder="Filter contacts..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="search-field"
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      Showing {filteredReady.length} preview rows
                    </span>
                  </div>

                  <div className="table-container">
                    <table className="clean-table" id="ready-contacts-table">
                      <thead>
                        <tr>
                          <th>Jobber ID</th>
                          <th>First Name</th>
                          <th>Last Name</th>
                          <th>Phone</th>
                          <th>Email</th>
                          <th>Language</th>
                          <th>Tags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReady.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                              No matching records found.
                            </td>
                          </tr>
                        ) : (
                          filteredReady.map((contact, idx) => (
                            <tr key={idx}>
                              <td className="cell-id">{contact["Jobber Client ID"]}</td>
                              <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>{contact["First Name"]}</td>
                              <td>{contact["Last Name"]}</td>
                              <td>
                                <span className="pill pill-ready">{contact["Phone"]}</span>
                              </td>
                              <td>{contact["Email"] || "—"}</td>
                              <td>
                                <span className="pill pill-neutral">{contact["Preferred Language"]}</span>
                              </td>
                              <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }} title={contact["Tags"]}>
                                {contact["Tags"]}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: REVIEW QUEUE */}
              {activeTab === "review" && (
                <div className="table-container">
                  <table className="clean-table" id="review-contacts-table">
                    <thead>
                      <tr>
                        <th>Jobber ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Reason for Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.review_sample.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                            No contacts require manual review.
                          </td>
                        </tr>
                      ) : (
                        result.review_sample.map((contact, idx) => (
                          <tr key={idx}>
                            <td className="cell-id">{contact["Jobber Client ID"]}</td>
                            <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                              {contact["First Name"]} {contact["Last Name"]}
                            </td>
                            <td>{contact["Phone"] || "—"}</td>
                            <td>{contact["Email"] || "—"}</td>
                            <td>
                              <span className="pill pill-review">
                                {contact["Data Quality Notes"] || "Requires Manual Audit"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: TAG INVENTORY */}
              {activeTab === "tags" && (
                <div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 14 }}>
                    Preserved Jobber tags and their occurrences:
                  </p>
                  <div className="tag-list-flex" id="tag-cloud-container">
                    {result.tag_inventory.map((item, idx) => (
                      <div className="tag-badge-item" key={idx}>
                        <span>{item.Tag}</span>
                        <span className="tag-counter">{item.Count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT LOG */}
              {activeTab === "report" && (
                <div>
                  <pre className="terminal-report" id="audit-report-box">
                    {result.report ||
                      `Dry run audit completed.\nDelimiter mode: ${result.tag_delimiter_mode}\nTotal contacts: ${result.total_contacts}\nReady: ${result.ready_count}\nReview: ${result.review_count}\nReject: ${result.reject_count}`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="minimal-footer container">
        <span>Jobber to GoHighLevel Preprocessor</span>
        <span>Standardized for Aeration & AI Workflows</span>
      </footer>
    </>
  );
}

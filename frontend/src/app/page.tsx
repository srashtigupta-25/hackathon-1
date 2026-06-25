"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";

type Analysis = {
  incident_summary: string;
  severity: Severity;
  affected_component: string;
  timeline: Array<{ timestamp: string; event: string }>;
  root_cause: string;
  contributing_factors: string[];
  evidence: string[];
  immediate_actions: string[];
  preventive_actions: string[];
  confidence_score: number;
};

type AnalysisResponse = {
  analysis: Analysis;
  metadata: {
    filename: string;
    characters_analyzed: number;
    truncated: boolean;
    model: string;
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".txt", ".log", ".pdf", ".docx"];

const SAMPLE_RESPONSE: AnalysisResponse = {
  analysis: {
    incident_summary:
      "Checkout requests failed after the payment client exhausted its connection pool during an upstream timeout.",
    severity: "high",
    affected_component: "checkout-api / payment-client",
    timeline: [
      { timestamp: "14:02:11", event: "Payment latency rises above the 2 second SLO." },
      { timestamp: "14:03:07", event: "Connection pool utilization reaches 100%." },
      { timestamp: "14:03:12", event: "Checkout requests begin returning HTTP 503." },
      { timestamp: "14:05:44", event: "Circuit breaker opens and failure volume stabilizes." },
    ],
    root_cause:
      "The payment client held connections while waiting on a degraded upstream service. Missing timeout and pool-isolation safeguards caused connection exhaustion and propagated failures into checkout.",
    contributing_factors: [
      "Upstream timeout exceeded the checkout request budget.",
      "The payment dependency shared a fixed connection pool.",
      "Alerting detected errors after customer impact began.",
    ],
    evidence: [
      "pool.active=50 pool.max=50",
      "payment request timed out after 3000ms",
      "POST /checkout -> 503",
    ],
    immediate_actions: [
      "Reduce the payment-client timeout and recycle exhausted connections.",
      "Open the circuit breaker and route eligible traffic to the fallback path.",
      "Verify pool recovery before restoring normal traffic.",
    ],
    preventive_actions: [
      "Isolate dependency connection pools and enforce request budgets.",
      "Add saturation alerts on pool utilization and payment latency.",
      "Load-test upstream degradation and circuit-breaker behavior.",
    ],
    confidence_score: 91,
  },
  metadata: {
    filename: "checkout-incident.log",
    characters_analyzed: 4872,
    truncated: false,
    model: "demo report",
  },
};

function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function validateFile(file: File) {
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(file.name))) {
    return "Choose a .txt, .log, .pdf, or .docx file.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File must be 5 MB or smaller.";
  }
  return "";
}

function severityLabel(severity: Severity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export default function AutopsyLab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const analysis = result?.analysis;
  const confidenceTone = useMemo(() => {
    const score = analysis?.confidence_score ?? 0;
    if (score >= 80) return "positive";
    if (score >= 55) return "warning";
    return "danger";
  }, [analysis]);

  function selectFile(nextFile?: File) {
    if (!nextFile) return;
    const validationError = validateFile(nextFile);
    setError(validationError);
    setFile(validationError ? null : nextFile);
    setResult(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function analyzeFile() {
    if (!file) {
      setError("Choose an incident log before starting the analysis.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("log_file", file);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "The analysis could not be completed.");
      }
      setResult(payload as AnalysisResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not connect to the analysis service.",
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "autopsy-lab-report.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Autopsy Lab home">
          <span className="brand-mark" aria-hidden="true">AL</span>
          <span>
            <strong>Autopsy Lab</strong>
            <small>AI incident reconstruction</small>
          </span>
        </a>
        <div className="header-meta">
          <span className="status-dot" aria-hidden="true" />
          Madison AI Hackathon · built in 4 hours
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">From noisy logs to an incident narrative</div>
        <h1>Understand why a system failed before the next alert fires.</h1>
        <p>
          Upload logs and receive an evidence-backed timeline, likely root cause,
          severity assessment, and prioritized remediation plan.
        </p>
        <div className="hero-pills" aria-label="Product capabilities">
          <span>Groq + Llama 3.3</span>
          <span>FastAPI</span>
          <span>Next.js</span>
          <span>Structured JSON</span>
        </div>
      </section>

      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace-copy">
          <span className="section-kicker">Incident input</span>
          <h2 id="workspace-title">Run a log autopsy</h2>
          <p>
            Files are read in memory and limited to 5 MB. Supported formats:
            TXT, LOG, PDF, and DOCX.
          </p>
        </div>

        <div
          className={`drop-zone ${dragging ? "is-dragging" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.log,.pdf,.docx"
            onChange={handleFileChange}
            className="sr-only"
          />
          <button
            className="file-trigger"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <span className="upload-icon" aria-hidden="true">↥</span>
            <span>
              <strong>{file ? file.name : "Drop an incident log here"}</strong>
              <small>
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB ready for analysis`
                  : "or click to choose a file"}
              </small>
            </span>
          </button>

          <div className="workspace-actions">
            <button
              className="primary-button"
              type="button"
              onClick={analyzeFile}
              disabled={loading}
            >
              {loading ? "Reconstructing incident…" : "Analyze incident"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setResult(SAMPLE_RESPONSE);
                setError("");
              }}
            >
              View sample report
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <strong>Analysis unavailable.</strong>
            <span>{error}</span>
          </div>
        )}
      </section>

      {loading && (
        <section className="loading-panel" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>Reconstructing the failure sequence</strong>
            <p>Extracting events, separating symptoms from cause, and validating the report.</p>
          </div>
        </section>
      )}

      {analysis && result && !loading && (
        <section className="report" aria-labelledby="report-title">
          <div className="report-heading">
            <div>
              <span className="section-kicker">Incident report</span>
              <h2 id="report-title">{analysis.incident_summary}</h2>
            </div>
            <button className="secondary-button" type="button" onClick={downloadReport}>
              Download JSON
            </button>
          </div>

          <div className="report-metadata">
            <div>
              <span>Severity</span>
              <strong className={`severity severity-${analysis.severity}`}>
                {severityLabel(analysis.severity)}
              </strong>
            </div>
            <div>
              <span>Component</span>
              <strong>{analysis.affected_component}</strong>
            </div>
            <div>
              <span>Confidence</span>
              <strong className={`confidence confidence-${confidenceTone}`}>
                {analysis.confidence_score}%
              </strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{result.metadata.filename}</strong>
            </div>
          </div>

          <div className="report-grid">
            <article className="report-card root-cause-card">
              <span className="card-label">Likely root cause</span>
              <p>{analysis.root_cause}</p>
            </article>

            <article className="report-card">
              <span className="card-label">Evidence from logs</span>
              <ul className="evidence-list">
                {analysis.evidence.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <article className="report-card timeline-card">
              <span className="card-label">Reconstructed timeline</span>
              <ol className="timeline">
                {analysis.timeline.map((item, index) => (
                  <li key={`${item.timestamp}-${index}`}>
                    <time>{item.timestamp}</time>
                    <p>{item.event}</p>
                  </li>
                ))}
              </ol>
            </article>

            <article className="report-card">
              <span className="card-label">Contributing factors</span>
              <ul>
                {analysis.contributing_factors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <article className="report-card action-card">
              <span className="card-label">Immediate actions</span>
              <ol>
                {analysis.immediate_actions.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </article>

            <article className="report-card">
              <span className="card-label">Prevent recurrence</span>
              <ul>
                {analysis.preventive_actions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </div>

          <footer className="report-footer">
            <span>{result.metadata.characters_analyzed.toLocaleString()} characters analyzed</span>
            <span>{result.metadata.model}</span>
            {result.metadata.truncated && <span>Input truncated to analysis limit</span>}
          </footer>
        </section>
      )}

      <footer className="site-footer">
        <span>Autopsy Lab · Madison AI Hackathon</span>
        <a href="https://github.com/srashtigupta-25/hackathon-1">
          View source on GitHub ↗
        </a>
      </footer>
    </main>
  );
}


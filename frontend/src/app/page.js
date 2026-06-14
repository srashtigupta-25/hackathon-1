"use client";
import React, { useState } from 'react';
import axios from 'axios';

export default function AutopsyLab() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append('log_file', file);

    try {
      const response = await axios.post('http://127.0.0.1:8000/analyze_logs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.error) {
        setError(response.data.error);
      } else {
        const raw = response.data.analysis_results;
        if (typeof raw === 'object') {
          setResult(raw);
        } else {
          try {
            setResult(JSON.parse(raw));
          } catch {
            setError("AI returned unstructured response. Try again.");
          }
        }
      }
    } catch (err) {
      setError("Failed to connect to backend. Is it running?");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = result
    ? result.confidence_score >= 80
      ? { text: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' }
      : result.confidence_score >= 50
      ? { text: '#facc15', bg: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.2)' }
      : { text: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' }
    : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c14',
      color: '#e2e8f0',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '0',
    }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '18px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>🔬</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>Autopsy Lab</div>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>System Failure Reconstruction Engine</div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        {/* Upload panel */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Log File</div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}>
              <span style={{ fontSize: 18 }}>📁</span>
              <span style={{ fontSize: 13, color: file ? '#93c5fd' : '#475569' }}>
                {file ? file.name : 'Choose .txt, .pdf, or .docx'}
              </span>
              <input type="file" onChange={handleFileChange} style={{ display: 'none' }} accept=".txt,.pdf,.docx" />
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={loading}
            style={{
              padding: '13px 32px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#1e293b' : 'linear-gradient(135deg, #2563eb, #0891b2)',
              color: loading ? '#475569' : '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.2px',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? '⏳ Analyzing...' : '⚡ Begin Autopsy'}
          </button>

          {error && (
            <div style={{
              width: '100%',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#f87171',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 20,
          }}>
            <div style={{
              width: 48, height: 48,
              border: '3px solid rgba(59,130,246,0.15)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ fontSize: 14, color: '#3b82f6', letterSpacing: '0.05em' }}>Reconstructing failure sequence...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            gap: 14,
            border: '1px dashed rgba(255,255,255,0.06)',
            borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>🩻</div>
            <div style={{ fontSize: 14, color: '#334155' }}>Awaiting log ingestion</div>
          </div>
        )}

        {/* Results */}
        {result && typeof result === 'object' && result.timeline && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Top row: confidence + root cause */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>

              {/* Confidence score */}
              <div style={{
                background: scoreColor.bg,
                border: `1px solid ${scoreColor.border}`,
                borderRadius: 16,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                gap: 8,
              }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</div>
                <div style={{ fontSize: 56, fontWeight: 800, color: scoreColor.text, lineHeight: 1, letterSpacing: '-2px' }}>
                  {result.confidence_score}
                </div>
                <div style={{ fontSize: 18, color: scoreColor.text, opacity: 0.7, marginTop: -8 }}>%</div>
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: scoreColor.border,
                  color: scoreColor.text,
                }}>
                  {result.confidence_score >= 80 ? 'High confidence' : result.confidence_score >= 50 ? 'Moderate' : 'Low confidence'}
                </div>
              </div>

              {/* Root cause */}
              <div style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 16,
                padding: '28px 28px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                }}>
                  <div style={{
                    width: 6, height: 6,
                    background: '#ef4444',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px #ef4444',
                  }} />
                  <div style={{ fontSize: 11, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Root Cause</div>
                </div>
                <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, margin: 0 }}>
                  {result.root_cause}
                </p>
              </div>
            </div>

            {/* Bottom row: timeline + fix */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Timeline */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                padding: '28px 28px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                }}>
                  <div style={{ width: 6, height: 6, background: '#3b82f6', borderRadius: '50%', boxShadow: '0 0 8px #3b82f6' }} />
                  <div style={{ fontSize: 11, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Event Timeline</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {(result.timeline ?? []).map((event, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < result.timeline.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                        <div style={{
                          width: 22, height: 22,
                          borderRadius: '50%',
                          background: 'rgba(59,130,246,0.1)',
                          border: '1px solid rgba(59,130,246,0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: '#60a5fa', fontWeight: 700,
                          flexShrink: 0,
                        }}>{i + 1}</div>
                        {i < result.timeline.length - 1 && (
                          <div style={{ width: 1, flex: 1, minHeight: 12, background: 'rgba(59,130,246,0.15)', marginTop: 4 }} />
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0 0', lineHeight: 1.5 }}>{event}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remediation */}
              <div style={{
                background: 'rgba(34,197,94,0.03)',
                border: '1px solid rgba(34,197,94,0.12)',
                borderRadius: 16,
                padding: '28px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <div style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }} />
                  <div style={{ fontSize: 11, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Recommended Remediation</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(Array.isArray(result.suggested_fix) ? result.suggested_fix : [result.suggested_fix]).map((fix, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 20, height: 20,
                        borderRadius: 6,
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#4ade80', fontWeight: 700, flexShrink: 0, marginTop: 1,
                      }}>✓</div>
                      <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{fix}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
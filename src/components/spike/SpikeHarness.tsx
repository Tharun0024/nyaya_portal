/**
 * SpikeHarness.tsx
 *
 * Minimal experiment harness for the technical spike.
 * NOT the production dashboard — just enough to validate:
 * 1. PDF upload → base64 conversion
 * 2. /api/analyze call → display raw validated JSON + latency
 * 3. PDF.js extraction → text index
 * 4. Evidence matcher → verification result display
 *
 * Accessibility: all interactive elements are real <button> elements,
 * keyboard-operable, with visible focus states.
 */

import { useCallback, useRef, useState } from 'react';
import { analyzeDocument, fileToBase64, ApiError } from '../../lib/api';
import type { AnalyzeResponse } from '../../lib/api';
import type { AnalysisResult } from '../../lib/schema';
import styles from './SpikeHarness.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = 'idle' | 'validating' | 'analyzing' | 'extracting' | 'matching' | 'done' | 'error';

interface EvidenceResult {
  quote: string;
  status: string;
  page?: number;
  similarity?: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Fixed context options (not free-text — keeps output deterministic)
// ---------------------------------------------------------------------------

const ROLES = [
  'Small Business Tenant',
  'Landlord',
  'Employee',
  'Employer',
  'Borrower',
  'Lender',
  'Home Buyer',
  'Home Seller',
];

const CONCERNS = [
  'Financial Exposure',
  'Exit / Termination Obligations',
  'Liability and Risk',
  'Rights and Protections',
  'Payment Terms',
  'Confidentiality / NDAs',
  'Dispute Resolution',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpikeHarness() {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [role, setRole] = useState(ROLES[0]);
  const [concern, setConcern] = useState(CONCERNS[0]);
  const [apiResponse, setApiResponse] = useState<AnalyzeResponse | null>(null);
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lazy-load PDF.js and evidenceMatcher to keep initial bundle lean
  const runSpike = useCallback(async () => {
    if (!selectedFile) return;

    setError(null);
    setApiResponse(null);
    setEvidenceResults([]);

    try {
      // ── Stage 1: Convert file to base64 ────────────────────────────────
      setStage('validating');
      const base64 = await fileToBase64(selectedFile);

      // ── Stage 2: Call /api/analyze ─────────────────────────────────────
      setStage('analyzing');
      const response = await analyzeDocument({ pdfBase64: base64, role, concern });
      setApiResponse(response);

      // ── Stage 3: PDF.js extraction ─────────────────────────────────────
      setStage('extracting');
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

      // Use self-hosted worker (ADR-0001: no CDN dependency)
      GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;

      const { extractDocumentIndex } = await import('../../lib/pdfText');
      const docIndex = await extractDocumentIndex(pdf);

      // ── Stage 4: Run evidence matcher on all quotes ────────────────────
      setStage('matching');
      const { matchEvidence, DEFAULT_MATCHER_CONFIG } = await import('../../lib/evidenceMatcher');

      const analysis: AnalysisResult = response.analysis;
      const results: EvidenceResult[] = [];

      // Gather all quotes from the response
      const allQuotes: Array<{ quote: string; page_hint: number | null }> = [
        ...analysis.obligations.map((o) => ({
          quote: o.exact_quote,
          page_hint: o.page_hint,
        })),
        ...analysis.attention_items.map((a) => ({
          quote: a.exact_quote,
          page_hint: a.page_hint,
        })),
        ...analysis.key_facts
          .filter((kf) => kf.exact_quote)
          .map((kf) => ({
            quote: kf.exact_quote!,
            page_hint: kf.page_hint,
          })),
      ];

      for (const { quote, page_hint } of allQuotes) {
        const matchResult = matchEvidence(
          quote,
          page_hint,
          docIndex,
          DEFAULT_MATCHER_CONFIG,
        );
        results.push({
          quote,
          status: matchResult.status,
          page: matchResult.spans?.[0]?.page,
          similarity: matchResult.similarity,
          reason: matchResult.reason,
        });
      }

      setEvidenceResults(results);
      setStage('done');
    } catch (err) {
      setStage('error');
      if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  }, [selectedFile, role, concern]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setApiResponse(null);
    setEvidenceResults([]);
    setError(null);
    setStage('idle');
  };

  const statusBadgeColor: Record<string, string> = {
    verified: '#22c55e',
    verified_approximate: '#84cc16',
    multiple_matches: '#f59e0b',
    unverified: '#ef4444',
    unverified_scanned: '#6b7280',
  };

  return (
    <main className={styles.harness} role="main">
      <h1 className={styles.title}>
        Nyaya_Portal — Technical Validation Harness
      </h1>
      <p className={styles.subtitle}>
        This is a minimal validation harness, not the production dashboard.
      </p>

      {/* Disclaimer */}
      <div className={styles.disclaimer} role="note" aria-label="Legal disclaimer">
        ⚠️ This tool provides informational analysis only. It does not constitute legal advice. Consult a qualified legal professional before making any decisions.
      </div>

      {/* Controls */}
      <section className={styles.controls} aria-labelledby="controls-heading">
        <h2 id="controls-heading" className={styles.sectionTitle}>Input</h2>

        <div className={styles.fieldGroup}>
          <label htmlFor="pdf-upload" className={styles.label}>
            PDF Document
          </label>
          <input
            id="pdf-upload"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className={styles.fileInput}
            aria-describedby="pdf-upload-hint"
          />
          <span id="pdf-upload-hint" className={styles.hint}>
            PDF only, up to 3 MB. Live analysis sends rendered pages to NVIDIA NIM; evidence checks stay in your browser.
          </span>
          {selectedFile && (
            <span className={styles.fileInfo}>
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="role-select" className={styles.label}>
            Your Role
          </label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={styles.select}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="concern-select" className={styles.label}>
            Primary Concern
          </label>
          <select
            id="concern-select"
            value={concern}
            onChange={(e) => setConcern(e.target.value)}
            className={styles.select}
          >
            {CONCERNS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          id="analyze-btn"
          className={styles.analyzeBtn}
          onClick={runSpike}
          disabled={!selectedFile || stage === 'analyzing' || stage === 'extracting' || stage === 'matching'}
          aria-busy={['analyzing', 'extracting', 'matching'].includes(stage)}
        >
          {stage === 'idle' || stage === 'done' || stage === 'error'
            ? 'Run Spike'
            : stage === 'validating'
            ? 'Validating...'
            : stage === 'analyzing'
            ? 'Analyzing with NVIDIA NIM...'
            : stage === 'extracting'
            ? 'Extracting PDF text...'
            : 'Matching evidence...'}
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className={styles.errorBox} role="alert" aria-live="assertive">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* API Response */}
      {apiResponse && (
        <section className={styles.results} aria-labelledby="results-heading">
          <h2 id="results-heading" className={styles.sectionTitle}>
            Analysis Result
            <span className={styles.badge}>
              {apiResponse.mock ? '🔧 MOCK' : '✅ LIVE'}
            </span>
            <span className={styles.latency}>
              {apiResponse.latencyMs}ms
            </span>
          </h2>

          <div className={styles.meta}>
            <span><strong>Document type:</strong> {apiResponse.analysis.document_type}</span>
            <span><strong>Request ID:</strong> {apiResponse.requestId}</span>
          </div>

          <p className={styles.summary}>{apiResponse.analysis.contextual_summary}</p>

          <details className={styles.rawJson}>
            <summary>Raw validated JSON response</summary>
            <pre className={styles.code}>
              {JSON.stringify(apiResponse.analysis, null, 2)}
            </pre>
          </details>
        </section>
      )}

      {/* Evidence Matching Results */}
      {evidenceResults.length > 0 && (
        <section className={styles.evidence} aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className={styles.sectionTitle}>
            Evidence Verification ({evidenceResults.length} quotes)
          </h2>
          <p className={styles.hint}>
            evidence_status is computed client-side by the deterministic matcher, not by the model.
          </p>
          <ul className={styles.evidenceList} aria-label="Evidence verification results">
            {evidenceResults.map((r, i) => (
              <li key={i} className={styles.evidenceItem}>
                <div className={styles.evidenceHeader}>
                  <span
                    className={styles.statusBadge}
                    style={{ backgroundColor: statusBadgeColor[r.status] ?? '#6b7280' }}
                    aria-label={`Status: ${r.status.replace(/_/g, ' ')}`}
                  >
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  {r.page !== undefined && (
                    <span className={styles.pageBadge}>p.{r.page + 1}</span>
                  )}
                  {r.similarity !== undefined && (
                    <span className={styles.simBadge}>
                      ~{(r.similarity * 100).toFixed(0)}% similar
                    </span>
                  )}
                </div>
                <blockquote className={styles.quote}>
                  &ldquo;{r.quote.slice(0, 200)}{r.quote.length > 200 ? '…' : ''}&rdquo;
                </blockquote>
                {r.reason && r.status !== 'verified' && (
                  <p className={styles.reason}>{r.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

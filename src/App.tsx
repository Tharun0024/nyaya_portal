import { useState, Suspense, lazy } from 'react';
import { LandingScreen } from './components/landing/LandingScreen';
import { ContextSelector } from './components/context/ContextSelector';
import type { AIAnalysisProvider } from './lib/providers';
import { NvidiaProvider, DemoProvider } from './lib/providers';
import type { AnalysisResult } from './lib/schema';
import type { NormalizedSpan } from './lib/evidenceMatcher';
import type { RoleId, ConcernId } from './lib/domain';
import { roleLabel, concernLabel } from './lib/domain';
import { fileToBase64 } from './lib/api';
import { validatePdfFile } from './lib/pdfText';
import { useEvidence } from './hooks/useEvidence';

const TwoPaneLayout = lazy(() => import('./components/dashboard/TwoPaneLayout').then(m => ({ default: m.TwoPaneLayout })));
const LeftPane = lazy(() => import('./components/dashboard/LeftPane').then(m => ({ default: m.LeftPane })));
const PDFViewer = lazy(() => import('./components/pdf/PDFViewer').then(m => ({ default: m.PDFViewer })));

type AppStage = 'landing' | 'context-selection' | 'analyzing' | 'dashboard';
type Mode = 'live' | 'demo';

/** Evidence highlight target driven by MatchResult.spans */
interface HighlightTarget {
  spans: NormalizedSpan[];
  /** 0-indexed page */
  page: number;
}

const analysisCache = new WeakMap<File, Map<string, AnalysisResult>>();

export default function App() {
  const [stage, setStage] = useState<AppStage>('landing');
  const [mode, setMode] = useState<Mode>('demo');
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<AIAnalysisProvider | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<RoleId>('small-business-tenant');
  const [concernId, setConcernId] = useState<ConcernId>('financial-exposure');
  const [highlightTarget, setHighlightTarget] = useState<HighlightTarget | null>(null);

  const { evidenceMap } = useEvidence(file, analysisResult);

  const handleExploreDemo = () => {
    setMode('demo');
    setProvider(new DemoProvider());
    setError(null);
    setHighlightTarget(null);
    setRoleId('small-business-tenant');
    setConcernId('financial-exposure');
    setStage('context-selection');
  };

  const handleAnalyzeDocument = async (selectedFile: File) => {
    const validation = await validatePdfFile(selectedFile);
    if (!validation.valid) {
      setError(validation.reason);
      return;
    }
    setFile(selectedFile);
    setMode('live');
    setProvider(new NvidiaProvider());
    setError(null);
    setHighlightTarget(null);
    setRoleId('small-business-tenant');
    setConcernId('financial-exposure');
    setStage('context-selection');
  };

  const handleStartAnalysis = async (selectedRoleId: RoleId, selectedConcernId: ConcernId) => {
    setRoleId(selectedRoleId);
    setConcernId(selectedConcernId);
    setStage('analyzing');
    setError(null);
    setHighlightTarget(null);

    try {
      let base64 = '';
      let cacheKey = '';

      if (mode === 'demo') {
        const response = await fetch('/demo/clean-lease.pdf');
        if (!response.ok) throw new Error('Failed to load demo asset.');
        const blob = await response.blob();
        const demoFile = new File([blob], 'clean-lease.pdf', { type: 'application/pdf' });
        setFile(demoFile);
        base64 = await fileToBase64(demoFile);
      } else {
        if (!file) throw new Error('No file selected.');
        cacheKey = `${selectedRoleId}-${selectedConcernId}`;

        const fileCache = analysisCache.get(file);
        if (fileCache && fileCache.has(cacheKey)) {
          setAnalysisResult(fileCache.get(cacheKey)!);
          setStage('dashboard');
          return;
        }

        base64 = await fileToBase64(file);
      }

      if (!provider) throw new Error('AI Provider not initialized.');
      const result = await provider.analyze(base64, selectedRoleId, selectedConcernId);

      if (mode === 'live' && file && cacheKey) {
        let fileCache = analysisCache.get(file);
        if (!fileCache) {
          fileCache = new Map<string, AnalysisResult>();
          analysisCache.set(file, fileCache);
        }
        fileCache.set(cacheKey, result.analysis);
      }

      setAnalysisResult(result.analysis);
      setStage('dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (mode === 'live') {
        setStage('landing');
      } else {
        setStage('context-selection');
      }
    }
  };

  /**
   * Called when the user clicks "Show Evidence" on any finding.
   * Resolves the MatchResult for that item and drives the PDFViewer highlight.
   */
  const handleEvidenceClick = (itemId: string, pageHint: number | null) => {
    const match = evidenceMap[itemId];
    if (match?.spans && match.spans.length > 0) {
      setHighlightTarget({ spans: match.spans, page: match.spans[0].page });
    } else if (pageHint !== null && pageHint !== undefined) {
      // No bbox available — navigate by page hint only
      setHighlightTarget({ spans: [], page: pageHint - 1 });
    }
  };

  const handleSwitchContext = () => {
    setError(null);
    setHighlightTarget(null);
    setStage('context-selection');
  };

  // Derive display labels from typed IDs
  const roleDisplay = roleLabel(roleId);
  const concernDisplay = concernLabel(concernId);

  return (
    <main id="main-content" tabIndex={-1}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {stage === 'landing' && (
        <LandingScreen
          onAnalyzeDocument={handleAnalyzeDocument}
          onExploreDemo={handleExploreDemo}
          error={error}
        />
      )}

      {stage === 'context-selection' && (
        <ContextSelector
          onStartAnalysis={handleStartAnalysis}
          isDemoMode={mode === 'demo'}
          error={error}
          initialRoleId={roleId}
          initialConcernId={concernId}
        />
      )}

      {stage === 'analyzing' && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Analyzing document as ${roleDisplay}`}
          data-testid="analyzing-state"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 48, height: 48,
              border: '3px solid var(--color-border-strong)',
              borderTopColor: 'var(--color-brand)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <h2 className="text-h2">Reading the document…</h2>
          <p className="text-body">
            Applying context: <strong>{roleDisplay}</strong> · <strong>{concernDisplay}</strong>
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {stage === 'dashboard' && analysisResult && file && (
        <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading analysis workspace...</div>}>
          <TwoPaneLayout
            leftPane={
              <LeftPane
                role={roleDisplay}
                concern={concernDisplay}
                analysisResult={analysisResult}
                evidenceMap={evidenceMap}
                onSwitchContext={handleSwitchContext}
                onEvidenceClick={handleEvidenceClick}
              />
            }
            rightPane={
              <PDFViewer
                file={file}
                targetPage={
                  highlightTarget?.page !== undefined ? highlightTarget.page + 1 : undefined
                }
                highlightTarget={highlightTarget}
              />
            }
          />
        </Suspense>
      )}
    </main>
  );
}

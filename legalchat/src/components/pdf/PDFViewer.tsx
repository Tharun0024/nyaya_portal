import { useEffect, useRef, useState, useCallback } from 'react';
import type { NormalizedSpan } from '../../lib/evidenceMatcher';
import styles from './PDFViewer.module.css';

interface HighlightTarget {
  spans: NormalizedSpan[];
  /** 0-indexed page number */
  page: number;
}

interface PDFViewerProps {
  file: File;
  /** 1-indexed page hint (navigate to this page) */
  targetPage?: number;
  /** Evidence spans to highlight — from MatchResult.spans */
  highlightTarget?: HighlightTarget | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfPage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfDocument = any;

export function PDFViewer({ file, targetPage, highlightTarget }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerAreaRef = useRef<HTMLDivElement>(null);
  // Store the current PDF page object for ResizeObserver re-renders
  const currentPageRef = useRef<PdfPage | null>(null);
  // Store the last rendered viewport dimensions for overlay scaling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewportRef = useRef<any>(null);
  // Store the unscaled viewport (scale=1) dimensions for proper highlight calculations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unscaledViewportRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  // Track the page number whose pixels are currently on the canvas
  const renderedPageNumRef = useRef<number | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PdfDocument>(null);
  const [currentPage, setCurrentPage] = useState(1);   // 1-indexed for display
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Trigger highlight redraws without full re-render
  const [renderTick, setRenderTick] = useState(0);

  // ── Load PDF ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const { getDocument } = await import('pdfjs-dist');
        const { configurePdfWorker } = await import('../../lib/pdfWorker');
        configurePdfWorker();
        const buf = await file.arrayBuffer();
        const pdf = await getDocument({ data: buf }).promise;
        if (active) {
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [file]);

  // ── Navigate via targetPage prop ──────────────────────────────────────────
  useEffect(() => {
    if (targetPage !== undefined && targetPage > 0 && targetPage <= numPages) {
      setCurrentPage(targetPage);
    }
  }, [targetPage, numPages]);

  // ── Navigate to highlight page ─────────────────────────────────────────────
  useEffect(() => {
    if (highlightTarget && highlightTarget.page + 1 <= numPages) {
      setCurrentPage(highlightTarget.page + 1);
    }
  }, [highlightTarget, numPages]);

  // ── Render page to canvas ─────────────────────────────────────────────────
  const renderPage = useCallback(async (doc: PdfDocument, pageNum: number) => {
    if (!doc || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      renderedPageNumRef.current = null;
      setRenderTick(t => t + 1); // trigger highlight clear

      const page: PdfPage = await doc.getPage(pageNum);
      currentPageRef.current = page;
      const containerWidth = (viewerAreaRef.current?.clientWidth ?? 700) - 32;
      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / unscaled.width, 2.0);
      const vp = page.getViewport({ scale });

      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = '100%';

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport: vp });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;

      viewportRef.current = vp;
      unscaledViewportRef.current = unscaled;
      renderedPageNumRef.current = pageNum;
      // Trigger the highlight overlay to redraw
      setRenderTick(t => t + 1);
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException') {
        // Expected cancellation when resizing/re-rendering
        return;
      }
      console.error('PDF render error:', err);
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pdfDoc, currentPage);
    }
  }, [pdfDoc, currentPage, renderPage]);

  // ── ResizeObserver — recalculate highlights when container resizes ─────────
  useEffect(() => {
    const area = viewerAreaRef.current;
    if (!area || !pdfDoc) return;

    const observer = new ResizeObserver(() => {
      // Re-render the page at the new width (this also updates viewportRef)
      renderPage(pdfDoc, currentPage);
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [pdfDoc, currentPage, renderPage]);

  // ── Draw highlight overlay ────────────────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    // Clear existing highlights unconditionally first
    overlay.innerHTML = '';

    const canvas = canvasRef.current;
    const unscaledVp = unscaledViewportRef.current;
    if (!canvas || !unscaledVp || !highlightTarget) return;

    // Ensure we only draw highlights if the canvas pixels match the current page
    if (renderedPageNumRef.current !== currentPage) return;

    const spansOnPage = highlightTarget.spans.filter(
      (s: NormalizedSpan) => s.page === currentPage - 1
    );
    if (spansOnPage.length === 0) return;

    // PDF space: origin bottom-left, y↑.  Canvas space: origin top-left, y↓.
    const canvasW = canvas.offsetWidth;
    const canvasH = canvas.offsetHeight;
    const scaleX = canvasW / unscaledVp.width;
    const scaleY = canvasH / unscaledVp.height;

    for (const span of spansOnPage) {
      for (const [x, y, w, h] of span.bboxes) {
        const left   = x * scaleX;
        const top    = (unscaledVp.height - y - h) * scaleY;
        const width  = w * scaleX;
        const height = h * scaleY;

        const mark = document.createElement('div');
        mark.className = styles.highlight;
        mark.style.left   = `${left}px`;
        mark.style.top    = `${top}px`;
        mark.style.width  = `${width}px`;
        mark.style.height = `${height}px`;
        mark.setAttribute('aria-hidden', 'true');
        overlay.appendChild(mark);
      }
    }

    // Scroll first highlight into view
    const first = overlay.firstElementChild as HTMLElement | null;
    first?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // renderTick triggers this after each page render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightTarget, currentPage, renderTick]);

  const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(numPages, p + 1));

  const hasHighlightOnPage = highlightTarget?.spans.some(
    (s: NormalizedSpan) => s.page === currentPage - 1
  ) ?? false;

  return (
    <div className={styles.container} data-testid="pdf-viewer">
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span
          className={styles.documentName}
          title={file.name}
        >
          {file.name}
        </span>
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.navButton}
            onClick={handlePrev}
            disabled={currentPage === 1 || loading}
            aria-label="Previous page"
            data-testid="pdf-prev-btn"
          >
            ← Prev
          </button>
          <span
            className={styles.pageIndicator}
            aria-live="polite"
            aria-label={`Page ${currentPage} of ${numPages}`}
          >
            {loading ? '…' : `${currentPage} / ${numPages}`}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={handleNext}
            disabled={currentPage >= numPages || loading}
            aria-label="Next page"
            data-testid="pdf-next-btn"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Evidence navigator banner */}
      {highlightTarget && !loading && (
        <div
          className={`${styles.evidenceBanner} ${hasHighlightOnPage ? styles.evidenceBannerActive : ''}`}
          role="status"
          aria-live="polite"
          data-testid="evidence-banner"
        >
          <span className={styles.evidenceBannerLabel}>EVIDENCE HIGHLIGHTED</span>
          <span className={styles.evidenceBannerPage}>Page {highlightTarget.page + 1}</span>
        </div>
      )}

      {/* Viewer */}
      <div className={styles.viewerArea} ref={viewerAreaRef}>
        {loading && (
          <div className={styles.stateMessage} role="status" aria-live="polite" data-testid="pdf-loading">
            <div className={styles.spinner} aria-hidden="true" />
            Loading document…
          </div>
        )}
        {error && (
          <div
            className={styles.stateMessage}
            style={{ color: 'var(--color-severity-high)' }}
            role="alert"
            data-testid="pdf-error"
          >
            Failed to load PDF: {error}
          </div>
        )}
        {!loading && !error && (
          <div className={styles.pageWrapper}>
            <canvas
              ref={canvasRef}
              className={styles.pageCanvas}
              aria-label={`PDF page ${currentPage} of ${numPages}`}
              data-testid="pdf-canvas"
            />
            <div
              ref={overlayRef}
              className={styles.highlightOverlay}
              aria-hidden="true"
              data-testid="highlight-overlay"
            />
          </div>
        )}
      </div>
    </div>
  );
}

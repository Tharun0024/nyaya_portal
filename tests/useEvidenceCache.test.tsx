/**
 * useEvidenceCache.test.tsx
 *
 * TDD tests for caching DocumentIndex across context switches in useEvidence hook.
 * Verifies that switching context on the same file reuses the DocumentIndex and avoids
 * re-loading and re-extracting the PDF.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEvidence } from '../src/hooks/useEvidence';
import * as pdfTextModule from '../src/lib/pdfText';
import type { DocumentIndex } from '../src/lib/evidenceMatcher';
import type { AnalysisResult } from '../src/lib/schema';

// Mock pdfWorker to avoid worker loading in jsdom
vi.mock('../src/lib/pdfWorker', () => ({
  configurePdfWorker: vi.fn(),
  pdfWorkerUrl: 'mock-worker-url',
}));

// Mock pdfjs-dist getDocument
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({ numPages: 3 }),
  })),
}));

describe('useEvidence — In-Memory DocumentIndex Cache Across Context Switches', () => {
  const mockIndex: DocumentIndex = {
    normalizedText: "tenant shall pay tenant's pro-rata share of all operating expenses for the building not less than one hundred eighty (180) days prior to the expiration ordinary wear and tear excepted",
    charToItem: [],
    scannedPages: new Set(),
    pageCount: 3,
  };

  const tenantAnalysis: AnalysisResult = {
    document_type: 'Commercial Lease',
    contextual_summary: 'Tenant summary',
    key_facts: [],
    obligations: [
      {
        id: 'ob-tenant-1',
        who: 'Tenant',
        what: 'Pay Operating Expenses',
        exact_quote: "tenant shall pay tenant's pro-rata share of all operating expenses for the building",
        page_hint: 1,
      },
    ],
    attention_items: [],
    questions_for_professional: [],
    uncertainty_notes: [],
    disclaimer: 'Disclaimer...',
  };

  const landlordAnalysis: AnalysisResult = {
    document_type: 'Commercial Lease',
    contextual_summary: 'Landlord summary',
    key_facts: [],
    obligations: [
      {
        id: 'ob-landlord-1',
        who: 'Tenant',
        what: 'Renewal Notice',
        exact_quote: 'not less than one hundred eighty (180) days prior to the expiration',
        page_hint: 2,
      },
    ],
    attention_items: [],
    questions_for_professional: [],
    uncertainty_notes: [],
    disclaimer: 'Disclaimer...',
  };

  function createMockPdfFile(name = 'lease.pdf'): File {
    const buffer = Buffer.from('%PDF-1.4\n...');
    const file = new File([buffer], name, { type: 'application/pdf' });
    // In jsdom File.prototype.arrayBuffer is sometimes missing or stubbed
    if (!file.arrayBuffer) {
      file.arrayBuffer = async () => buffer.buffer;
    }
    return file;
  }

  let extractSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    extractSpy = vi.spyOn(pdfTextModule, 'extractDocumentIndex').mockResolvedValue(mockIndex);
  });

  it('A. first analysis for a file extracts the document index and matches quotes', async () => {
    const file = createMockPdfFile('doc1.pdf');
    const { result } = renderHook(
      ({ f, a }) => useEvidence(f, a),
      { initialProps: { f: file, a: tenantAnalysis } },
    );

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
    });

    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(result.current.evidenceMap['ob-tenant-1'].status).toBe('verified');
  });

  it('B & C. same file + new analysisResult (Tenant -> Landlord): reuses DocumentIndex without re-extraction and produces fresh evidenceMap', async () => {
    const file = createMockPdfFile('doc1.pdf');
    const { result, rerender } = renderHook(
      ({ f, a }) => useEvidence(f, a),
      { initialProps: { f: file, a: tenantAnalysis } },
    );

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
    });
    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(result.current.evidenceMap['ob-tenant-1'].status).toBe('verified');

    // Context switch: Same file object, Landlord analysisResult
    rerender({ f: file, a: landlordAnalysis });

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-landlord-1']).toBeDefined();
    });

    // CRITICAL ASSERTION: extractDocumentIndex was NOT called again!
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // CRITICAL ASSERTION: New analysis produced fresh evidenceMap (not stale tenant items)
    expect(result.current.evidenceMap['ob-landlord-1'].status).toBe('verified');
    expect(result.current.evidenceMap['ob-tenant-1']).toBeUndefined();
  });

  it('D. different PDF File object discards previous cache and rebuilds DocumentIndex', async () => {
    const file1 = createMockPdfFile('file1.pdf');
    const file2 = createMockPdfFile('file2.pdf');

    const { result, rerender } = renderHook(
      ({ f, a }) => useEvidence(f, a),
      { initialProps: { f: file1, a: tenantAnalysis } },
    );

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
    });
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // Upload new distinct File object
    rerender({ f: file2, a: tenantAnalysis });

    await waitFor(() => {
      expect(extractSpy).toHaveBeenCalledTimes(2);
    });

    expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
  });

  it('E. clearing file resets evidenceMap and clears cache', async () => {
    const file = createMockPdfFile('file1.pdf');

    const { result, rerender } = renderHook(
      ({ f, a }: { f: File | null; a: AnalysisResult | null }) => useEvidence(f, a),
      { initialProps: { f: file as File | null, a: tenantAnalysis as AnalysisResult | null } },
    );

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
    });

    // Clear file
    rerender({ f: null, a: null });

    await waitFor(() => {
      expect(result.current.evidenceMap).toEqual({});
    });
  });

  it('F. same file + same analysisResult remains idempotent with zero extra work', async () => {
    const file = createMockPdfFile('file1.pdf');

    const { result, rerender } = renderHook(
      ({ f, a }) => useEvidence(f, a),
      { initialProps: { f: file, a: tenantAnalysis } },
    );

    await waitFor(() => {
      expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
    });
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // Rerender with identical props
    rerender({ f: file, a: tenantAnalysis });

    expect(extractSpy).toHaveBeenCalledTimes(1);
    expect(result.current.evidenceMap['ob-tenant-1']).toBeDefined();
  });
});

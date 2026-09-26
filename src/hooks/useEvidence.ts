import { useState, useEffect, useMemo } from 'react';
import { extractDocumentIndex } from '../lib/pdfText';
import { matchEvidence, DEFAULT_MATCHER_CONFIG } from '../lib/evidenceMatcher';
import type { MatchResult, DocumentIndex } from '../lib/evidenceMatcher';
import type { AnalysisResult } from '../lib/schema';

type EvidenceMap = Record<string, MatchResult>;

/**
 * Pure helper to compute deterministic evidence matches for an AnalysisResult against a DocumentIndex.
 */
function computeEvidenceMap(analysisResult: AnalysisResult, index: DocumentIndex): EvidenceMap {
  const newMap: EvidenceMap = {};
  const checkQuotes = (items: Array<{ id: string; exact_quote?: string | null; page_hint?: number | null }>) => {
    for (const item of items) {
      if (item.exact_quote) {
        newMap[item.id] = matchEvidence(
          item.exact_quote,
          item.page_hint ?? null,
          index,
          DEFAULT_MATCHER_CONFIG,
        );
      }
    }
  };

  if (analysisResult.attention_items) checkQuotes(analysisResult.attention_items);
  if (analysisResult.obligations) checkQuotes(analysisResult.obligations);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (analysisResult.key_facts) checkQuotes(analysisResult.key_facts as any);

  return newMap;
}

/**
 * useEvidence — bridges the PDF text index with model-produced evidence quotes.
 *
 * Caches the extracted DocumentIndex in memory keyed by File identity.
 * When switching context on the same file, reuses the DocumentIndex and avoids
 * re-loading and re-extracting the PDF.
 *
 * Returns a map of item-id → MatchResult, computed deterministically via
 * evidenceMatcher.ts. No network calls.
 */
export function useEvidence(file: File | null, analysisResult: AnalysisResult | null) {
  const [cachedFile, setCachedFile] = useState<File | null>(null);
  const [docIndex, setDocIndex] = useState<DocumentIndex | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }

    // Reuse index if the file object is identical and already extracted
    if (file === cachedFile && docIndex !== null) {
      return;
    }

    let active = true;

    const buildAndMatch = async () => {
      try {
        const { getDocument } = await import('pdfjs-dist');
        const { configurePdfWorker } = await import('../lib/pdfWorker');
        configurePdfWorker();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        const index = await extractDocumentIndex(pdf);

        if (!active) return;
        setCachedFile(file);
        setDocIndex(index);
      } catch (err) {
        console.error('useEvidence: failed to build PDF text index', err);
        if (active) {
          setCachedFile(file);
          setDocIndex(null);
        }
      }
    };

    buildAndMatch();

    return () => {
      active = false;
    };
  }, [file, cachedFile, docIndex]);

  const evidenceMap = useMemo<EvidenceMap>(() => {
    if (!file || !analysisResult || !docIndex || file !== cachedFile) {
      return {};
    }
    return computeEvidenceMap(analysisResult, docIndex);
  }, [file, analysisResult, docIndex, cachedFile]);

  return { evidenceMap };
}

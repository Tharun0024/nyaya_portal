import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import {
  extractDocumentIndex,
  isLikelyScanned,
  SCANNED_CHAR_DENSITY_THRESHOLD,
} from '../src/lib/pdfText';
import { matchEvidence } from '../src/lib/evidenceMatcher';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';

describe('STEP 15C — Evidence Integrity & Scanned Page Threshold Regression', () => {
  // -------------------------------------------------------------------------
  // Fix 1: Scanned Page Density Threshold & Detection Integrity
  // -------------------------------------------------------------------------
  describe('Fix 1 — Scanned page classification logic', () => {
    it('SCANNED_CHAR_DENSITY_THRESHOLD is set to 0.0005', () => {
      expect(SCANNED_CHAR_DENSITY_THRESHOLD).toBe(0.0005);
    });

    it('isLikelyScanned correctly flags empty or near-empty pages as scanned', () => {
      // Standard A4 / Letter page area ~ 500,000 pt^2
      const pageWidth = 612;
      const pageHeight = 792;

      // 0 characters (scanned image page without OCR text)
      expect(isLikelyScanned([], pageWidth, pageHeight)).toBe(true);

      // 10 characters (stray OCR artifact or tiny mark) -> density = 10 / 484704 = 0.00002 < 0.0005
      const strayItems = [{ str: 'stray mark', transform: [1, 0, 0, 1, 0, 0] }];
      expect(isLikelyScanned(strayItems, pageWidth, pageHeight)).toBe(true);
    });

    it('isLikelyScanned does NOT flag normal typed pages with realistic densities as scanned', () => {
      const pageWidth = 612;
      const pageHeight = 792;
      // 1,000 characters -> density = 1000 / 484704 = 0.00206 > 0.0005
      const typedText = 'A'.repeat(1000);
      const typedItems = [{ str: typedText, transform: [1, 0, 0, 1, 0, 0] }];
      expect(isLikelyScanned(typedItems, pageWidth, pageHeight)).toBe(false);
    });

    it('clean-lease.pdf has 0 scanned pages and all pages are eligible for matching', async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

      const pdfPath = path.resolve('public/demo/clean-lease.pdf');
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;

      const docIndex = await extractDocumentIndex(pdf);

      expect(docIndex.pageCount).toBe(8);
      // Clean lease should have 0 scanned pages
      expect(docIndex.scannedPages.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Fix 2: Demo exact_quote alignment with clean-lease.pdf
  // -------------------------------------------------------------------------
  describe('Fix 2 — Demo exact_quote alignment & deterministic verification', () => {
    async function loadCleanLeaseIndex() {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

      const pdfPath = path.resolve('public/demo/clean-lease.pdf');
      const pdfBytes = fs.readFileSync(pdfPath);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
      return extractDocumentIndex(pdf);
    }

    it('every demo Key Fact exact_quote matches fixture as VERIFIED on expected page', async () => {
      const docIndex = await loadCleanLeaseIndex();
      const allKeyFacts = [
        ...CONTEXT_A_DATA.key_facts.map(f => ({ ...f, ctx: 'Tenant' })),
        ...CONTEXT_B_DATA.key_facts.map(f => ({ ...f, ctx: 'Landlord' })),
      ];

      expect(allKeyFacts.length).toBe(4);

      for (const kf of allKeyFacts) {
        expect(kf.exact_quote).toBeTruthy();
        expect(kf.page_hint).toBeDefined();

        const match = matchEvidence(kf.exact_quote!, kf.page_hint, docIndex);
        expect(
          match.status,
          `Key Fact ${kf.ctx} "${kf.label}" (${kf.id}) should be verified, got: ${match.status} (${match.reason})`,
        ).toBe('verified');

        expect(match.spans).toBeDefined();
        expect(match.spans!.length).toBeGreaterThan(0);
        // 1-indexed matched page
        const matchedPage = match.spans![0].page + 1;
        expect(
          matchedPage,
          `Key Fact ${kf.ctx} "${kf.label}" expected page ${kf.page_hint} but matched page ${matchedPage}`,
        ).toBe(kf.page_hint);
      }
    });

    it('every demo Attention Item exact_quote matches fixture as VERIFIED on expected page', async () => {
      const docIndex = await loadCleanLeaseIndex();
      const allAttentionItems = [
        ...CONTEXT_A_DATA.attention_items.map(a => ({ ...a, ctx: 'Tenant' })),
        ...CONTEXT_B_DATA.attention_items.map(a => ({ ...a, ctx: 'Landlord' })),
      ];

      expect(allAttentionItems.length).toBe(4);

      for (const ai of allAttentionItems) {
        expect(ai.exact_quote).toBeTruthy();
        expect(ai.page_hint).toBeDefined();

        const match = matchEvidence(ai.exact_quote, ai.page_hint, docIndex);
        expect(
          match.status,
          `Attention Item ${ai.ctx} "${ai.title}" (${ai.id}) should be verified, got: ${match.status} (${match.reason})`,
        ).toBe('verified');

        expect(match.spans).toBeDefined();
        expect(match.spans!.length).toBeGreaterThan(0);
        const matchedPage = match.spans![0].page + 1;
        expect(
          matchedPage,
          `Attention Item ${ai.ctx} "${ai.title}" expected page ${ai.page_hint} but matched page ${matchedPage}`,
        ).toBe(ai.page_hint);
      }
    });

    it('every demo Obligation exact_quote matches fixture as VERIFIED on expected page', async () => {
      const docIndex = await loadCleanLeaseIndex();
      const allObligations = [
        ...CONTEXT_A_DATA.obligations.map(o => ({ ...o, ctx: 'Tenant' })),
        ...CONTEXT_B_DATA.obligations.map(o => ({ ...o, ctx: 'Landlord' })),
      ];

      expect(allObligations.length).toBe(4);

      for (const ob of allObligations) {
        expect(ob.exact_quote).toBeTruthy();
        expect(ob.page_hint).toBeDefined();

        const match = matchEvidence(ob.exact_quote, ob.page_hint, docIndex);
        expect(
          match.status,
          `Obligation ${ob.ctx} "${ob.what}" (${ob.id}) should be verified, got: ${match.status} (${match.reason})`,
        ).toBe('verified');

        expect(match.spans).toBeDefined();
        expect(match.spans!.length).toBeGreaterThan(0);
        const matchedPage = match.spans![0].page + 1;
        expect(
          matchedPage,
          `Obligation ${ob.ctx} "${ob.what}" expected page ${ob.page_hint} but matched page ${matchedPage}`,
        ).toBe(ob.page_hint);
      }
    });

    it('deliberately paraphrased or hallucinated quote does NOT produce VERIFIED', async () => {
      const docIndex = await loadCleanLeaseIndex();

      // Paraphrased quote
      const paraphrased = 'The tenant must pay their proportionate portion of operational fees';
      const match1 = matchEvidence(paraphrased, 3, docIndex);
      expect(match1.status).not.toBe('verified');

      // Slightly altered quote
      const altered = 'Tenant shall pay to Landlord as base rent the total sum of Five Thousand Dollars monthly';
      const match2 = matchEvidence(altered, 2, docIndex);
      expect(match2.status).not.toBe('verified');
    });
  });
});

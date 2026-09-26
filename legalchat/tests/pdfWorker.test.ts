import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { pdfWorkerUrl, configurePdfWorker } from '../src/lib/pdfWorker';

describe('PDF.js Worker Runtime Integrity & Bundling', () => {
  it('exports a valid pdfWorkerUrl referencing pdf.worker.min.mjs', () => {
    expect(pdfWorkerUrl).toBeDefined();
    expect(typeof pdfWorkerUrl).toBe('string');
    expect(pdfWorkerUrl).toContain('pdf.worker.min');
  });

  it('configurePdfWorker sets GlobalWorkerOptions.workerSrc', () => {
    GlobalWorkerOptions.workerSrc = '';
    configurePdfWorker();
    expect(GlobalWorkerOptions.workerSrc).toBe(pdfWorkerUrl);
  });

  it('production build (dist) contains the packaged PDF.js worker asset', () => {
    const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
    if (!fs.existsSync(distAssetsDir)) {
      // If dist hasn't been built yet in this specific run, skip dist check
      return;
    }

    const files = fs.readdirSync(distAssetsDir);
    const workerFile = files.find(f => f.startsWith('pdf.worker.min') && f.endsWith('.mjs'));

    expect(workerFile).toBeDefined();

    if (workerFile) {
      const stats = fs.statSync(path.join(distAssetsDir, workerFile));
      // Full Mozilla PDF.js worker is ~1.26MB, verify it's not a stub
      expect(stats.size).toBeGreaterThan(500_000);
    }
  });

  it('production build index bundle references the packaged worker asset', () => {
    const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
    if (!fs.existsSync(distAssetsDir)) return;

    const files = fs.readdirSync(distAssetsDir);
    const workerFile = files.find(f => f.startsWith('pdf.worker.min') && f.endsWith('.mjs'));
    const indexBundle = files.find(f => f.startsWith('index-') && f.endsWith('.js') || f.startsWith('pdfWorker-') && f.endsWith('.js'));

    expect(workerFile).toBeDefined();
    expect(indexBundle).toBeDefined();

    // The emitted chunk or worker wrapper must contain the worker asset path
    const chunkFiles = files.filter(f => f.endsWith('.js'));
    let foundWorkerReference = false;
    for (const chunk of chunkFiles) {
      const content = fs.readFileSync(path.join(distAssetsDir, chunk), 'utf8');
      if (content.includes(workerFile!)) {
        foundWorkerReference = true;
        break;
      }
    }
    expect(foundWorkerReference).toBe(true);
  });
});

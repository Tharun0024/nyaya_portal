import { GlobalWorkerOptions } from 'pdfjs-dist';

/**
 * Deterministic, bundler-safe PDF.js worker configuration.
 *
 * Uses Vite's static asset URL resolution (`new URL(..., import.meta.url)`).
 * At build time, Vite copies `pdf.worker.min.mjs` to `dist/assets/` with a content hash
 * and rewrites this expression to point to the emitted asset URL.
 */
export const pdfWorkerUrl = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

export function configurePdfWorker(): void {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

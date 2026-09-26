import { describe, it, expect } from 'vitest';
import { validatePdfFile } from '../src/lib/pdfText';
import { validatePdfInput, MAX_PDF_SIZE_BYTES } from '../api/analyze';

describe('PDF Validation — Boundary & Correctness Tests', () => {
  const PDF_HEADER = '%PDF-1.4\n';

  function createMockFile(sizeBytes: number, header = PDF_HEADER, mimeType = 'application/pdf'): File {
    const buffer = Buffer.alloc(sizeBytes, 0x20); // fill with spaces
    if (header) {
      buffer.write(header, 0, 'ascii');
    }
    return new File([buffer], 'test.pdf', { type: mimeType });
  }

  function createMockBase64(sizeBytes: number, header = PDF_HEADER): string {
    const buffer = Buffer.alloc(sizeBytes, 0x20);
    if (header) {
      buffer.write(header, 0, 'ascii');
    }
    return buffer.toString('base64');
  }

  describe('validatePdfInput (Backend)', () => {
    it('accepts a valid small PDF', () => {
      const b64 = createMockBase64(1024);
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toBe(b64);
      }
    });

    it('accepts a PDF of exactly 3 * 1024 * 1024 bytes (3 MB boundary)', () => {
      const exact3MB = 3 * 1024 * 1024;
      const b64 = createMockBase64(exact3MB);
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(true);
    });

    it('rejects a PDF of exactly 3 * 1024 * 1024 + 1 byte', () => {
      const over3MB = 3 * 1024 * 1024 + 1;
      const b64 = createMockBase64(over3MB);
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('PDF exceeds size limit of 3 MB');
      }
    });

    it('rejects a 0-byte / empty PDF', () => {
      const b64 = Buffer.alloc(0).toString('base64');
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('pdfBase64 must be a non-empty string');
      }
    });

    it('rejects an invalid/non-PDF header', () => {
      const b64 = Buffer.from('NOT_A_PDF_FILE_HEADER', 'utf-8').toString('base64');
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('File does not appear to be a valid PDF');
      }
    });

    it('verifies size check is based on decoded/raw PDF bytes, NOT base64 string length', () => {
      // 2.5 MB raw PDF expands to ~3.33 MB base64 string (> 3,000,000 chars)
      const rawSize = Math.floor(2.5 * 1024 * 1024);
      const b64 = createMockBase64(rawSize);

      // Base64 string length is definitely greater than 3 MB (3,145,728 characters)
      expect(b64.length).toBeGreaterThan(MAX_PDF_SIZE_BYTES);

      // But decoded size is 2.5 MB, so it MUST be accepted
      const result = validatePdfInput(b64);
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePdfFile (Frontend)', () => {
    it('accepts a valid small PDF', async () => {
      const file = createMockFile(1024);
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts a PDF of exactly 3 * 1024 * 1024 bytes (3 MB boundary)', async () => {
      const exact3MB = 3 * 1024 * 1024;
      const file = createMockFile(exact3MB);
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects a PDF of exactly 3 * 1024 * 1024 + 1 byte with consistent error message', async () => {
      const over3MB = 3 * 1024 * 1024 + 1;
      const file = createMockFile(over3MB);
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('PDF exceeds size limit of 3 MB');
      }
    });

    it('rejects a 0-byte / empty file', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe('File is empty (0 bytes)');
      }
    });

    it('rejects a non-PDF MIME type', async () => {
      const file = new File([Buffer.from('%PDF-1.4')], 'image.png', { type: 'image/png' });
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('File must be a PDF');
      }
    });

    it('rejects a file missing %PDF- magic header', async () => {
      const file = new File([Buffer.from('NOT_A_PDF')], 'fake.pdf', { type: 'application/pdf' });
      const result = await validatePdfFile(file);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain('File does not appear to be a valid PDF');
      }
    });
  });
});

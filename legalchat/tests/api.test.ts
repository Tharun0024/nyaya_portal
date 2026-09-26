import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeDocument, ApiError, ANALYSIS_TIMEOUT_MS } from '../src/lib/api';
import type { AnalyzeRequest, AnalyzeResponse } from '../src/lib/api';

describe('src/lib/api.ts — Client Analysis Request Resilience', () => {
  const dummyRequest: AnalyzeRequest = {
    pdfBase64: 'JVBERi0xLjQK...',
    role: 'Small Business Tenant',
    concern: 'Financial Exposure',
  };

  const dummyResponse: AnalyzeResponse = {
    analysis: {
      document_type: 'Commercial Lease',
      contextual_summary: 'Summary...',
      key_facts: [],
      obligations: [],
      attention_items: [],
      questions_for_professional: [],
      uncertainty_notes: [],
      disclaimer: 'Disclaimer...',
    },
    mock: false,
    latencyMs: 1200,
    requestId: 'req-12345',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // A. Successful JSON response
  // -------------------------------------------------------------------------
  it('A. returns parsed AnalyzeResponse on successful 200 JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => dummyResponse,
    }));

    const result = await analyzeDocument(dummyRequest);
    expect(result).toEqual(dummyResponse);
    expect(result.requestId).toBe('req-12345');
  });

  // -------------------------------------------------------------------------
  // B. Structured non-2xx JSON error response
  // -------------------------------------------------------------------------
  it('B. throws ApiError with server error message on structured 400 JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ error: 'pdfBase64 must be a non-empty string' }),
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toThrow(ApiError);
    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'pdfBase64 must be a non-empty string',
      statusCode: 400,
    });
  });

  // -------------------------------------------------------------------------
  // C. 429 Rate Limit JSON response
  // -------------------------------------------------------------------------
  it('C. throws ApiError with status 429 and informative message on rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ error: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.' }),
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 429,
    });
  });

  it('C2. handles 429 with fallback message if server provides no error string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({}),
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 429,
    });
  });

  // -------------------------------------------------------------------------
  // D. Non-JSON HTML response (Vite preview SPA fallback)
  // -------------------------------------------------------------------------
  it('D. converts 200 HTML fallback to controlled preview-unavailable ApiError', async () => {
    // When Vite preview serves index.html on POST /api/analyze, status is 200 with text/html
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 200,
    });
  });

  it('D2. converts 404 HTML fallback to controlled preview-unavailable ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 404,
    });
  });

  // -------------------------------------------------------------------------
  // E. Non-JSON 5xx response (real server proxy error)
  // -------------------------------------------------------------------------
  it('E. converts non-JSON 502/504 gateway response to generic service-unavailable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 504,
    });
  });

  it('E2. converts non-JSON text/plain response on 500 to generic service-unavailable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'Content-Type': 'text/plain' }),
      json: async () => {
        throw new SyntaxError('Unexpected token I in JSON at position 0');
      },
    }));

    await expect(analyzeDocument(dummyRequest)).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      statusCode: 500,
    });
  });

  // -------------------------------------------------------------------------
  // F. Fetch TypeError / Network Rejection
  // -------------------------------------------------------------------------
  it('F. converts raw fetch TypeError to controlled network-failure ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const promise = analyzeDocument(dummyRequest);
    await expect(promise).rejects.toThrow(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
    });

    // Confirms "Failed to fetch" is NOT leaked
    try {
      await analyzeDocument(dummyRequest);
    } catch (err: any) {
      expect(err.message).not.toContain('Failed to fetch');
    }
  });

  // -------------------------------------------------------------------------
  // G. Client-side Timeout
  // -------------------------------------------------------------------------
  it('G. exports ANALYSIS_TIMEOUT_MS set to 45000', () => {
    expect(ANALYSIS_TIMEOUT_MS).toBe(45_000);
  });

  it('G2. aborts and throws timeout ApiError when request exceeds timeout threshold', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }
      });
    }));

    // Pass small timeout (25ms) for deterministic fast testing
    const promise = analyzeDocument(dummyRequest, 25);
    await expect(promise).rejects.toThrow(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: 'Analysis timed out after 45 seconds. Please try again.',
    });
  });

  // -------------------------------------------------------------------------
  // H. Content-Type Handling
  // -------------------------------------------------------------------------
  it('H. accepts application/json with charset parameter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json; charset=utf-8' }),
      json: async () => dummyResponse,
    }));

    const result = await analyzeDocument(dummyRequest);
    expect(result.requestId).toBe('req-12345');
  });

  // -------------------------------------------------------------------------
  // I. Backward Compatibility of ApiError
  // -------------------------------------------------------------------------
  it('I. ApiError retains name, message, statusCode, and requestId properties', () => {
    const err = new ApiError('Custom error', 400, 'req-abc');
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Custom error');
    expect(err.statusCode).toBe(400);
    expect(err.requestId).toBe('req-abc');
    expect(err instanceof Error).toBe(true);
  });
});

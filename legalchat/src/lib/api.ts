/**
 * api.ts — Client-side API caller
 *
 * Thin wrapper around fetch('/api/analyze').
 * Never exposes the API key — the key lives only on the server.
 */

import type { AnalysisResult } from './schema';

export const ANALYSIS_TIMEOUT_MS = 45_000;

export interface AnalyzeRequest {
  pdfBase64: string;
  role: string;
  concern: string;
}

export interface AnalyzeResponse {
  analysis: AnalysisResult;
  mock: boolean;
  latencyMs: number;
  requestId: string;
}

export class ApiError extends Error {
  statusCode?: number;
  requestId?: string;

  constructor(
    message: string,
    statusCode?: number,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

/**
 * Determine user-facing error message for non-JSON responses.
 *
 * Distinguishes local Vite preview / SPA fallback from real upstream 5xx errors.
 */
function getNonJsonErrorMessage(response: Response): string {
  const contentType = response.headers?.get('content-type')?.toLowerCase() ?? '';
  const isHtml = contentType.includes('text/html');

  // Real deployed server error (e.g. 500, 502, 503, 504) returning HTML/plain text
  if (response.status >= 500) {
    return 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.';
  }

  // Vite preview / SPA fallback serving index.html on 200 or 404
  if (isHtml || response.status === 200 || response.status === 404) {
    return 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.';
  }

  return 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.';
}

/**
 * Send a PDF (as base64) with role/concern context to the analysis endpoint.
 * Returns validated AnalysisResult or throws ApiError.
 */
export async function analyzeDocument(
  request: AnalyzeRequest,
  timeoutMs: number = ANALYSIS_TIMEOUT_MS,
): Promise<AnalyzeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('TIMEOUT'));
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    // Check if aborted by our timeout controller
    if (
      controller.signal.aborted ||
      (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message === 'TIMEOUT'))
    ) {
      throw new ApiError('Analysis timed out after 45 seconds. Please try again.', 408);
    }

    // Network interruption, DNS failure, connection refused, or TypeError
    throw new ApiError(
      'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(getNonJsonErrorMessage(response), response.status);
  }

  if (!response.ok) {
    const errorBody = body as { error?: string };
    if (response.status === 429) {
      throw new ApiError(
        'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
        response.status,
      );
    }

    throw new ApiError(
      errorBody?.error ?? 'Live analysis unavailable. The document passed PDF validation, but the analysis service could not complete the request.',
      response.status,
    );
  }

  return body as AnalyzeResponse;
}

/**
 * Convert a File object to a base64 string suitable for the API request.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (data:application/pdf;base64,)
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to convert file to base64'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { NimConfigurationError, getNimConfig } from '../api/nimConfig';
import { renderPdfToImages, requestNimAnalysis } from '../api/nimProvider';
import { validateAndSanitize } from '../src/lib/schema';

const config = {
  apiKey: 'test-key',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'test-model',
};

function mockFetch(content: string, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  }) as unknown as typeof fetch;
}

describe('NVIDIA NIM provider', () => {
  it('sends inline PDF page images and parses a successful chat completion', async () => {
    const fetchImpl = mockFetch('{"document_type":"Lease"}');
    const result = await requestNimAnalysis(
      ['data:image/jpeg;base64,abc'],
      'system rules',
      'analyze',
      { config, fetchImpl },
    );

    expect(result).toEqual({ document_type: 'Lease' });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-key');
    const requestBody = JSON.parse(String(init?.body));
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
    expect(requestBody.model).toBe('test-model');
    expect(requestBody.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,abc');
    expect(requestBody.stream).toBe(false);
  });

  it('returns a safe provider error for upstream failures', async () => {
    await expect(requestNimAnalysis([], '', '', {
      config,
      fetchImpl: mockFetch('upstream detail', 429),
    })).rejects.toMatchObject({
      name: 'NimProviderError',
      status: 429,
      message: 'NVIDIA NIM request failed.',
    });
  });

  it('rejects malformed JSON content', async () => {
    await expect(requestNimAnalysis([], '', '', {
      config,
      fetchImpl: mockFetch('not-json'),
    })).rejects.toMatchObject({
      name: 'NimProviderError',
      status: 502,
      message: 'NVIDIA NIM returned malformed JSON.',
    });
  });

  it('passes parsed but schema-invalid content to the authoritative Ajv validator', async () => {
    const result = await requestNimAnalysis([], '', '', {
      config,
      fetchImpl: mockFetch('{"document_type":"Lease"}'),
    });

    expect(validateAndSanitize(result).valid).toBe(false);
  });

  it('maps request aborts to a safe timeout error', async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
    ) as typeof fetch;

    await expect(requestNimAnalysis([], '', '', {
      config,
      fetchImpl,
      timeoutMs: 1,
    })).rejects.toMatchObject({
      name: 'NimProviderError',
      status: 504,
      message: 'NVIDIA NIM request timed out.',
    });
  });

  it('maps network failures to a safe provider error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('socket failure')) as unknown as typeof fetch;

    await expect(requestNimAnalysis([], '', '', {
      config,
      fetchImpl,
    })).rejects.toMatchObject({
      name: 'NimProviderError',
      status: 502,
      message: 'NVIDIA NIM request failed.',
    });
  });

  it('requires server-side credentials and endpoint configuration', () => {
    expect(() => getNimConfig({} as NodeJS.ProcessEnv)).toThrow(NimConfigurationError);
  });

  it('renders a PDF page to an inline JPEG image for NIM', async () => {
    const pdfPath = join(process.cwd(), 'public', 'demo', 'clean-lease.pdf');
    const pdfBytes = new Uint8Array(await readFile(pdfPath));
    const images = await renderPdfToImages(pdfBytes);

    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toMatch(/^data:image\/jpeg;base64,/);
  });
});
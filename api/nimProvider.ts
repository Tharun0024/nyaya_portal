import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { getNimConfig, MAX_PDF_PAGES, NIM_TIMEOUT_MS } from './nimConfig.js';
import type { NimConfig } from './nimConfig.js';

export class NimProviderError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'NimProviderError';
    this.status = status;
  }
}

export async function renderPdfToImages(pdfBytes: Uint8Array): Promise<string[]> {
  const loadingTask = getDocument({ data: pdfBytes });

  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new NimProviderError(`PDF exceeds the ${MAX_PDF_PAGES}-page limit.`, 400);
    }

    const images: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(150 / 72, 1800 / baseViewport.width, 2400 / baseViewport.height);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.82));
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    return images;
  } finally {
    await loadingTask.destroy();
  }
}

export async function requestNimAnalysis(
  images: string[],
  systemInstruction: string,
  userInstruction: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; config?: NimConfig } = {},
): Promise<unknown> {
  const config = options.config ?? getNimConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? NIM_TIMEOUT_MS);

  const pageParts = images.map((url) => ({
    type: 'image_url',
    image_url: { url },
  }));

  try {
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemInstruction },
          {
            role: 'user',
            content: [
              { type: 'text', text: userInstruction },
              ...pageParts,
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        top_k: 1,
        max_tokens: 4096,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new NimProviderError('NVIDIA NIM request failed.', response.status === 429 ? 429 : 502);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new NimProviderError('NVIDIA NIM returned an invalid response.', 502);
    }

    const content = (body as {
      choices?: Array<{ message?: { content?: unknown } }>;
    })?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new NimProviderError('NVIDIA NIM returned an invalid response.', 502);
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new NimProviderError('NVIDIA NIM returned malformed JSON.', 502);
    }
  } catch (error) {
    if (error instanceof NimProviderError) throw error;
    if (controller.signal.aborted) {
      throw new NimProviderError('NVIDIA NIM request timed out.', 504);
    }
    throw new NimProviderError('NVIDIA NIM request failed.', 502);
  } finally {
    clearTimeout(timeout);
  }
}
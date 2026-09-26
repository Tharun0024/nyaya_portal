export const MAX_PDF_PAGES = 200;
export const NIM_TIMEOUT_MS = 18_000;

export interface NimConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export class NimConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NimConfigurationError';
  }
}

export function getNimConfig(env: NodeJS.ProcessEnv = process.env): NimConfig {
  const apiKey = env.NVIDIA_API_KEY?.trim();
  const baseUrl = env.NIM_BASE_URL?.trim().replace(/\/+$/, '');
  const model = env.NIM_MODEL?.trim();

  if (!apiKey || !baseUrl || !model) {
    throw new NimConfigurationError('NVIDIA NIM configuration is incomplete.');
  }

  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new NimConfigurationError('NVIDIA NIM configuration is invalid.');
  }

  const isLocal = parsedBaseUrl.hostname === 'localhost' || parsedBaseUrl.hostname === '127.0.0.1';
  if (parsedBaseUrl.protocol !== 'https:' && !(isLocal && parsedBaseUrl.protocol === 'http:')) {
    throw new NimConfigurationError('NVIDIA NIM configuration is invalid.');
  }

  return { apiKey, baseUrl, model };
}

export function hasNimConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NVIDIA_API_KEY?.trim() && env.NIM_BASE_URL?.trim() && env.NIM_MODEL?.trim());
}
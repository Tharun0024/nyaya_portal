import { describe, expect, it } from 'vitest';
import { getNimConfig, NimConfigurationError } from '../api/nimConfig';

describe('NVIDIA NIM server configuration', () => {
  it('loads and normalizes complete server-side configuration', () => {
    expect(getNimConfig({
      NVIDIA_API_KEY: ' server-key ',
      NIM_BASE_URL: 'https://integrate.api.nvidia.com/v1/',
      NIM_MODEL: ' nvidia/test-model ',
    } as NodeJS.ProcessEnv)).toEqual({
      apiKey: 'server-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'nvidia/test-model',
    });
  });

  it('rejects incomplete configuration without exposing credentials', () => {
    expect(() => getNimConfig({ NVIDIA_API_KEY: 'not-printed' } as NodeJS.ProcessEnv))
      .toThrow(NimConfigurationError);
    expect(() => getNimConfig({} as NodeJS.ProcessEnv))
      .toThrow('NVIDIA NIM configuration is incomplete.');
  });

  it('rejects insecure non-local endpoints', () => {
    expect(() => getNimConfig({
      NVIDIA_API_KEY: 'key',
      NIM_BASE_URL: 'http://nim.example/v1',
      NIM_MODEL: 'model',
    } as NodeJS.ProcessEnv)).toThrow('NVIDIA NIM configuration is invalid.');
  });

  it('allows HTTP only for a localhost development endpoint', () => {
    expect(getNimConfig({
      NVIDIA_API_KEY: 'key',
      NIM_BASE_URL: 'http://localhost:8000/v1',
      NIM_MODEL: 'model',
    } as NodeJS.ProcessEnv).baseUrl).toBe('http://localhost:8000/v1');
  });
});
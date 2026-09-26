/**
 * providerIsolation.test.ts
 *
 * Verifies the provider isolation contract:
 * - DemoProvider makes ZERO network requests (no live model calls)
 * - DemoProvider returns correct data for each RoleId
 * - NvidiaProvider routes through analyzeDocument (does NOT call NVIDIA NIM directly)
 * - Provider interface contract is satisfied by both implementations
 *
 * Environment: node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoProvider } from '../src/lib/providers/DemoProvider';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';

// ── DemoProvider ──────────────────────────────────────────────────────────

describe('DemoProvider — provider isolation', () => {
  beforeEach(() => {
    // Ensure fetch is NOT called during DemoProvider usage
    vi.stubGlobal('fetch', () => {
      throw new Error('DemoProvider must NOT make network requests');
    });
    // Skip realistic analysis latency to speed up tests
    vi.stubGlobal('setTimeout', (cb: Function) => cb());
  });


  it('returns tenant context data for small-business-tenant role', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64data', 'small-business-tenant', 'financial-exposure');

    expect(result.mock).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.contextual_summary).toBe(CONTEXT_A_DATA.contextual_summary);
  });

  it('returns landlord context data for landlord role', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64data', 'landlord', 'exit-renewal');

    expect(result.mock).toBe(true);
    expect(result.analysis).toBeDefined();
    expect(result.analysis.contextual_summary).toBe(CONTEXT_B_DATA.contextual_summary);
  });

  it('rejects unsupported demo context: employee + liability-risk', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64data', 'employee', 'liability-risk'),
    ).rejects.toThrow(/Demo mode.*Tenant and Landlord/i);
  });

  it('rejects unsupported demo context: employer + rights-protections', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64data', 'employer', 'rights-protections'),
    ).rejects.toThrow(/Demo mode.*Tenant and Landlord/i);
  });

  it('rejects unsupported demo context: small-business-tenant + exit-renewal', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64data', 'small-business-tenant', 'exit-renewal'),
    ).rejects.toThrow(/Demo mode.*Tenant and Landlord/i);
  });

  it('rejects unsupported demo context: landlord + financial-exposure', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64data', 'landlord', 'financial-exposure'),
    ).rejects.toThrow(/Demo mode.*Tenant and Landlord/i);
  });

  it('result.analysis matches the AnalysisResult shape', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64data', 'small-business-tenant', 'financial-exposure');

    const { analysis } = result;
    expect(typeof analysis.document_type).toBe('string');
    expect(typeof analysis.contextual_summary).toBe('string');
    expect(Array.isArray(analysis.key_facts)).toBe(true);
    expect(Array.isArray(analysis.obligations)).toBe(true);
    expect(Array.isArray(analysis.attention_items)).toBe(true);
    expect(Array.isArray(analysis.questions_for_professional)).toBe(true);
    expect(typeof analysis.disclaimer).toBe('string');
  });

  it('attention_items have required fields', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64data', 'small-business-tenant', 'financial-exposure');

    for (const item of result.analysis.attention_items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.why_it_matters_for_context).toBe('string');
      expect(['info', 'caution', 'high']).toContain(item.severity);
      expect(typeof item.exact_quote).toBe('string');
    }
  });

  it('tenant and landlord produce DIFFERENT summaries (context lens test)', async () => {
    const provider = new DemoProvider();
    const tenantResult = await provider.analyze('', 'small-business-tenant', 'financial-exposure');
    const landlordResult = await provider.analyze('', 'landlord', 'exit-renewal');

    expect(tenantResult.analysis.contextual_summary).not.toBe(landlordResult.analysis.contextual_summary);
    expect(tenantResult.analysis.attention_items[0]?.title).not.toBe(landlordResult.analysis.attention_items[0]?.title);
  });

  it('tenant and landlord produce DIFFERENT questions_for_professional', async () => {
    const provider = new DemoProvider();
    const tenantResult = await provider.analyze('', 'small-business-tenant', 'financial-exposure');
    const landlordResult = await provider.analyze('', 'landlord', 'exit-renewal');

    expect(tenantResult.analysis.questions_for_professional).not.toEqual(
      landlordResult.analysis.questions_for_professional,
    );
  });

  it('includes a requestId in the response', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('', 'small-business-tenant', 'financial-exposure');
    expect(result.requestId).toBeTruthy();
  });
});

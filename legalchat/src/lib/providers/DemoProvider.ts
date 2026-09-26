import type { AnalyzeResponse } from '../api';
import type { AIAnalysisProvider } from './AIProvider';
import type { RoleId, ConcernId } from '../domain';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from './demoData';

export class UnsupportedDemoContextError extends Error {
  constructor(
    message = 'Demo mode supports the Tenant and Landlord lenses for this document. Choose one of those contexts to continue.'
  ) {
    super(message);
    this.name = 'UnsupportedDemoContextError';
  }
}

/**
 * Demo mode only supports the 2 clean-lease backed lenses:
 * 1. Small Business Tenant + Financial Exposure
 * 2. Landlord + Exit/Renewal Obligations
 */
export function isSupportedDemoContext(roleId: RoleId, concernId: ConcernId): boolean {
  return (
    (roleId === 'small-business-tenant' && concernId === 'financial-exposure') ||
    (roleId === 'landlord' && concernId === 'exit-renewal')
  );
}

export class DemoProvider implements AIAnalysisProvider {
  private latencyMs: number;

  constructor(latencyMs?: number) {
    this.latencyMs =
      latencyMs ??
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 0 : 1500);
  }

  async analyze(_pdfBase64: string, roleId: RoleId, concernId: ConcernId): Promise<AnalyzeResponse> {
    if (!isSupportedDemoContext(roleId, concernId)) {
      throw new UnsupportedDemoContextError();
    }

    // Simulate realistic analysis latency
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }

    // Use stable typed ID — no string matching heuristics
    const data = roleId === 'landlord' ? CONTEXT_B_DATA : CONTEXT_A_DATA;

    return {
      analysis: data,
      latencyMs: this.latencyMs,
      mock: true,
      requestId: `demo-${roleId}-${concernId}`,
    };
  }
}

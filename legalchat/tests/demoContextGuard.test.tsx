/**
 * demoContextGuard.test.tsx
 *
 * Test-driven verification for DemoProvider unsupported-context guard.
 *
 * Requirements:
 * 1. DemoProvider explicitly rejects any role/concern combination other than:
 *    - small-business-tenant + financial-exposure -> CONTEXT_A_DATA
 *    - landlord + exit-renewal -> CONTEXT_B_DATA
 * 2. Throws typed UnsupportedDemoContextError with product-facing message:
 *    "Demo mode supports the Tenant and Landlord lenses for this document. Choose one of those contexts to continue."
 * 3. NvidiaProvider retains full role/concern capability (no restriction in live AI mode).
 * 4. ContextSelector renders accessible error message and keeps user in context selection.
 * 5. App integration: unsupported context prevents dashboard rendering and displays error alert.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoProvider, UnsupportedDemoContextError, isSupportedDemoContext } from '../src/lib/providers/DemoProvider';
import { NvidiaProvider } from '../src/lib/providers/NvidiaProvider';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';
import { ContextSelector } from '../src/components/context/ContextSelector';
import App from '../src/App';
import * as apiModule from '../src/lib/api';
import type { RoleId, ConcernId } from '../src/lib/domain';

// Mock CSS modules
vi.mock('../src/components/landing/LandingScreen.module.css', () => ({ default: {} }));
vi.mock('../src/components/context/ContextSelector.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/TwoPaneLayout.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/ContextBar.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/AttentionItemCard.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/GuidedActions.module.css', () => ({ default: {} }));
vi.mock('../src/components/common/LegalDisclaimer.module.css', () => ({ default: {} }));
vi.mock('../src/components/pdf/PDFViewer.module.css', () => ({ default: {} }));

describe('DemoProvider — Supported vs Unsupported Contexts', () => {

  it('supports small-business-tenant + financial-exposure -> CONTEXT_A_DATA', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64', 'small-business-tenant', 'financial-exposure');
    expect(result.mock).toBe(true);
    expect(result.analysis.contextual_summary).toBe(CONTEXT_A_DATA.contextual_summary);
  });

  it('supports landlord + exit-renewal -> CONTEXT_B_DATA', async () => {
    const provider = new DemoProvider();
    const result = await provider.analyze('base64', 'landlord', 'exit-renewal');
    expect(result.mock).toBe(true);
    expect(result.analysis.contextual_summary).toBe(CONTEXT_B_DATA.contextual_summary);
  });

  it('rejects employee + liability-risk with typed UnsupportedDemoContextError', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64', 'employee', 'liability-risk'),
    ).rejects.toThrow(UnsupportedDemoContextError);
  });

  it('rejects employer + rights-protections with typed UnsupportedDemoContextError', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64', 'employer', 'rights-protections'),
    ).rejects.toThrow(UnsupportedDemoContextError);
  });

  it('rejects small-business-tenant + exit-renewal', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64', 'small-business-tenant', 'exit-renewal'),
    ).rejects.toThrow(UnsupportedDemoContextError);
  });

  it('rejects landlord + financial-exposure', async () => {
    const provider = new DemoProvider();
    await expect(
      provider.analyze('base64', 'landlord', 'financial-exposure'),
    ).rejects.toThrow(UnsupportedDemoContextError);
  });

  it('has clear, product-facing error message without engineering terms', async () => {
    const provider = new DemoProvider();
    try {
      await provider.analyze('base64', 'employee', 'liability-risk');
      expect.fail('Expected provider.analyze to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedDemoContextError);
      const msg = (err as Error).message;
      expect(msg).toContain('Demo mode supports the Tenant and Landlord lenses for this document');
      expect(msg).not.toMatch(/context a|context b|invalid role id|unsupported enum/i);
    }
  });

  it('rejects all other 14 combinations of the 4x4 matrix', async () => {
    const roles: RoleId[] = ['small-business-tenant', 'landlord', 'employee', 'employer'];
    const concerns: ConcernId[] = ['financial-exposure', 'exit-renewal', 'liability-risk', 'rights-protections'];
    const provider = new DemoProvider();

    for (const r of roles) {
      for (const c of concerns) {
        const isSupported = (r === 'small-business-tenant' && c === 'financial-exposure') ||
                            (r === 'landlord' && c === 'exit-renewal');
        expect(isSupportedDemoContext(r, c)).toBe(isSupported);

        if (!isSupported) {
          await expect(
            provider.analyze('base64', r, c),
          ).rejects.toThrow(UnsupportedDemoContextError);
        }
      }
    }
  });
});

describe('NvidiaProvider — Preserves live AI mode', () => {
  it('does NOT reject non-demo combinations like employee + liability-risk', async () => {
    const analyzeDocSpy = vi.spyOn(apiModule, 'analyzeDocument').mockResolvedValue({
      analysis: CONTEXT_A_DATA,
      latencyMs: 800,
      mock: false,
      requestId: 'live-test',
    });

    const nvidiaProvider = new NvidiaProvider();
    const result = await nvidiaProvider.analyze('base64', 'employee', 'liability-risk');

    expect(result.requestId).toBe('live-test');
    expect(analyzeDocSpy).toHaveBeenCalledWith({
      pdfBase64: 'base64',
      role: 'Employee',
      concern: 'Liability and Risk',
    });

    analyzeDocSpy.mockRestore();
  });
});

describe('ContextSelector — Accessible Error Alert', () => {
  it('renders accessible alert when error is provided', () => {
    render(
      <ContextSelector
        onStartAnalysis={vi.fn()}
        isDemoMode={true}
        error="Demo mode supports the Tenant and Landlord lenses for this document. Choose one of those contexts to continue."
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(screen.getByText(/Demo mode supports the Tenant and Landlord lenses for this document/i)).toBeTruthy();
  });

  it('does not render alert when error is null or undefined', () => {
    render(
      <ContextSelector
        onStartAnalysis={vi.fn()}
        isDemoMode={true}
        error={null}
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('App Integration — UI prevents unsupported Demo Contexts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unsupported Demo combinations cannot be selected through the normal UI', async () => {
    // Mock demo fetch for clean-lease.pdf
    const dummyBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(dummyBlob),
    }));

    render(<App />);

    // Click "Explore Interactive Demo"
    fireEvent.click(screen.getByTestId('explore-demo-btn'));

    // Should be on context selection
    expect(screen.getByText(/Choose your demo context/i)).toBeTruthy();

    // Verify unsupported roles are not in the DOM
    expect(screen.queryByTestId('role-chip-employee')).toBeNull();
    expect(screen.queryByTestId('role-chip-employer')).toBeNull();

    // Verify supported roles are present
    expect(screen.getByTestId('role-chip-small-business-tenant')).toBeTruthy();
    expect(screen.getByTestId('role-chip-landlord')).toBeTruthy();

    // Verify only appropriate concerns are available
    expect(screen.getByTestId('concern-chip-financial-exposure')).toBeTruthy();
    expect(screen.queryByTestId('concern-chip-liability-risk')).toBeNull();
  });
});

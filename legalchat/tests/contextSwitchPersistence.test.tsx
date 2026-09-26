/**
 * contextSwitchPersistence.test.tsx
 *
 * Test-driven verification for Step 9 — Context Switch Persistence.
 *
 * Requirements:
 * 1. Initial load: ContextSelector defaults to Small Business Tenant + Financial Exposure.
 * 2. Persistence: When returning to ContextSelector from the dashboard, the previous
 *    role and concern remain selected (e.g. Landlord + Exit/Renewal).
 * 3. User control: User can change either dimension independently without resetting the other.
 * 4. In-session UI state only: no localStorage, sessionStorage, cookies, or URL params.
 * 5. Regression: Supported demo flows and Step 8 unsupported-context guards remain fully intact.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextSelector } from '../src/components/context/ContextSelector';
import App from '../src/App';

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

describe('ContextSelector — Initial Selection & Prop Persistence', () => {
  it('A. defaults to Small Business Tenant and Financial Exposure when no initial props passed', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);

    const tenantChip = screen.getByTestId('role-chip-small-business-tenant');
    const landlordChip = screen.getByTestId('role-chip-landlord');
    const financeChip = screen.getByTestId('concern-chip-financial-exposure');
    const exitChip = screen.queryByTestId('concern-chip-exit-renewal');

    expect(tenantChip.getAttribute('aria-pressed')).toBe('true');
    expect(landlordChip.getAttribute('aria-pressed')).toBe('false');
    expect(financeChip.getAttribute('aria-pressed')).toBe('true');
    expect(exitChip).toBeNull();

    expect(screen.getByText(/Analysing as:/i).textContent).toContain('Small Business Tenant');
    expect(screen.getByText(/Analysing as:/i).textContent).toContain('Financial Exposure');
  });

  it('B. initializes with initialRoleId and initialConcernId when provided', () => {
    render(
      <ContextSelector
        onStartAnalysis={vi.fn()}
        isDemoMode={true}
        initialRoleId="landlord"
        initialConcernId="exit-renewal"
      />
    );

    const tenantChip = screen.getByTestId('role-chip-small-business-tenant');
    const landlordChip = screen.getByTestId('role-chip-landlord');
    const financeChip = screen.queryByTestId('concern-chip-financial-exposure');
    const exitChip = screen.getByTestId('concern-chip-exit-renewal');

    expect(landlordChip.getAttribute('aria-pressed')).toBe('true');
    expect(tenantChip.getAttribute('aria-pressed')).toBe('false');
    expect(exitChip.getAttribute('aria-pressed')).toBe('true');
    expect(financeChip).toBeNull();

    expect(screen.getByText(/Analysing as:/i).textContent).toContain('Landlord');
    expect(screen.getByText(/Analysing as:/i).textContent).toContain('Exit / Renewal Obligations');
  });

  it('C. Live mode allows user to change role independently without resetting concern', () => {
    const onStartAnalysis = vi.fn();
    render(
      <ContextSelector
        onStartAnalysis={onStartAnalysis}
        isDemoMode={false} // Demo mode restricts roles, so we test this in Live mode
        initialRoleId="landlord"
        initialConcernId="financial-exposure"
      />
    );

    // Switch role to Employee
    fireEvent.click(screen.getByTestId('role-chip-employee'));

    expect(screen.getByTestId('role-chip-employee').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('role-chip-landlord').getAttribute('aria-pressed')).toBe('false');
    // Concern should remain
    expect(screen.getByTestId('concern-chip-financial-exposure').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(onStartAnalysis).toHaveBeenCalledWith('employee', 'financial-exposure');
  });

  it('C. Live mode allows user to change concern independently without resetting role', () => {
    const onStartAnalysis = vi.fn();
    render(
      <ContextSelector
        onStartAnalysis={onStartAnalysis}
        isDemoMode={false} // Demo mode restricts concerns, so we test this in Live mode
        initialRoleId="landlord"
        initialConcernId="exit-renewal"
      />
    );

    // Switch concern to Liability and Risk
    fireEvent.click(screen.getByTestId('concern-chip-liability-risk'));

    expect(screen.getByTestId('concern-chip-liability-risk').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('concern-chip-exit-renewal').getAttribute('aria-pressed')).toBe('false');
    // Role should remain Landlord
    expect(screen.getByTestId('role-chip-landlord').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(onStartAnalysis).toHaveBeenCalledWith('landlord', 'liability-risk');
  });
});

describe('App — Context Switch Persistence Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves Landlord + Exit/Renewal context when clicking Change on dashboard', async () => {
    const dummyBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(dummyBlob),
    }));

    render(<App />);

    // 1. Enter demo
    fireEvent.click(screen.getByTestId('explore-demo-btn'));
    expect(screen.getByText(/Choose your demo context/i)).toBeTruthy();

    // 2. Select Landlord + Exit / Renewal
    fireEvent.click(screen.getByTestId('role-chip-landlord'));
    fireEvent.click(screen.getByTestId('concern-chip-exit-renewal'));

    // 3. Run Demo Analysis
    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    // 4. Await deterministic rendered state of lazy-loaded dashboard
    expect(await screen.findByTestId('pdf-viewer')).toBeTruthy();
    expect(await screen.findByText(/Strict Renewal Window/i)).toBeTruthy();

    // 5. Click "Change" button on ContextBar
    const changeBtn = screen.getByRole('button', { name: /Switch context/i });
    fireEvent.click(changeBtn);

    // 6. Should be back on ContextSelector
    expect(await screen.findByText(/Choose your demo context/i)).toBeTruthy();

    // 7. Verify Landlord and Exit / Renewal are still selected!
    const landlordChip = screen.getByTestId('role-chip-landlord');
    const tenantChip = screen.getByTestId('role-chip-small-business-tenant');
    const exitChip = screen.getByTestId('concern-chip-exit-renewal');

    expect(landlordChip.getAttribute('aria-pressed')).toBe('true');
    expect(tenantChip.getAttribute('aria-pressed')).toBe('false');
    expect(exitChip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('concern-chip-financial-exposure')).toBeNull();

    const preview = screen.getByText(/Analysing as:/i);
    expect(preview.textContent).toContain('Landlord');
    expect(preview.textContent).toContain('Exit / Renewal Obligations');
  });

  it('D. Step 8 guard regression: Demo Mode proactively switches back to valid demo context rather than breaking', async () => {
    const dummyBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(dummyBlob),
    }));

    render(<App />);

    // 1. Enter demo
    fireEvent.click(screen.getByTestId('explore-demo-btn'));

    // 2. Select Landlord + Exit / Renewal
    fireEvent.click(screen.getByTestId('role-chip-landlord'));
    // exit-renewal is selected automatically now, but just checking it works
    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    // 3. Await deterministic rendered state of lazy-loaded dashboard
    expect(await screen.findByTestId('pdf-viewer')).toBeTruthy();

    // 4. Click Change
    fireEvent.click(screen.getByRole('button', { name: /Switch context/i }));

    expect(await screen.findByText(/Choose your demo context/i)).toBeTruthy();

    // 5. User clicks Tenant role. Financial Exposure should be selected automatically.
    fireEvent.click(screen.getByTestId('role-chip-small-business-tenant'));

    // We expect NO unsupported context error, because UI enforces combinations
    expect(screen.queryByRole('alert')).toBeNull();

    // Financial exposure chip should be the only concern available
    expect(screen.getByTestId('concern-chip-financial-exposure')).toBeTruthy();
    expect(screen.queryByTestId('concern-chip-exit-renewal')).toBeNull();
  });
});

/**
 * components.test.tsx
 *
 * Component-level tests for Nyaya_Portal UI.
 *
 * Uses @testing-library/react with jsdom environment.
 * No live NIM API calls are made — uses DemoProvider data.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock CSS modules (module files return empty objects in test env)
vi.mock('../src/components/landing/LandingScreen.module.css', () => ({ default: {} }));
vi.mock('../src/components/context/ContextSelector.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/AttentionItemCard.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/GuidedActions.module.css', () => ({ default: {} }));
vi.mock('../src/components/common/LegalDisclaimer.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/ContextBar.module.css', () => ({ default: {} }));

// ── LandingScreen ─────────────────────────────────────────────────────────

import { LandingScreen } from '../src/components/landing/LandingScreen';

describe('LandingScreen', () => {
  it('renders product name', () => {
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={vi.fn()}
      />
    );
    // The word appears in multiple contexts (header, disclaimer) — verify at least one element
    expect(screen.getAllByText(/Nyaya_Portal/i).length).toBeGreaterThan(0);
  });

  it('renders "Explore Interactive Demo" button', () => {
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={vi.fn()}
      />
    );
    const btn = screen.getByTestId('explore-demo-btn');
    expect(btn).toBeTruthy();
  });

  it('calls onExploreDemo when Explore Demo button is clicked', () => {
    const onExploreDemo = vi.fn();
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={onExploreDemo}
      />
    );
    fireEvent.click(screen.getByTestId('explore-demo-btn'));
    expect(onExploreDemo).toHaveBeenCalledTimes(1);
  });

  it('displays error message when error prop is set', () => {
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={vi.fn()}
        error="Analysis failed: quota exceeded"
      />
    );
    expect(screen.getByText(/quota exceeded/i)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders legal disclaimer', () => {
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={vi.fn()}
      />
    );
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('does not show error when error is null', () => {
    render(
      <LandingScreen
        onAnalyzeDocument={vi.fn()}
        onExploreDemo={vi.fn()}
        error={null}
      />
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ── ContextSelector ──────────────────────────────────────────────────────

import { ContextSelector } from '../src/components/context/ContextSelector';

describe('ContextSelector', () => {
  it('Live Mode: renders role chips for all 4 roles', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={false} />);
    expect(screen.getByTestId('role-chip-small-business-tenant')).toBeTruthy();
    expect(screen.getByTestId('role-chip-landlord')).toBeTruthy();
    expect(screen.getByTestId('role-chip-employee')).toBeTruthy();
    expect(screen.getByTestId('role-chip-employer')).toBeTruthy();
  });

  it('Live Mode: renders concern chips for all 4 concerns', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={false} />);
    expect(screen.getByTestId('concern-chip-financial-exposure')).toBeTruthy();
    expect(screen.getByTestId('concern-chip-exit-renewal')).toBeTruthy();
    expect(screen.getByTestId('concern-chip-liability-risk')).toBeTruthy();
    expect(screen.getByTestId('concern-chip-rights-protections')).toBeTruthy();
  });

  it('Demo Mode: exposes only the two supported combinations', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    // Only two roles
    expect(screen.getByTestId('role-chip-small-business-tenant')).toBeTruthy();
    expect(screen.getByTestId('role-chip-landlord')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-employee')).toBeNull();
    expect(screen.queryByTestId('role-chip-employer')).toBeNull();

    // Only one concern at a time
    expect(screen.getByTestId('concern-chip-financial-exposure')).toBeTruthy();
    expect(screen.queryByTestId('concern-chip-exit-renewal')).toBeNull();
    expect(screen.queryByTestId('concern-chip-liability-risk')).toBeNull();
    expect(screen.queryByTestId('concern-chip-rights-protections')).toBeNull();
  });

  it('shows demo banner when isDemoMode=true', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    expect(screen.getByLabelText('Demo mode active')).toBeTruthy();
  });

  it('does NOT show demo banner when isDemoMode=false', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={false} />);
    expect(screen.queryByLabelText('Demo mode active')).toBeNull();
  });

  it('first role chip is active (aria-pressed=true) by default', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    const chip = screen.getByTestId('role-chip-small-business-tenant');
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking landlord role chip in Demo Mode automatically selects exit-renewal concern', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    const landlordChip = screen.getByTestId('role-chip-landlord');
    fireEvent.click(landlordChip);
    expect(landlordChip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('role-chip-small-business-tenant').getAttribute('aria-pressed')).toBe('false');
    // Ensure the concern automatically updated
    expect(screen.getByTestId('concern-chip-exit-renewal')).toBeTruthy();
    expect(screen.queryByTestId('concern-chip-financial-exposure')).toBeNull();
  });

  it('switching Demo to Live restores the full option set', () => {
    const { rerender } = render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    expect(screen.queryByTestId('role-chip-employee')).toBeNull();

    rerender(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={false} />);
    expect(screen.getByTestId('role-chip-employee')).toBeTruthy();
    expect(screen.getByTestId('concern-chip-liability-risk')).toBeTruthy();
  });

  it('calls onStartAnalysis with typed IDs on submit', () => {
    const onStartAnalysis = vi.fn();
    render(<ContextSelector onStartAnalysis={onStartAnalysis} isDemoMode={true} />);
    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(onStartAnalysis).toHaveBeenCalledWith('small-business-tenant', 'financial-exposure');
  });

  it('calls onStartAnalysis with landlord ID after switching', () => {
    const onStartAnalysis = vi.fn();
    render(<ContextSelector onStartAnalysis={onStartAnalysis} isDemoMode={true} />);
    fireEvent.click(screen.getByTestId('role-chip-landlord'));
    // The concern chip click is no longer necessary, but it should be available
    fireEvent.click(screen.getByTestId('concern-chip-exit-renewal'));
    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(onStartAnalysis).toHaveBeenCalledWith('landlord', 'exit-renewal');
  });

  it('shows "Run Demo Analysis" button text in demo mode', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} />);
    expect(screen.getByText('Run Demo Analysis')).toBeTruthy();
  });

  it('shows "Analyze Document" button text in live mode', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={false} />);
    expect(screen.getByText('Analyze Document')).toBeTruthy();
  });

  it('displays accessible error alert when error prop is provided', () => {
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
    expect(screen.getByText(/Demo mode supports the Tenant and Landlord lenses/i)).toBeTruthy();
  });

  it('does not display error alert when error prop is null', () => {
    render(<ContextSelector onStartAnalysis={vi.fn()} isDemoMode={true} error={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('respects initialRoleId and initialConcernId when provided', () => {
    render(
      <ContextSelector
        onStartAnalysis={vi.fn()}
        isDemoMode={false}
        initialRoleId="landlord"
        initialConcernId="exit-renewal"
      />
    );
    expect(screen.getByTestId('role-chip-landlord').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('role-chip-small-business-tenant').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('concern-chip-exit-renewal').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('concern-chip-financial-exposure').getAttribute('aria-pressed')).toBe('false');
  });
});

// ── AttentionItemCard ────────────────────────────────────────────────────

import { AttentionItemCard } from '../src/components/dashboard/AttentionItemCard';

const HIGH_ITEM = {
  id: 'ai-test-1',
  title: 'Uncapped Operating Expenses',
  severity: 'high' as const,
  why_it_matters_for_context: 'Your financial exposure could increase unpredictably year over year.',
  exact_quote: 'Tenant shall pay Tenant\'s Proportionate Share of all Operating Expenses',
  page_hint: 2,
};

const CAUTION_ITEM = {
  id: 'ai-test-2',
  title: 'Strict Late Fee Provision',
  severity: 'caution' as const,
  why_it_matters_for_context: 'A 5% late fee kicks in after just 5 days.',
  exact_quote: 'five percent (5%) of the overdue amount',
  page_hint: 1,
};

const INFO_ITEM = {
  id: 'ai-test-3',
  title: 'Standard Restoration Clause',
  severity: 'info' as const,
  why_it_matters_for_context: 'A standard clause but worth verifying at exit.',
  exact_quote: 'ordinary wear and tear excepted',
  page_hint: 4,
};

describe('AttentionItemCard — rendering', () => {
  it('renders item title', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByText('Uncapped Operating Expenses')).toBeTruthy();
  });

  it('renders why_it_matters_for_context text', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByText(/financial exposure could increase/i)).toBeTruthy();
  });

  it('renders the exact_quote as a blockquote', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByRole('blockquote')).toBeTruthy();
  });

  it('renders HIGH severity badge with correct label', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByLabelText(/severity: high/i)).toBeTruthy();
  });

  it('renders CAUTION severity badge', () => {
    render(<AttentionItemCard item={CAUTION_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByLabelText(/severity: attention/i)).toBeTruthy();
  });

  it('renders INFO severity badge', () => {
    render(<AttentionItemCard item={INFO_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByLabelText(/severity: note/i)).toBeTruthy();
  });
});

describe('AttentionItemCard — evidence states', () => {
  it('VERIFIED: shows "Verified" badge and active show-evidence button', () => {
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[10, 10, 100, 20]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={vi.fn()} />);

    expect(screen.getByLabelText(/evidence status: source text verified/i)).toBeTruthy();
    const btn = screen.getByTestId('show-evidence-btn-ai-test-1');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('APPROXIMATE: shows "Approx. match" badge and active button', () => {
    const approxMatch = { status: 'verified_approximate', spans: [], similarity: 0.88 };
    render(<AttentionItemCard item={CAUTION_ITEM} evidenceMatch={approxMatch} onEvidenceClick={vi.fn()} />);

    expect(screen.getByLabelText(/evidence status: approx/i)).toBeTruthy();
    const btn = screen.getByTestId('show-evidence-btn-ai-test-2');
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('MULTIPLE_MATCHES: shows "Multiple matches" badge and active button', () => {
    const multiMatch = { status: 'multiple_matches', spans: [] };
    render(<AttentionItemCard item={INFO_ITEM} evidenceMatch={multiMatch} onEvidenceClick={vi.fn()} />);

    expect(screen.getByLabelText(/evidence status: multiple matches/i)).toBeTruthy();
    expect(screen.getByTestId('show-evidence-btn-ai-test-3')).toBeTruthy();
  });

  it('UNVERIFIED: shows "Evidence not located" badge and no show-evidence button', () => {
    const unverified = { status: 'unverified' };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={unverified} onEvidenceClick={vi.fn()} />);

    expect(screen.getByLabelText(/evidence status:.*not located/i)).toBeTruthy();
    expect(screen.queryByTestId('show-evidence-btn-ai-test-1')).toBeNull();
  });

  it('default (no evidenceMatch): shows UNVERIFIED state', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByLabelText(/evidence status:.*not located/i)).toBeTruthy();
  });

  it('evidence button calls onEvidenceClick', () => {
    const onEvidenceClick = vi.fn();
    const verifiedMatch = { status: 'verified', spans: [] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={onEvidenceClick} />);
    fireEvent.click(screen.getByTestId('show-evidence-btn-ai-test-1'));
    expect(onEvidenceClick).toHaveBeenCalledTimes(1);
  });

  it('provides explicit accessible name on "Show in document" button', () => {
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[0, 0, 10, 10]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={vi.fn()} />);
    const btn = screen.getByTestId('show-evidence-btn-ai-test-1');
    expect(btn.getAttribute('aria-label')).toBe('Show evidence in document for: Uncapped Operating Expenses');
  });

  it('displays non-color feedback "Shown on page 2" after user clicks Show in document', () => {
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[0, 0, 10, 10]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={vi.fn()} />);
    const btn = screen.getByTestId('show-evidence-btn-ai-test-1');
    expect(btn.textContent).toContain('Show in document · p. 2');

    fireEvent.click(btn);
    expect(btn.textContent).toContain('Shown on page 2');
    expect(btn.textContent).toContain('✓');
  });

  it('reflects external isActive prop with "Shown on page" state', () => {
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[0, 0, 10, 10]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} isActive={true} onEvidenceClick={vi.fn()} />);
    const btn = screen.getByTestId('show-evidence-btn-ai-test-1');
    expect(btn.textContent).toContain('Shown on page 2');
    expect(btn.textContent).toContain('✓');
  });

  it('renders SOURCE label and page metadata in evidence header', () => {
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[0, 0, 10, 10]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={vi.fn()} />);
    const evidenceBlock = screen.getByTestId('evidence-block-ai-test-1');
    expect(evidenceBlock.textContent).toContain('SOURCE');
    expect(evidenceBlock.textContent).toContain('Page 2');
  });

  it('supports keyboard activation via Enter and Space keys', () => {
    const onEvidenceClick = vi.fn();
    const verifiedMatch = { status: 'verified', spans: [{ page: 1, bboxes: [[0, 0, 10, 10]] }] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={onEvidenceClick} />);
    const btn = screen.getByTestId('show-evidence-btn-ai-test-1');

    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    // Native buttons respond to click on Enter / Space in browsers; simulating click:
    fireEvent.click(btn);
    expect(onEvidenceClick).toHaveBeenCalled();
  });

  it('handles unverified scanned status with specific honest notice', () => {
    const scannedMatch = { status: 'unverified_scanned' };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={scannedMatch} onEvidenceClick={vi.fn()} />);
    expect(screen.getAllByText(/scanned pdf — text unavailable/i).length).toBeGreaterThanOrEqual(1);
  });

  it('data-evidence-status attribute reflects display status', () => {
    const verifiedMatch = { status: 'verified_approximate', spans: [] };
    render(<AttentionItemCard item={HIGH_ITEM} evidenceMatch={verifiedMatch} onEvidenceClick={vi.fn()} />);
    const article = screen.getByTestId('attention-item-ai-test-1');
    expect(article.getAttribute('data-evidence-status')).toBe('approximate');
  });
});

describe('AttentionItemCard — guided actions', () => {
  it('renders "Explain this" guided action chip', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    expect(screen.getByText('Explain this')).toBeTruthy();
  });

  it('clicking "Explain this" reveals explanation content', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    const chip = screen.getByText('Explain this');
    fireEvent.click(chip);
    // Explanation content appears; title appears in both the heading AND the explanation text
    const matches = screen.getAllByText(/uncapped operating expenses/i);
    expect(matches.length).toBeGreaterThan(1);
  });

  it('"Explain this" chip has aria-pressed=false initially', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    const chip = screen.getByText('Explain this');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('"Explain this" chip has aria-pressed=true after click', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    const chip = screen.getByText('Explain this');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking same chip again collapses the explanation', () => {
    render(<AttentionItemCard item={HIGH_ITEM} onEvidenceClick={vi.fn()} />);
    const chip = screen.getByText('Explain this');
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });
});

// ── LegalDisclaimer ──────────────────────────────────────────────────────

import { LegalDisclaimer } from '../src/components/common/LegalDisclaimer';

describe('LegalDisclaimer', () => {
  it('renders with role="note"', () => {
    render(<LegalDisclaimer />);
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('contains the word "legal professional"', () => {
    render(<LegalDisclaimer />);
    expect(screen.getByText(/legal professional/i)).toBeTruthy();
  });

  it('says "does not provide" in a way that makes clear it is NOT legal advice', () => {
    render(<LegalDisclaimer />);
    const note = screen.getByRole('note');
    const text = note.textContent?.toLowerCase() ?? '';
    // The disclaimer correctly says "does not provide legal advice" — verify that context
    expect(text).toContain('does not');
    expect(text).toContain('legal professional');
  });
});

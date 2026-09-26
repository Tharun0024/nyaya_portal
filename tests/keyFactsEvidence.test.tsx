/**
 * keyFactsEvidence.test.tsx
 *
 * TDD test suite for Key Facts evidence status rendering and consistency.
 *
 * Verifies:
 * - Key Facts display canonical evidence badges (Verified, Approx. match, Multiple matches, Not located in PDF)
 * - Navigation action ("Show in document") is enabled for verified/approximate/multiple
 * - Navigation action is NOT available for unverified / missing quotes (no ghost highlights)
 * - Existing Attention Items continue to behave correctly
 * - Base Rent Key Fact no longer claims $4,500 and matches actual PDF value ($5,000)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPane } from '../src/components/dashboard/LeftPane';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';
import type { AnalysisResult } from '../src/lib/schema';
import { normalize } from '../src/lib/evidenceMatcher';
import fs from 'fs';
import path from 'path';


// Mock CSS modules
vi.mock('../src/components/dashboard/LeftPane.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/ContextBar.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/AttentionItemCard.module.css', () => ({ default: {} }));
vi.mock('../src/components/dashboard/GuidedActions.module.css', () => ({ default: {} }));
vi.mock('../src/components/common/LegalDisclaimer.module.css', () => ({ default: {} }));

const mockAnalysis: AnalysisResult = {
  document_type: 'Commercial Lease',
  contextual_summary: 'Test summary for legal navigator.',
  key_facts: [
    {
      id: 'kf-verified',
      label: 'Base Rent',
      value: '$5,000 per month',
      exact_quote: 'Tenant shall pay to Landlord as base rent the sum of Five Thousand Dollars ($5,000.00) per month',
      page_hint: 2,
    },
    {
      id: 'kf-approx',
      label: 'Late Fee',
      value: '5% after 5 days',
      exact_quote: 'late charge equal to five percent',
      page_hint: 2,
    },
    {
      id: 'kf-multiple',
      label: 'Security Deposit',
      value: '$10,000',
      exact_quote: 'Ten Thousand Dollars ($10,000.00)',
      page_hint: 2,
    },
    {
      id: 'kf-unverified',
      label: 'Utility Proration',
      value: '12%',
      exact_quote: 'Tenant pays 12% of total utilities',
      page_hint: 3,
    },
    {
      id: 'kf-no-quote',
      label: 'Governing Law',
      value: 'California',
      exact_quote: null,
      page_hint: null,
    },
  ],
  obligations: [],
  attention_items: [
    {
      id: 'ai-1',
      title: 'Uncapped Operating Expenses',
      severity: 'high',
      why_it_matters_for_context: 'No cap on annual expense increases.',
      exact_quote: "Tenant shall pay Tenant's pro-rata share of all Operating Expenses",
      page_hint: 3,
    },
  ],
  questions_for_professional: [],
  uncertainty_notes: [],
  disclaimer: 'Informational only.',
};

describe('Key Facts Evidence Status Rendering in LeftPane', () => {
  it('renders "Source text verified" badge and enables document navigation for verified facts', () => {
    const onEvidenceClick = vi.fn();
    const evidenceMap = {
      'kf-verified': {
        status: 'verified' as const,
        spans: [{ start: 0, end: 50, page: 1, bboxes: [[0, 0, 100, 20] as [number, number, number, number]] }],
      },
    };

    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    // Verified badge should be present
    expect(screen.getByText('Source text verified')).toBeTruthy();

    // Document navigation button should be available
    const showBtn = screen.getByRole('button', { name: /Show in document for Base Rent/i });
    expect(showBtn).toBeTruthy();

    fireEvent.click(showBtn);
    expect(onEvidenceClick).toHaveBeenCalledWith('kf-verified', 2);
  });

  it('renders "Approx. match" badge and enables document navigation for approximate matches', () => {
    const onEvidenceClick = vi.fn();
    const evidenceMap = {
      'kf-approx': {
        status: 'verified_approximate' as const,
        similarity: 0.9,
        spans: [{ start: 50, end: 80, page: 1, bboxes: [[0, 0, 100, 20] as [number, number, number, number]] }],
      },
    };

    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    expect(screen.getByText('Approx. match')).toBeTruthy();
    const showBtn = screen.getByRole('button', { name: /Show in document for Late Fee/i });
    expect(showBtn).toBeTruthy();

    fireEvent.click(showBtn);
    expect(onEvidenceClick).toHaveBeenCalledWith('kf-approx', 2);
  });

  it('renders "Multiple matches" badge and enables document navigation', () => {
    const onEvidenceClick = vi.fn();
    const evidenceMap = {
      'kf-multiple': {
        status: 'multiple_matches' as const,
        spans: [{ start: 100, end: 120, page: 1, bboxes: [[0, 0, 100, 20] as [number, number, number, number]] }],
      },
    };

    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    expect(screen.getByText('Multiple matches')).toBeTruthy();
    const showBtn = screen.getByRole('button', { name: /Show in document for Security Deposit/i });
    expect(showBtn).toBeTruthy();

    fireEvent.click(showBtn);
    expect(onEvidenceClick).toHaveBeenCalledWith('kf-multiple', 2);
  });

  it('renders "Not located in PDF" and DOES NOT provide document action for unverified facts', () => {
    const evidenceMap = {
      'kf-unverified': {
        status: 'unverified' as const,
        reason: 'No match found',
      },
    };

    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={vi.fn()}
      />
    );

    expect(screen.getAllByText('Evidence not located').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/evidence status:.*not located/i).length).toBeGreaterThan(0);
    // There must NOT be a document navigation button for this unverified item
    expect(screen.queryByRole('button', { name: /Show in document for Utility Proration/i })).toBeNull();
    // And must NOT have the old misleading "View source"
    expect(screen.queryByRole('button', { name: /Show source in document for Utility Proration/i })).toBeNull();
  });

  it('treats null/empty exact_quote as unverified with no misleading confirmation', () => {
    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={{}}
        onSwitchContext={vi.fn()}
        onEvidenceClick={vi.fn()}
      />
    );

    // No quote item should show not located and have no document action
    expect(screen.queryByRole('button', { name: /Show in document for Governing Law/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Show source in document for Governing Law/i })).toBeNull();
  });

  it('preserves existing AttentionItemCard evidence rendering', () => {
    const evidenceMap = {
      'ai-1': {
        status: 'verified' as const,
        spans: [{ start: 0, end: 30, page: 2, bboxes: [[0, 0, 50, 10] as [number, number, number, number]] }],
      },
    };

    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysis}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('attention-item-ai-1')).toBeTruthy();
    expect(screen.getByTestId('show-evidence-btn-ai-1')).toBeTruthy();
  });
});

describe('Demo Data Integrity — PDF Alignment', () => {
  it('critical regression: Base Rent Key Fact in Context A does not claim $4,500', () => {
    const baseRentFact = CONTEXT_A_DATA.key_facts.find(f => f.id === 'kf-1');
    expect(baseRentFact).toBeDefined();
    expect(baseRentFact!.value).not.toContain('4,500');
    expect(baseRentFact!.value).toContain('5,000');
    expect(baseRentFact!.exact_quote).not.toContain('4,500');
    expect(baseRentFact!.exact_quote).toContain('Five Thousand Dollars');
  });

  it('Context A Key Facts match actual page numbers in clean-lease.pdf', () => {
    const baseRentFact = CONTEXT_A_DATA.key_facts.find(f => f.id === 'kf-1');
    const latePenaltyFact = CONTEXT_A_DATA.key_facts.find(f => f.id === 'kf-2');

    expect(baseRentFact!.page_hint).toBe(2);
    expect(latePenaltyFact!.page_hint).toBe(2);
  });

  it('Context B Key Facts match actual page numbers in clean-lease.pdf', () => {
    const renewalFact = CONTEXT_B_DATA.key_facts.find(f => f.id === 'kf-1');
    const holdoverFact = CONTEXT_B_DATA.key_facts.find(f => f.id === 'kf-2');

    expect(renewalFact!.page_hint).toBe(7);
    expect(holdoverFact!.page_hint).toBe(2);
  });

  it('all demo Key Facts have non-empty exact_quote and page_hint', () => {
    for (const kf of [...CONTEXT_A_DATA.key_facts, ...CONTEXT_B_DATA.key_facts]) {
      expect(kf.exact_quote).toBeTruthy();
      expect(kf.exact_quote!.trim().length).toBeGreaterThan(0);
      expect(typeof kf.page_hint).toBe('number');
    }
  });

  it('every demo Key Fact quote matches the clean-lease text with Tier 1 exact match', () => {
    // Reconstruct the clean-lease text from generate-fixtures script to verify deterministically
    const fixtureScriptPath = path.resolve(__dirname, '../scripts/generate-fixtures.ts');
    const fixtureCode = fs.readFileSync(fixtureScriptPath, 'utf-8');

    for (const kf of [...CONTEXT_A_DATA.key_facts, ...CONTEXT_B_DATA.key_facts]) {
      const normalizedQuote = normalize(kf.exact_quote!);
      // The normalized quote must be present in the generateCleanLease function definition
      expect(
        normalize(fixtureCode).toLowerCase().includes(normalizedQuote.toLowerCase()),
        `Key Fact quote "${kf.exact_quote}" not found in clean-lease generator text`
      ).toBe(true);
    }
  });
});

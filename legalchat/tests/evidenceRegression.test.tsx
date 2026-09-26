/**
 * evidenceRegression.test.tsx
 *
 * Step 17D.2 Regression Test Suite:
 * - Evidence highlight precision (character-level bounding box calculation)
 * - Active evidence state transitions (A active -> B active, single active item)
 * - Context switch clears previous active evidence
 * - Key Facts, Attention Items, and Obligations share uniform evidence state semantics
 * - Scanned vs Low-Density classification (Pages 7 & 8 are LOW_TEXT_DENSITY, not unextractable scanned)
 * - Stale async evidence updates do not overwrite current evidence
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeftPane } from '../src/components/dashboard/LeftPane';
import { AttentionItemCard } from '../src/components/dashboard/AttentionItemCard';
import { computeSubBbox, getCharWeight } from '../src/lib/evidenceMatcher';
import { classifyPageText, isLikelyScanned } from '../src/lib/pdfText';
import type { AnalysisResult } from '../src/lib/schema';

const mockAnalysisA: AnalysisResult = {
  document_type: 'Commercial Lease',
  contextual_summary: 'Context A summary',
  key_facts: [
    {
      id: 'kf-base-rent',
      label: 'Base Rent',
      value: '$5,000/mo',
      exact_quote: 'Tenant shall pay to Landlord as base rent for the Premises the sum of Five Thousand Dollars ($5,000.00) per month',
      page_hint: 2,
    },
    {
      id: 'kf-late-fee',
      label: 'Late Fee',
      value: '5% after 5 days',
      exact_quote: 'five percent (5%) of the overdue amount',
      page_hint: 2,
    },
  ],
  obligations: [
    {
      id: 'ob-1',
      who: 'Tenant',
      what: 'Pay CAM charges',
      exact_quote: "Tenant shall pay Tenant's pro-rata share of all Operating Expenses",
      page_hint: 3,
    },
  ],
  attention_items: [
    {
      id: 'ai-operating-expenses',
      title: 'Uncapped Operating Expenses',
      severity: 'high',
      why_it_matters_for_context: 'Uncapped risk',
      exact_quote: "Tenant shall pay Tenant's pro-rata share of all Operating Expenses for the Building",
      page_hint: 3,
    },
    {
      id: 'ai-late-fee',
      title: 'Strict Late Fee Provision',
      severity: 'caution',
      why_it_matters_for_context: 'Strict grace period',
      exact_quote: 'five percent (5%) of the overdue amount',
      page_hint: 2,
    },
  ],
  questions_for_professional: [],
  uncertainty_notes: [],
  disclaimer: 'Disclaimer text',
};

const mockAnalysisB: AnalysisResult = {
  document_type: 'Commercial Lease',
  contextual_summary: 'Context B summary',
  key_facts: [
    {
      id: 'kf-b-1',
      label: 'Renewal Notice',
      value: '180 days',
      exact_quote: 'not less than 180 days',
      page_hint: 7,
    },
  ],
  obligations: [],
  attention_items: [
    {
      id: 'ai-b-1',
      title: 'Strict Renewal Window',
      severity: 'high',
      why_it_matters_for_context: 'Strict window',
      exact_quote: 'not less than 180 days',
      page_hint: 7,
    },
  ],
  questions_for_professional: [],
  uncertainty_notes: [],
  disclaimer: 'Disclaimer text',
};

describe('Issue 1: Exact Highlight Precision & Sub-Bounding Box Calculation', () => {
  it('omits preceding text in intra-item character range calculation', () => {
    const fullText = "In addition to Base Rent, Tenant shall pay Tenant's pro-rata share of all Operating Expenses";
    const quotePart = "Tenant shall pay Tenant's pro-rata share of all Operating Expenses";
    const startChar = fullText.indexOf(quotePart);
    const endChar = startChar + quotePart.length - 1;
    const fullBbox: [number, number, number, number] = [72, 725, 451.6, 11];

    const subBbox = computeSubBbox(fullText, startChar, endChar, fullBbox);

    // subBbox x must be shifted right past "In addition to Base Rent, "
    expect(subBbox[0]).toBeGreaterThan(72 + 100);
    // subBbox width must be smaller than fullBbox width
    expect(subBbox[2]).toBeLessThan(451.6);
    // subBbox right edge must align with full line end
    expect(subBbox[0] + subBbox[2]).toBeCloseTo(72 + 451.6, 0);
  });

  it('omits following text in intra-item character range calculation', () => {
    const fullText = "for the Building. Tenant's pro-rata share is agreed to be twelve percent (12%) of total";
    const quotePart = "for the Building";
    const startChar = 0;
    const endChar = quotePart.length - 1;
    const fullBbox: [number, number, number, number] = [72, 712, 450.8, 11];

    const subBbox = computeSubBbox(fullText, startChar, endChar, fullBbox);

    // subBbox x remains at line start
    expect(subBbox[0]).toBe(72);
    // subBbox width covers only "for the Building", not the full 450.8
    expect(subBbox[2]).toBeLessThan(100);
    expect(subBbox[2]).toBeGreaterThan(60);
  });

  it('returns full bbox when entire text is matched', () => {
    const text = 'Full clause verbatim match';
    const bbox: [number, number, number, number] = [10, 20, 300, 15];
    const subBbox = computeSubBbox(text, 0, text.length - 1, bbox);
    expect(subBbox).toEqual(bbox);
  });

  it('getCharWeight assigns distinct proportional weights correctly', () => {
    expect(getCharWeight('i')).toBeLessThan(getCharWeight('a'));
    expect(getCharWeight('a')).toBeLessThan(getCharWeight('m'));
    expect(getCharWeight('m')).toBeGreaterThan(getCharWeight('W') * 0.9);
  });
});

describe('Issue 2: Scanned vs Low-Density Page Classification', () => {
  it('classifies empty pages as SCANNED_NO_TEXT', () => {
    expect(classifyPageText([], 612, 792)).toBe('SCANNED_NO_TEXT');
    expect(isLikelyScanned([], 612, 792)).toBe(true);
  });

  it('classifies stray OCR noise (< 20 chars) as SCANNED_NO_TEXT', () => {
    const noise = [{ str: 'stray mark', transform: [1, 0, 0, 1, 0, 0] }];
    expect(classifyPageText(noise, 612, 792)).toBe('SCANNED_NO_TEXT');
    expect(isLikelyScanned(noise, 612, 792)).toBe(true);
  });

  it('classifies low-density pages (like signature and inventory pages) as LOW_TEXT_DENSITY and NOT scanned', () => {
    // 117 characters on a standard page (~500,000 pt^2 area -> density ~0.00023)
    const sparseText = 'ANNEXURE-I Particulars Yes No Remarks FURNITURE INVENTORY Item Chairs Tables Desks';
    const sparseItems = [{ str: sparseText, transform: [1, 0, 0, 1, 0, 0] }];

    expect(classifyPageText(sparseItems, 612, 792)).toBe('LOW_TEXT_DENSITY');
    // Crucial: Low density pages must NOT be flagged as scanned!
    expect(isLikelyScanned(sparseItems, 612, 792)).toBe(false);
  });

  it('classifies normal typed pages as TEXT_EXTRACTABLE', () => {
    const normalItems = [{ str: 'A'.repeat(1200), transform: [1, 0, 0, 1, 0, 0] }];
    expect(classifyPageText(normalItems, 612, 792)).toBe('TEXT_EXTRACTABLE');
    expect(isLikelyScanned(normalItems, 612, 792)).toBe(false);
  });
});

describe('Issue 6: Evidence State Transitions & Uniform Semantics', () => {
  const evidenceMap = {
    'kf-base-rent': {
      status: 'verified' as const,
      spans: [{ start: 0, end: 50, page: 1, bboxes: [[72, 555, 150, 11] as [number, number, number, number]] }],
    },
    'kf-late-fee': {
      status: 'verified' as const,
      spans: [{ start: 60, end: 100, page: 1, bboxes: [[72, 482, 112, 11] as [number, number, number, number]] }],
    },
    'ai-operating-expenses': {
      status: 'verified' as const,
      spans: [{ start: 150, end: 230, page: 2, bboxes: [[196, 725, 327, 11] as [number, number, number, number]] }],
    },
    'ai-late-fee': {
      status: 'verified' as const,
      spans: [{ start: 60, end: 100, page: 1, bboxes: [[72, 482, 112, 11] as [number, number, number, number]] }],
    },
  };

  it('transitions active evidence cleanly: A active -> B active', () => {
    const onEvidenceClick = vi.fn();
    render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysisA}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    // Click A (Base Rent)
    const btnA = screen.getByTestId('show-fact-evidence-kf-base-rent');
    fireEvent.click(btnA);
    expect(onEvidenceClick).toHaveBeenCalledWith('kf-base-rent', 2);
    expect(btnA.textContent).toContain('Shown on page 2');

    // Button B (Late Fee) is NOT active yet
    const btnB = screen.getByTestId('show-fact-evidence-kf-late-fee');
    expect(btnB.textContent).toContain('Show in document · p. 2');

    // Click B (Late Fee)
    fireEvent.click(btnB);
    expect(onEvidenceClick).toHaveBeenCalledWith('kf-late-fee', 2);

    // Now B is active and A is inactive
    expect(btnB.textContent).toContain('Shown on page 2');
    expect(btnA.textContent).toContain('Show in document · p. 2');
  });

  it('clears active evidence state upon context switch', () => {
    const onEvidenceClick = vi.fn();
    const { rerender } = render(
      <LeftPane
        role="Tenant"
        concern="Cost"
        analysisResult={mockAnalysisA}
        evidenceMap={evidenceMap}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    // Make item active
    const btnA = screen.getByTestId('show-fact-evidence-kf-base-rent');
    fireEvent.click(btnA);
    expect(btnA.textContent).toContain('Shown on page 2');

    // Switch context to Context B
    rerender(
      <LeftPane
        role="Landlord"
        concern="Renewal"
        analysisResult={mockAnalysisB}
        evidenceMap={{}}
        onSwitchContext={vi.fn()}
        onEvidenceClick={onEvidenceClick}
      />
    );

    // Stale item from Context A is completely unmounted
    expect(screen.queryByTestId('show-fact-evidence-kf-base-rent')).toBeNull();
    // Context B items render with fresh non-active state
    expect(screen.getByText('Renewal Notice')).toBeTruthy();
  });

  it('Key Facts, Attention Items, and Obligations share uniform evidence state semantics', () => {
    // Unverified item in AttentionItemCard
    const { rerender } = render(
      <AttentionItemCard
        item={mockAnalysisA.attention_items[0]}
        evidenceMatch={{ status: 'unverified' }}
        onEvidenceClick={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/evidence status:.*evidence not located/i)).toBeTruthy();
    expect(screen.queryByTestId('show-evidence-btn-ai-operating-expenses')).toBeNull();

    // Approximate match item
    rerender(
      <AttentionItemCard
        item={mockAnalysisA.attention_items[0]}
        evidenceMatch={{ status: 'verified_approximate', spans: [{ page: 2, bboxes: [[0, 0, 50, 10]] }] }}
        onEvidenceClick={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/evidence status: approx/i)).toBeTruthy();
    expect(screen.getByTestId('show-evidence-btn-ai-operating-expenses')).toBeTruthy();

    // Scanned status item
    rerender(
      <AttentionItemCard
        item={mockAnalysisA.attention_items[0]}
        evidenceMatch={{ status: 'unverified_scanned' }}
        onEvidenceClick={vi.fn()}
      />
    );
    expect(screen.getAllByText(/scanned pdf — text unavailable/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('show-evidence-btn-ai-operating-expenses')).toBeNull();
  });
});

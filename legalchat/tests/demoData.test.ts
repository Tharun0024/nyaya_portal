/**
 * demoData.test.ts
 *
 * Validates the structural integrity of both demo data payloads.
 * Tests that the data satisfies the Ajv-compiled schema.
 */

import { describe, it, expect } from 'vitest';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';
import { validateAndSanitize } from '../src/lib/schema';

describe('CONTEXT_A_DATA (Small Business Tenant)', () => {
  it('passes schema validation', () => {
    const result = validateAndSanitize(CONTEXT_A_DATA);
    expect(result.valid).toBe(true);
  });

  it('has a contextual_summary focused on tenant concerns', () => {
    expect(CONTEXT_A_DATA.contextual_summary.toLowerCase()).toContain('tenant');
  });

  it('has at least one key_fact with an exact_quote', () => {
    const withQuote = CONTEXT_A_DATA.key_facts.filter(f => f.exact_quote);
    expect(withQuote.length).toBeGreaterThan(0);
  });

  it('Base Rent Key Fact matches clean-lease.pdf ($5,000 on page 2)', () => {
    const baseRent = CONTEXT_A_DATA.key_facts.find(f => f.id === 'kf-1');
    expect(baseRent).toBeDefined();
    expect(baseRent!.value).toBe('$5,000 per month');
    expect(baseRent!.page_hint).toBe(2);
    expect(baseRent!.exact_quote).toContain('Five Thousand Dollars ($5,000.00)');
  });


  it('has at least one attention item with high severity', () => {
    const highItems = CONTEXT_A_DATA.attention_items.filter(i => i.severity === 'high');
    expect(highItems.length).toBeGreaterThan(0);
  });

  it('has a non-empty disclaimer', () => {
    expect(CONTEXT_A_DATA.disclaimer.length).toBeGreaterThan(10);
    // The disclaimer correctly says "does not provide legal advice" — this is the right framing
    expect(CONTEXT_A_DATA.disclaimer.toLowerCase()).toContain('does not');
    expect(CONTEXT_A_DATA.disclaimer.toLowerCase()).toContain('professional');
  });

  it('all obligations have who, what, and exact_quote', () => {
    for (const obl of CONTEXT_A_DATA.obligations) {
      expect(obl.who).toBeTruthy();
      expect(obl.what).toBeTruthy();
      expect(obl.exact_quote).toBeTruthy();
    }
  });
});

describe('CONTEXT_B_DATA (Landlord)', () => {
  it('passes schema validation', () => {
    const result = validateAndSanitize(CONTEXT_B_DATA);
    expect(result.valid).toBe(true);
  });

  it('has a contextual_summary focused on landlord concerns', () => {
    const summary = CONTEXT_B_DATA.contextual_summary.toLowerCase();
    expect(summary.includes('landlord') || summary.includes('renewal') || summary.includes('exit')).toBe(true);
  });

  it('has at least one key_fact about renewal or holdover', () => {
    const relevant = CONTEXT_B_DATA.key_facts.filter(f =>
      f.label.toLowerCase().includes('renewal') || f.label.toLowerCase().includes('holdover')
    );
    expect(relevant.length).toBeGreaterThan(0);
  });

  it('questions_for_professional are different from Context A', () => {
    expect(CONTEXT_B_DATA.questions_for_professional).not.toEqual(
      CONTEXT_A_DATA.questions_for_professional,
    );
  });
});

describe('Data integrity across both contexts', () => {
  it('both datasets have unique item IDs within themselves', () => {
    const checkUnique = (items: Array<{ id: string }>) => {
      const ids = items.map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    };

    checkUnique(CONTEXT_A_DATA.attention_items);
    checkUnique(CONTEXT_A_DATA.key_facts);
    checkUnique(CONTEXT_A_DATA.obligations);
    checkUnique(CONTEXT_B_DATA.attention_items);
    checkUnique(CONTEXT_B_DATA.key_facts);
    checkUnique(CONTEXT_B_DATA.obligations);
  });

  it('no attention item has an empty exact_quote', () => {
    for (const item of [...CONTEXT_A_DATA.attention_items, ...CONTEXT_B_DATA.attention_items]) {
      expect(item.exact_quote.trim().length).toBeGreaterThan(0);
    }
  });

  it('severity values are within the allowed set', () => {
    const ALLOWED = new Set(['info', 'caution', 'high']);
    for (const item of [...CONTEXT_A_DATA.attention_items, ...CONTEXT_B_DATA.attention_items]) {
      expect(ALLOWED.has(item.severity)).toBe(true);
    }
  });
});

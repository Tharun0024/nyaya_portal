/**
 * schema.test.ts
 *
 * Tests for the Ajv schema validator and stripExtraFields sanitizer.
 *
 * Tests cover:
 * - Valid complete objects → pass
 * - Missing required fields → fail
 * - Wrong field types → fail
 * - Invalid enum values → fail
 * - Extra fields → stripped by sanitizer
 * - evidence_status absence (must not appear in any valid result)
 * - Nested item validation
 */

import { describe, expect, it } from 'vitest';
import { validateAndSanitize } from '../src/lib/schema';
import type { AnalysisResult } from '../src/lib/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValid(): AnalysisResult {
  return {
    document_type: 'Commercial Lease Agreement',
    contextual_summary:
      'This commercial lease binds the tenant to monthly payments for 36 months. As a small business tenant focused on financial exposure, the key risk is the personal guarantee clause in section 8.',
    key_facts: [
      {
        id: 'kf-1',
        label: 'Monthly Rent',
        value: '$5,000',
        exact_quote: 'The Tenant shall pay Five Thousand Dollars ($5,000) per month',
        page_hint: 2,
      },
    ],
    obligations: [
      {
        id: 'ob-1',
        who: 'Tenant',
        what: 'Pay monthly rent by the 1st of each month',
        exact_quote: 'Tenant shall pay rent on the first day of each calendar month',
        page_hint: 2,
      },
    ],
    attention_items: [
      {
        id: 'ai-1',
        title: 'Personal Guarantee',
        why_it_matters_for_context:
          'As a small business tenant, you may be personally liable if the business cannot pay.',
        severity: 'high',
        exact_quote: 'The Guarantor shall be personally liable for all obligations of the Tenant',
        page_hint: 8,
      },
    ],
    questions_for_professional: [
      'Is the personal guarantee negotiable or limitable?',
      'What are the early termination penalties?',
    ],
    uncertainty_notes: ['The lease does not specify subletting rights.'],
    disclaimer:
      'This analysis is for informational purposes only and does not constitute legal advice. Consult a qualified legal professional before making decisions.',
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — happy path', () => {
  it('accepts a fully valid analysis result', () => {
    const result = validateAndSanitize(makeValid());
    expect(result.valid).toBe(true);
  });

  it('returns the data when valid', () => {
    const valid = makeValid();
    const result = validateAndSanitize(valid);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.document_type).toBe('Commercial Lease Agreement');
      expect(result.data.attention_items[0].severity).toBe('high');
    }
  });

  it('accepts null exact_quote on key_facts', () => {
    const valid = makeValid();
    valid.key_facts[0].exact_quote = null;
    const result = validateAndSanitize(valid);
    expect(result.valid).toBe(true);
  });

  it('accepts null page_hint on all item types', () => {
    const valid = makeValid();
    valid.key_facts[0].page_hint = null;
    valid.obligations[0].page_hint = null;
    valid.attention_items[0].page_hint = null;
    const result = validateAndSanitize(valid);
    expect(result.valid).toBe(true);
  });

  it('accepts empty arrays for key_facts, obligations, attention_items', () => {
    const valid = makeValid();
    valid.key_facts = [];
    valid.obligations = [];
    valid.attention_items = [];
    const result = validateAndSanitize(valid);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — missing required fields', () => {
  it('rejects object missing document_type', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (obj as any).document_type;
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects object missing contextual_summary', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (obj as any).contextual_summary;
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects obligation missing exact_quote', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (obj.obligations[0] as any).exact_quote;
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects attention_item missing severity', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (obj.attention_items[0] as any).severity;
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects object missing disclaimer', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (obj as any).disclaimer;
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wrong types
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — wrong types', () => {
  it('rejects non-object input', () => {
    expect(validateAndSanitize('string').valid).toBe(false);
    expect(validateAndSanitize(null).valid).toBe(false);
    expect(validateAndSanitize(42).valid).toBe(false);
    expect(validateAndSanitize(undefined).valid).toBe(false);
  });

  it('rejects document_type as number', () => {
    const obj = { ...makeValid(), document_type: 42 };
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects key_facts as non-array', () => {
    const obj = { ...makeValid(), key_facts: 'not an array' };
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('rejects page_hint as string', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj.attention_items[0] as any).page_hint = 'page 5';
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invalid enum values
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — enum validation', () => {
  it('rejects invalid severity value', () => {
    const obj = makeValid();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj.attention_items[0] as any).severity = 'critical';
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });

  it('accepts all valid severity values', () => {
    for (const sev of ['info', 'caution', 'high'] as const) {
      const obj = makeValid();
      obj.attention_items[0].severity = sev;
      expect(validateAndSanitize(obj).valid).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Extra fields / defense-in-depth
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — extra field stripping', () => {
  it('strips evidence_status if somehow present (must never appear in schema)', () => {
    // Ajv additionalProperties:false should reject this
    const obj = {
      ...makeValid(),
      evidence_status: 'verified', // must never be in model output
    };
    const result = validateAndSanitize(obj);
    // additionalProperties: false → rejected
    expect(result.valid).toBe(false);
  });

  it('strips arbitrary extra fields via additionalProperties: false', () => {
    const obj = {
      ...makeValid(),
      injection_payload: '<script>alert("xss")</script>',
      extra_field: 'should not pass through',
    };
    const result = validateAndSanitize(obj);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

describe('validateAndSanitize() — error messages', () => {
  it('returns human-readable errors on failure', () => {
    const result = validateAndSanitize({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(typeof result.errors[0]).toBe('string');
    }
  });
});

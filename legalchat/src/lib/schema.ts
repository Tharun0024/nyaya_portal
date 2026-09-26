/**
 * schema.ts
 *
 * Single source of truth for the model output schema.
 *
 * This JSON Schema is used in TWO places:
 * 1. Included in the NVIDIA NIM prompt as the requested JSON shape
 * 2. As the Ajv validator schema on the server (post-response validation)
 *
 * IMPORTANT: evidence_status is intentionally ABSENT from this schema.
 * It is computed by the evidence matcher, never by the model.
 *
 * Design rules:
 * - exact_quote and page_hint live INLINE on each item (no cross-referencing evidence array)
 * - every required field is genuinely required
 * - optional fields use { "type": ["string", "null"] } pattern
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

export const ANALYSIS_SCHEMA = {
  type: 'object',
  required: [
    'document_type',
    'contextual_summary',
    'key_facts',
    'obligations',
    'attention_items',
    'questions_for_professional',
    'uncertainty_notes',
    'disclaimer',
  ],
  additionalProperties: false,
  properties: {
    document_type: {
      type: 'string',
      minLength: 1,
      description: 'Document type inferred from content (e.g., Commercial Lease, Employment Contract)',
    },
    contextual_summary: {
      type: 'string',
      minLength: 10,
      description: '2-4 sentence summary framed for the selected role and concern',
    },
    key_facts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'value'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          label: { type: 'string', minLength: 1 },
          value: { type: 'string', minLength: 1 },
          exact_quote: { type: ['string', 'null'] },
          page_hint: { type: ['number', 'null'] },
        },
      },
    },
    obligations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'who', 'what', 'exact_quote'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          who: { type: 'string', minLength: 1 },
          what: { type: 'string', minLength: 1 },
          exact_quote: { type: 'string', minLength: 1 },
          page_hint: { type: ['number', 'null'] },
        },
      },
    },
    attention_items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'why_it_matters_for_context', 'severity', 'exact_quote'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          why_it_matters_for_context: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['info', 'caution', 'high'] },
          exact_quote: { type: 'string', minLength: 1 },
          page_hint: { type: ['number', 'null'] },
        },
      },
    },
    questions_for_professional: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
    },
    uncertainty_notes: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      description: 'Anything the document does not specify or is ambiguous about',
    },
    disclaimer: {
      type: 'string',
      minLength: 10,
      description: 'Legal disclaimer — must be non-dismissible in the UI',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// TypeScript types inferred from schema
// ---------------------------------------------------------------------------

export interface KeyFact {
  id: string;
  label: string;
  value: string;
  exact_quote: string | null;
  page_hint: number | null;
}

export interface Obligation {
  id: string;
  who: string;
  what: string;
  exact_quote: string;
  page_hint: number | null;
}

export interface AttentionItem {
  id: string;
  title: string;
  why_it_matters_for_context: string;
  severity: 'info' | 'caution' | 'high';
  exact_quote: string;
  page_hint: number | null;
}

export interface AnalysisResult {
  document_type: string;
  contextual_summary: string;
  key_facts: KeyFact[];
  obligations: Obligation[];
  attention_items: AttentionItem[];
  questions_for_professional: string[];
  uncertainty_notes: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Ajv validator
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export const validateAnalysisResult: ValidateFunction<AnalysisResult> =
  ajv.compile(ANALYSIS_SCHEMA) as ValidateFunction<AnalysisResult>;

/**
 * Strip any fields not present in the schema (defense-in-depth).
 * Call AFTER Ajv validation passes.
 */
export function stripExtraFields(obj: unknown): AnalysisResult {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Expected object');
  }

  const allowedTopLevel = new Set(Object.keys(ANALYSIS_SCHEMA.properties));
  const result: Record<string, unknown> = {};

  for (const key of allowedTopLevel) {
    if (key in (obj as Record<string, unknown>)) {
      result[key] = (obj as Record<string, unknown>)[key];
    }
  }

  return result as unknown as AnalysisResult;
}

/**
 * Validate and sanitize a raw model response object.
 * Returns { valid: true, data } or { valid: false, errors }.
 */
export function validateAndSanitize(raw: unknown):
  | { valid: true; data: AnalysisResult }
  | { valid: false; errors: string[] } {
  const isValid = validateAnalysisResult(raw);

  if (!isValid) {
    const errors = (validateAnalysisResult.errors ?? []).map(
      (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
    );
    return { valid: false, errors };
  }

  const data = stripExtraFields(raw);
  return { valid: true, data };
}

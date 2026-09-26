import { describe, it, expect } from 'vitest';
import type { ContextRunResult } from '../scripts/run-nim-validation.js';
import { computeContextDiff, analyzeSecurityResult, computeVerdict } from '../scripts/run-nim-validation.js';

describe('Validation Logic — Offline Deterministic Tests', () => {
  const mockFailedRun: ContextRunResult = {
    status: 'failed',
    run_id: 'fail-1',
    role: 'test',
    concern: 'test',
    fixture_name: 'test.pdf',
    fixture_sha256: 'abc',
    fixture_size_bytes: 100,
    timestamp_start: '',
    timestamp_end: '',
    latency_ms: 0,
    nim_model: '',
    sdk_version: '',
    node_version: '',
    schema_version: '',
    schema_valid: false,
    schema_errors: [],
    document_type: null,
    key_facts_count: 0,
    obligations_count: 0,
    attention_items_count: 0,
    questions_count: 0,
    uncertainty_notes_count: 0,
    total_evidence_claims: 0,
    evidence_records: [],
    verified_count: 0,
    approximate_count: 0,
    multiple_matches_count: 0,
    unverified_count: 0,
    verification_rate: 0,
    approximate_rate: 0,
    unverified_rate: 0,
    raw_analysis: null,
    error: 'API Error',
  };

  const mockSuccessRun: ContextRunResult = {
    ...mockFailedRun,
    status: 'success',
    schema_valid: true,
    error: null,
    raw_analysis: {
      contextual_summary: 'Success',
      attention_items: [{ title: 'Item 1' }]
    }
  };

  describe('computeContextDiff', () => {
    it('returns not_run status and safe defaults if either run failed (Context A failure)', () => {
      const diff = computeContextDiff(mockFailedRun, mockSuccessRun);
      expect(diff.status).toBe('not_run');
      expect(diff.differentiation_score).toBe(0);
      expect(diff.summary_different).toBe(false);
      // hashes match if both runs have the same fixture_sha256, even if one failed
      expect(diff.hashes_match).toBe(true);
      expect(diff.same_document_bytes).toBe(true);
    });

    it('returns not_run status if both runs failed (Both contexts unavailable)', () => {
      const diff = computeContextDiff(mockFailedRun, mockFailedRun);
      expect(diff.status).toBe('not_run');
      expect(diff.differentiation_score).toBe(0);
    });

    it('computes diff successfully when both runs succeed', () => {
      const diff = computeContextDiff(mockSuccessRun, { ...mockSuccessRun, raw_analysis: { contextual_summary: 'Different', attention_items: [{ title: 'Item 2' }] } });
      expect(diff.status).toBe('success');
      expect(diff.summary_different).toBe(true);
      expect(diff.differentiation_score).toBeGreaterThan(0);
    });
  });

  describe('analyzeSecurityResult', () => {
    it('returns not_run if the underlying API run failed', () => {
      const sec = analyzeSecurityResult('test.pdf', 'abc', mockFailedRun);
      expect(sec.status).toBe('not_run');
      expect(sec.passed).toBe(false);
      expect(sec.notes).toContain('not run');
    });

    it('computes correctly for successful run', () => {
      const sec = analyzeSecurityResult('test.pdf', 'abc', mockSuccessRun);
      expect(sec.status).toBe('success');
      expect(sec.passed).toBe(true);
    });
  });

  describe('computeVerdict', () => {
    it('returns BLOCKED_BY_CREDENTIALS if preflight failed (missing, empty, placeholder credentials)', () => {
      // Regardless of what runs exist, if preflight fails, it's blocked
      const result = computeVerdict([], null, null, true, null);
      expect(result.verdict).toBe('BLOCKED_BY_CREDENTIALS');
      expect(result.blockers).toContain('NVIDIA NIM configuration unavailable or invalid');
    });

    it('returns LIVE_NIM_BLOCKED if NVIDIA NIM preflight fails', () => {
      const result = computeVerdict([], null, null, false, {
        status: 'failed',
        model: 'nvidia/test-model',
        latency_ms: 100,
        error_classification: 'CREDENTIALS_INVALID',
        error_message: 'Invalid API key'
      });
      expect(result.verdict).toBe('LIVE_NIM_BLOCKED');
      expect(result.blockers.some((b) => b.includes('LIVE_NIM_BLOCKED'))).toBe(true);
    });

    it('returns BLOCK if schema validation fails on any successful-status API run', () => {
      const badRun = { ...mockSuccessRun, schema_valid: false };
      const result = computeVerdict([badRun], null, null, false, null);
      expect(result.verdict).toBe('BLOCK');
      expect(result.blockers.some((b) => b.includes('Schema validation failed'))).toBe(true);
    });

    it('returns RATE_LIMITED if any run was quota exhausted', () => {
      const rateLimitedRun = {
        ...mockFailedRun,
        error_classification: 'QUOTA_EXHAUSTED',
        retry_after: '15s',
      };
      const result = computeVerdict([rateLimitedRun], null, null, false, null);
      expect(result.verdict).toBe('RATE_LIMITED');
      expect(result.blockers.some((b) => b.includes('RATE_LIMITED'))).toBe(true);
      expect(result.rationale).toContain('Retry after 15s');
    });

    it('returns GO when runs succeed and security passes', () => {
      const result = computeVerdict([{ ...mockSuccessRun, verification_rate: 1.0 }], {
        status: 'success', fixture: '', fixture_sha256: '', schema_valid: true, schema_errors: [],
        evidence_status_in_output: false, injection_markers_in_output: false,
        system_prompt_disclosed: false, unauthorized_tool_use: false,
        output_structure_overridden: false, passed: true, notes: ''
      }, {
        status: 'success', fixture_sha256_a: '', fixture_sha256_b: '', document_sha256_a: '', document_sha256_b: '', hashes_match: true, same_document_bytes: true,
        role_a: '', role_b: '', concern_a: '', concern_b: '', summary_different: true,
        shared_attention_titles: [], unique_to_a: [], unique_to_b: [], shared_obligations_who: [],
        unique_obligations_a: [], unique_obligations_b: [], question_overlap_count: 0,
        question_unique_a: [], question_unique_b: [], differentiation_score: 1.0, notes: ''
      }, false, null);

      expect(result.verdict).toBe('GO');
    });
  });
});

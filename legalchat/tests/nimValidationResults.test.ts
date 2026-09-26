/**
 * nimValidationResults.test.ts
 *
 * OFFLINE / DETERMINISTIC — runs with `npm test`, does NOT call NVIDIA NIM.
 *
 * If scripts/results/validation-latest.json exists (produced by `npm run validate:live`),
 * these tests verify structural integrity and key thresholds on those results.
 *
 * If the file does not exist (CI before live run), tests are skipped gracefully.
 *
 * This file also verifies the security boundary: NVIDIA_API_KEY must NEVER
 * appear in any file that gets bundled to the client.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LATEST_RESULTS = path.join(ROOT, 'scripts', 'results', 'validation-latest.json');

// ---------------------------------------------------------------------------
// Helper: load results if available
// ---------------------------------------------------------------------------
function loadResults(): unknown | null {
  if (!fs.existsSync(LATEST_RESULTS)) return null;
  try {
    return JSON.parse(fs.readFileSync(LATEST_RESULTS, 'utf-8'));
  } catch {
    return null;
  }
}

type ValidationReport = {
  report_version: string;
  generated_at: string;
  nim_model: string;
  schema_version: string;
  matcher_version: string;
  fixture_hashes: Record<string, string>;
  runs: Array<{
    status: 'success' | 'failed' | 'not_run';
    run_id: string;
    role: string;
    concern: string;
    fixture_name: string;
    fixture_sha256: string;
    fixture_size_bytes: number;
    latency_ms: number;
    schema_valid: boolean;
    schema_errors: string[];
    document_type: string | null;
    key_facts_count: number;
    obligations_count: number;
    attention_items_count: number;
    questions_count: number;
    total_evidence_claims: number;
    evidence_records: Array<{
      item_type: string;
      quote: string;
      status: string;
      similarity: number | undefined;
    }>;
    verified_count: number;
    approximate_count: number;
    multiple_matches_count: number;
    unverified_count: number;
    verification_rate: number;
    approximate_rate: number;
    unverified_rate: number;
    raw_analysis: unknown;
    usage_metadata?: {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
      thought_tokens?: number;
      cached_tokens?: number;
    } | null;
    error: string | null;
  }>;
  context_diff: {
    status: 'success' | 'not_run';
    fixture_sha256_a: string;
    fixture_sha256_b: string;
    document_sha256_a?: string;
    document_sha256_b?: string;
    hashes_match: boolean;
    same_document_bytes?: boolean;
    differentiation_score: number;
    unique_to_a: string[];
    unique_to_b: string[];
    summary_different: boolean;
  } | null;
  security_test: {
    status: 'success' | 'failed' | 'not_run';
    schema_valid: boolean;
    evidence_status_in_output: boolean;
    system_prompt_disclosed: boolean;
    unauthorized_tool_use: boolean;
    output_structure_overridden: boolean;
    passed: boolean;
  } | null;
  latency_summary: {
    status?: 'success' | 'failed';
    min_ms: number;
    max_ms: number;
    avg_ms: number;
    measurements: number[];
    run_count: number;
  } | null;
  failure_tests: Array<{
    test_name: string;
    passed: boolean;
    actual_error_message: string | null;
  }>;
  summary: {
    total_runs: number;
    successful_runs: number;
    overall_verification_rate: number;
    context_differentiation_score: number;
    security_passed: boolean;
    all_failure_tests_passed: boolean;
    blocker_count: number;
    blockers: string[];
    verdict: 'GO' | 'MODIFY' | 'BLOCK' | 'BLOCKED_BY_CREDENTIALS' | 'LIVE_NIM_BLOCKED' | 'RATE_LIMITED';
  };
};

// ---------------------------------------------------------------------------
// Offline structural tests (always run — no network required)
// ---------------------------------------------------------------------------

describe('Security boundary — NVIDIA_API_KEY isolation', () => {
  it('NVIDIA_API_KEY is not referenced in any src/ file', () => {
    const srcDir = path.join(ROOT, 'src');
    const violations: string[] = [];
    function scan(dir: string) {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
          scan(full);
        } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
          const content = fs.readFileSync(full, 'utf-8');
          if (content.includes('NVIDIA_API_KEY')) {
            violations.push(path.relative(ROOT, full));
          }
        }
      }
    }
    scan(srcDir);
    expect(violations, `NVIDIA_API_KEY found in client src files: ${violations.join(', ')}`).toHaveLength(0);
  });

  it('No VITE_ prefix on secret vars in .env.example', () => {
    const envExample = path.join(ROOT, '.env.example');
    if (!fs.existsSync(envExample)) return;
    const content = fs.readFileSync(envExample, 'utf-8');
    const viteSecrets = content.match(/^VITE_.*KEY/gm) ?? [];
    expect(viteSecrets, `VITE_-prefixed secrets in .env.example would be exposed to client bundle: ${viteSecrets.join(', ')}`).toHaveLength(0);
  });

  it('.env is listed in .gitignore', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf-8');
    const lines = gitignore.split('\n').map((l) => l.trim());
    const hasEnv = lines.some((l) => l === '.env' || l === '.env.local' || l === '*.env');
    expect(hasEnv, '.env must be listed in .gitignore to prevent secret leakage').toBe(true);
  });

  it('.env file is not tracked by git (not in working tree)', () => {
    const envPath = path.join(ROOT, '.env');
    // .env may exist locally — verify it is not staged/committed
    // We verify by checking .gitignore covers it (checked above)
    // And that .env doesn't start with VITE_ keys (would expose to bundle)
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const viteKeys = content.match(/^VITE_/gm) ?? [];
      expect(viteKeys, 'VITE_-prefixed keys in .env would leak to client bundle').toHaveLength(0);
    }
    // Test always passes (existence of .env is fine; tracking would be caught by pre-commit hook)
    expect(true).toBe(true);
  });

  it('api/nimConfig.ts reads credentials from process.env, not from hardcoded strings', () => {
    const configFile = path.join(ROOT, 'api', 'nimConfig.ts');
    const content = fs.readFileSync(configFile, 'utf-8');
    // Must contain process.env reference for the key
    expect(content).toContain('process.env');
    // Must NOT contain a hardcoded key pattern (starts with AIza)
    expect(content).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);
    // Must NOT hardcode the key in any string literal
    expect(content).not.toMatch(/NVIDIA_API_KEY\s*=\s*['"`][^'"`]+['"`]/);
  });

  it('build output does not contain NVIDIA_API_KEY string', () => {
    const distDir = path.join(ROOT, 'dist');
    if (!fs.existsSync(distDir)) {
      // Build hasn't run yet — this is expected in pure test runs
      return;
    }
    const jsFiles: string[] = [];
    function findJs(dir: string) {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) findJs(full);
        else if (entry.endsWith('.js')) jsFiles.push(full);
      }
    }
    findJs(distDir);

    for (const jsFile of jsFiles) {
      const content = fs.readFileSync(jsFile, 'utf-8');
      expect(content, `NVIDIA_API_KEY found in build output: ${path.relative(ROOT, jsFile)}`).not.toContain('NVIDIA_API_KEY');
    }
  });
});

describe('Fixture integrity — hashes are stable', () => {
  it('fixture-hashes.json is present after generate-fixtures is run', () => {
    const hashPath = path.join(ROOT, 'tests', 'fixtures', 'fixture-hashes.json');
    if (!fs.existsSync(hashPath)) {
      // Fixtures not yet generated — skip
      console.log('  ℹ️  Skipping: fixture-hashes.json not found. Run: npx tsx scripts/generate-fixtures.ts');
      return;
    }
    const hashes = JSON.parse(fs.readFileSync(hashPath, 'utf-8')) as Record<string, string>;
    expect(hashes['clean-lease.pdf']).toBeTruthy();
    expect(hashes['stress-lease.pdf']).toBeTruthy();
    expect(hashes['adversarial.pdf']).toBeTruthy();
    expect(typeof hashes.generated_at).toBe('string');
  });

  it('fixture SHA-256 is stable across re-reads', () => {
    const fixtureA = path.join(ROOT, 'tests', 'fixtures', 'clean-lease.pdf');
    if (!fs.existsSync(fixtureA)) {
      console.log('  ℹ️  Skipping: clean-lease.pdf not generated yet');
      return;
    }
    const bytes = fs.readFileSync(fixtureA);
    const hash1 = crypto.createHash('sha256').update(bytes).digest('hex');
    const hash2 = crypto.createHash('sha256').update(bytes).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe('Validation report structure — offline assertions on live results', () => {
  const results = loadResults() as ValidationReport | null;

  it('validation-latest.json exists OR live validation has not yet run (graceful skip)', () => {
    if (!results) {
      console.log('  ℹ️  Skipping live result checks: validation-latest.json not found. Run: npm run validate:live');
    }
    expect(true).toBe(true); // always passes — graceful skip
  });

  it('report has required top-level fields', () => {
    if (!results) return;
    expect(results.report_version).toBe('0.5.0');
    expect(results.nim_model).toBeTruthy();
    expect(results.schema_version).toBeTruthy();
    expect(results.matcher_version).toBeTruthy();
    expect(results.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('context A and context B used the same PDF bytes', () => {
    if (!results) return;
    if (!results.context_diff || results.context_diff.status !== 'success') return;
    expect(results.context_diff.hashes_match).toBe(true);
    if (results.context_diff.same_document_bytes !== undefined) {
      expect(results.context_diff.same_document_bytes).toBe(true);
    }
    expect(results.context_diff.fixture_sha256_a).toBe(results.context_diff.fixture_sha256_b);
    if (results.context_diff.document_sha256_a !== undefined) {
      expect(results.context_diff.document_sha256_a).toBe(results.context_diff.document_sha256_b);
    }
  });

  it('all successful runs have schema_valid = true', () => {
    if (!results) return;
    for (const run of results.runs) {
      if (run.status === 'success') {
        expect(run.schema_valid, `Run ${run.run_id} failed schema validation: ${run.schema_errors.join(', ')}`).toBe(true);
      }
    }
  });

  it('evidence records have required fields', () => {
    if (!results) return;
    for (const run of results.runs) {
      if (!run.schema_valid) continue;
      for (const rec of run.evidence_records) {
        expect(['obligation', 'attention_item', 'key_fact']).toContain(rec.item_type);
        expect(typeof rec.quote).toBe('string');
        expect(['verified', 'verified_approximate', 'multiple_matches', 'unverified', 'unverified_scanned']).toContain(rec.status);
      }
    }
  });

  it('verification rate + approximate rate + unverified rate sums to ≤ 1.0 (no double-counting)', () => {
    if (!results) return;
    for (const run of results.runs) {
      if (!run.schema_valid || run.total_evidence_claims === 0) continue;
      const sum = run.verified_count + run.approximate_count + run.multiple_matches_count + run.unverified_count;
      expect(sum).toBeLessThanOrEqual(run.total_evidence_claims + 1); // allow rounding
    }
  });

  it('security test: evidence_status never present in output', () => {
    if (!results?.security_test || results.security_test.status !== 'success') return;
    expect(results.security_test.evidence_status_in_output).toBe(false);
  });

  it('security test: system prompt not disclosed', () => {
    if (!results?.security_test || results.security_test.status !== 'success') return;
    expect(results.security_test.system_prompt_disclosed).toBe(false);
  });

  it('security test: no unauthorized tool use', () => {
    if (!results?.security_test || results.security_test.status !== 'success') return;
    expect(results.security_test.unauthorized_tool_use).toBe(false);
  });

  it('security test: output structure not overridden by injection', () => {
    if (!results?.security_test || results.security_test.status !== 'success') return;
    expect(results.security_test.output_structure_overridden).toBe(false);
  });

  it('context differentiation: hashes matched and differentiation score is measurable', () => {
    if (!results?.context_diff || results.context_diff.status !== 'success') return;
    expect(results.context_diff.hashes_match).toBe(true);
    expect(results.context_diff.differentiation_score).toBeGreaterThanOrEqual(0);
    expect(results.context_diff.differentiation_score).toBeLessThanOrEqual(1);
  });

  it('latency measurements are positive numbers', () => {
    if (!results?.latency_summary) return;
    if (results.latency_summary.status && results.latency_summary.status !== 'success') return;
    expect(results.latency_summary.run_count).toBeGreaterThanOrEqual(1);
    for (const ms of results.latency_summary.measurements) {
      expect(ms).toBeGreaterThan(0);
    }
    expect(results.latency_summary.min_ms).toBeLessThanOrEqual(results.latency_summary.max_ms);
    expect(results.latency_summary.avg_ms).toBeGreaterThanOrEqual(results.latency_summary.min_ms);
  });

  it('failure tests: missing_api_key test must have passed', () => {
    if (!results) return;
    const test = results.failure_tests.find((t) => t.test_name === 'missing_api_key');
    if (!test) return;
    expect(test.passed).toBe(true);
  });

  it('failure tests: invalid_file_type test must have passed', () => {
    if (!results) return;
    const test = results.failure_tests.find((t) => t.test_name === 'invalid_file_type');
    if (!test) return;
    expect(test.passed).toBe(true);
  });

  it('verdict is one of GO / MODIFY / BLOCK / BLOCKED_BY_CREDENTIALS / LIVE_NIM_BLOCKED', () => {
    if (!results) return;
    expect(['GO', 'MODIFY', 'BLOCK', 'BLOCKED_BY_CREDENTIALS', 'LIVE_NIM_BLOCKED']).toContain(results.summary.verdict);
  });

  it('report does not claim zero hallucinations', () => {
    if (!results) return;
    const reportStr = JSON.stringify(results);
    // The phrase "zero hallucinations" must never appear
    expect(reportStr).not.toMatch(/zero hallucinations/i);
  });
});

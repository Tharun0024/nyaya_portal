# ADR-0004: Tiered Evidence Matcher with Configurable Thresholds

## Status

Accepted

## Date

2026-09-15

## Context

We need to match AI-generated `exact_quote` strings against PDF-extracted text reliably. The PDF extraction process introduces normalization artifacts (whitespace, line breaks, Unicode variants, ligatures, curly quotes, hyphenated line wraps). Strict string matching will fail on valid quotes; loose matching risks false "verified" labels — the one failure mode we cannot afford.

## Decision Drivers

- **False "verified" is catastrophic** — users may rely on evidence status when making legal decisions
- **False "unverified" is merely unfortunate** — the honest fallback is always available
- **Thresholds must be experimentally tunable** — we cannot choose fuzzy thresholds without testing against real-world PDFs
- **Verification must be deterministic** — same input must always produce same result
- **Repeated clauses must surface ambiguity honestly** — not silently pick the wrong occurrence

## Considered Options

### Option 1: Exact string match only
- **Rejected**: Fails on virtually any real PDF due to whitespace and Unicode normalization differences

### Option 2: Fuzzy match only
- **Rejected**: No principled threshold without empirical validation; "verified" label on a 70%-similar match is dishonest

### Option 3: Tiered approach, cheapest-first, configurable thresholds (chosen)
- Deterministic tiers first (exact → flexible whitespace)
- Fuzzy only as last resort before "unverified"
- All thresholds externalized as configurable constants
- Result is one of: `verified` | `verified_approximate` | `multiple_matches` | `unverified` | `unverified_scanned`

## Decision

**Five-tier cascading matcher with all thresholds in a `MatcherConfig` object.**

| Tier | Method | Result on success |
|------|--------|------------------|
| 1 | Exact normalized substring, single hit | `verified` |
| 2 | Exact normalized, multiple hits | `verified` (page_hint disambiguates) or `multiple_matches` |
| 3 | Token-boundary regex (flexible `\s+`) | `verified` |
| 4 | Sliding-window fuzzy (token similarity, configurable threshold) | `verified_approximate` |
| 5 | No match | `unverified` |

Scanned pages (detected by low character density) → `unverified_scanned` at any tier.

## Rationale

Starting with deterministic tiers means the common case (well-formed PDF, clean quote) resolves cheaply. Fuzzy matching is a fallback, not the default. Configurable thresholds allow empirical tuning after testing against real contract PDFs without code changes.

## Consequences

### Positive
- False "verified" rate controlled by tier hierarchy and threshold
- `unverified` is always an honest fallback, never hidden
- Thresholds tunable via config without code changes

### Negative
- Fuzzy tier requires a similarity library (or simple implementation)
- Threshold tuning requires a test corpus of real PDFs

### Risks
- **Tier 4 threshold must be validated experimentally against 10–15 real contract PDFs before commit to production values.** Initial defaults are conservative (similarity ≥ 0.85, margin ≥ 0.10) and must be measured, not guessed.

## Implementation Notes

```typescript
// All thresholds configurable — do NOT hardcode in matching logic
export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  fuzzyMinSimilarity: 0.85,      // tune after real PDF testing
  fuzzyMinMargin: 0.10,          // second-best must be this far below best
  fuzzyWindowPadding: 0.20,      // search window size = quote length ± 20%
  headerFooterPageThreshold: 0.5, // line appearing in >50% of pages = boilerplate
};
```

## Related ADRs

- ADR-0003: Dual Pipeline (this is Pipeline B's core algorithm)
- ADR-0005: Schema Validation (this ADR's output feeds evidence_status computation)

# ADR-0003: Independent Analysis and Evidence Pipelines

## Status

Accepted

## Context

Nyaya_Portal needs contextual analysis of a legal PDF and a separate check that model-provided quotes occur in the source. These tasks have different requirements: multimodal model analysis is probabilistic, while quote matching must be deterministic and inspectable.

## Decision

Use two independent pipelines:

- Pipeline A (server): validate PDF bytes, rasterize pages to JPEG with PDF.js, send inline images and context to NVIDIA NIM, parse JSON-mode output, validate with Ajv, repair once, then fail closed.
- Pipeline B (browser): extract text from the original local PDF with PDF.js, normalize it, build a reverse index, tier-match model-provided `exact_quote` values, and compute evidence status and highlight boxes.

Only the quote and page hint from validated analysis are consumed by the matcher. `evidence_status` is never a model field. Pipeline B performs no network requests.

## Consequences

### Positive

- The model cannot certify its own evidence.
- Evidence status is reproducible for a fixed PDF and quote.
- The original PDF text layer provides page and bounding-box locations for UI highlights.
- The pipelines can be tested independently.

### Tradeoffs

- Live analysis sends rendered page images to the configured NIM endpoint; the application does not control provider-side retention.
- Scanned PDFs may have no extractable text for evidence matching even though the vision model can read their images.
- JSON mode is not schema-constrained generation; Ajv validation and fail-closed behavior are required.
- Rendering pages increases request size and latency, so upper-bound page/request limits require validation against the deployed endpoint.

## Related ADRs

- ADR-0002: No Database — Stateless Ephemeral Architecture
- ADR-0004: Tiered Evidence Matcher with Configurable Thresholds
- ADR-0005: Schema-First Validation with Ajv

# ADR-0005: Schema-First Validation with Ajv

## Status

Accepted

## Context

NVIDIA NIM's selected model supports JSON output mode, but its model card does not list schema-constrained structured output. Model output must therefore be treated as untrusted and validated at runtime before reaching the frontend.

## Decision

Keep one JSON Schema in `src/lib/schema.ts`. Include the schema in the server-side prompt, request JSON mode from NIM, parse the response, and validate it with Ajv in the API route. On validation failure, make one repair attempt with the same document images and the Ajv errors. If validation fails again, return a safe error and do not return the model payload.

`evidence_status` remains absent from the schema and is computed client-side. `additionalProperties: false` is retained for all schema objects.

## Consequences

### Positive

- Ajv is authoritative even if JSON mode or prompt instructions are not followed.
- Invalid output does not reach the UI.
- Evidence status cannot be self-certified by the model.

### Tradeoffs

- The schema in the prompt is guidance, not generation-time enforcement.
- Repair adds a second remote request and may increase latency.
- Schema validity does not establish legal accuracy or factual grounding; evidence matching remains a separate check.

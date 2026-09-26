# ADR-0002: No Database — Stateless Ephemeral Architecture

## Status

Accepted

## Date

2026-09-15

## Context

Legal documents may contain highly sensitive information (personal details, business terms, financial obligations). We need a persistence strategy.

## Decision Drivers

- **Privacy by design** — uploaded documents must never be stored server-side; data must not cross session boundaries
- **No unnecessary infrastructure** — explicit hackathon constraint
- **Security surface reduction** — every persistence layer is an attack surface and a data-breach risk
- **Submission constraint** — single deployed URL, no separate database host
- **Simplicity** — no migration, backup, or schema management overhead

## Considered Options

### Option 1: No database (chosen)
- Analysis result lives in React state for the session duration only
- Nothing written to disk or DB on the server
- Privacy claim is structurally true, not just a policy

### Option 2: Ephemeral server-side session store (e.g., Redis TTL)
- Temporary storage with short TTL
- **Rejected**: still a data store that can fail, be misconfigured, or leak across sessions; adds infrastructure complexity

### Option 3: Persistent database (PostgreSQL, Firebase, etc.)
- **Rejected**: violates privacy constraints, adds significant infrastructure, out of scope

## Decision

**No database.** All state is ephemeral:
- Uploaded PDF lives in browser memory only (File object)
- Analysis result lives in React Context/state for session duration
- Server function is stateless: no writes, no reads from any store
- `previous_interaction_id` is never reused across requests

## Rationale

A stateless architecture makes the privacy guarantee structural rather than policy-based. There is nothing to leak because nothing is kept. This is also the simplest possible persistence model and directly eliminates an entire attack surface category.

## Consequences

### Positive
- No database to configure, secure, or pay for
- Privacy guarantee is structural (auditable)
- Zero data-breach risk for document content
- Simpler deployment

### Negative
- Users cannot resume a previous session
- No analytics on usage patterns
- If the NVIDIA NIM call fails, user must re-upload and re-run

### Risks
- Serverless platform logs may capture request metadata — mitigated by: log metadata only (file size, page count, latency, status code, request ID), never log document content or model output

## Related ADRs

- ADR-0003: Dual Pipeline (depends on this stateless model)

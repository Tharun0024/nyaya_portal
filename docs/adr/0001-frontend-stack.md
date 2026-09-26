# ADR-0001: Frontend Stack — Vite + React + TypeScript

## Status

Accepted

## Date

2026-09-15

## Context

We need a frontend stack for a single-page application that:
- Has no backend rendering requirement (single-session tool, SSR adds complexity for zero gain)
- Requires TypeScript for type safety across the schema validation and evidence-matching layers
- Needs fast iteration during a hackathon timeline
- Must produce a small, deployable static bundle (Vercel, Netlify, or similar)
- Must support PDF.js integration and a Web Worker for the PDF.js rendering thread

## Decision Drivers

- **TypeScript required** — the schema, matcher, and PDF index have non-trivial type contracts; runtime errors here are product-level failures
- **No SSR needed** — single-session, no SEO requirements
- **Fast HMR** — hackathon iteration speed
- **Minimal config** — avoid webpack configuration overhead
- **Team familiarity** — React component model is well-understood

## Considered Options

### Option 1: Vite + React + TypeScript (chosen)
- **Pros**: Sub-second HMR, minimal config, native ES modules, excellent TypeScript support, small bundle, trivial static deployment
- **Cons**: None material for this scope

### Option 2: Next.js + React + TypeScript
- **Pros**: SSR/ISR if needed in future, API routes built-in
- **Cons**: SSR complexity for no gain (no SEO requirement), heavier dev server, serverless function model less clean

### Option 3: Svelte / SvelteKit
- **Pros**: Smaller bundle, simpler reactivity
- **Cons**: Smaller ecosystem for PDF.js integration patterns; less team familiarity

## Decision

**Vite + React + TypeScript.**

State management: local component state + one top-level `AnalysisContext` via React Context. No Redux/Zustand unless a real need emerges during development.

## Rationale

Vite produces the fastest iteration loop. React + TypeScript supports PDF.js (typed bindings, worker patterns), Ajv (typed schema), and the NVIDIA NIM HTTP API. No SSR needed means no Next.js overhead.

## Consequences

### Positive
- Fast HMR and build iteration
- TypeScript catches schema/matcher type errors at compile time
- Trivial deployment as a static bundle

### Negative
- If comparison mode requires heavy server-side computation later, API routes need to be on a separate platform (mitigated: Vercel handles both static and serverless)

### Risks
- None material at this scope

## Related ADRs

- ADR-0003: Dual Pipeline (defines what the frontend must support)

# Nyaya_Portal Architecture

**AI for Legal Assistance & Access**

## System Shape

Nyaya_Portal is a static Vite/React/TypeScript SPA plus one stateless Vercel serverless function. It has no database, authentication system, or persistent session store.

```text
Browser
  ├─ Select a PDF and a role/concern lens
  ├─ POST /api/analyze with PDF base64 and context
  │    └─ Validate bytes, render pages using PDF.js, call NVIDIA NIM
  │         └─ Parse JSON, validate/sanitize with Ajv, repair once, fail closed
  └─ Independently extract local PDF text and verify returned quotes
       └─ Render findings and PDF page highlights
```

## Pipeline A: NIM Analysis

The browser sends a PDF (maximum 3 MB) to `/api/analyze`. The function checks the decoded size and `%PDF-` signature, requires server-side `NVIDIA_API_KEY`, `NIM_BASE_URL`, and `NIM_MODEL` settings, and parses the document with PDF.js. Documents above 200 pages are rejected. Each page is rendered to a bounded JPEG image and included as an inline `image_url` item in an OpenAI-compatible `/chat/completions` request.

The selected Nemotron Omni model accepts images and JSON output mode but does not provide schema-constrained structured output. The prompt includes the application JSON Schema; the model request uses JSON mode; neither is treated as validation. [Ajv validation](../src/lib/schema.ts) remains authoritative. The server parses and validates output, attempts one repair request on schema errors, and fails closed if the result remains invalid. Injection markers are checked after validation. Requests are non-streaming.

The NIM API key is only read by server code in [nimConfig.ts](../api/nimConfig.ts). Do not move it into `src/` or expose it through `VITE_*` variables.

## Pipeline B: Independent Evidence Verification

The browser separately loads the original `File` with PDF.js. [pdfText.ts](../src/lib/pdfText.ts) extracts per-page text, normalizes Unicode and whitespace, detects repeated header/footer text and low-text pages, and builds a character-to-text-item reverse index with page and bounding-box metadata. [evidenceMatcher.ts](../src/lib/evidenceMatcher.ts) checks model-provided `exact_quote` values using exact, flexible, and fuzzy tiers, then returns verified, approximate, multiple-match, or unverified status. The model never supplies `evidence_status`.

This stage performs no network calls and never sends extracted text to the server. It is deterministic for fixed document/index and quote inputs; that does not guarantee the fuzzy thresholds are calibrated for real contracts. See [RISKS.md](RISKS.md).

## State and Privacy Boundaries

- Uploaded PDFs and analysis results live in browser memory during the session.
- The route writes no database or file storage. Server processing uses transient request memory.
- The browser sends the PDF to the server for analysis; the server sends rendered page images to the configured NVIDIA NIM service.
- The app does not control provider-side logging or retention. Review the configured service terms before using sensitive documents.
- React state and in-memory `WeakMap` caches are used; no browser storage or cookies are used.

## Main Modules

- [App.tsx](../src/App.tsx): stage flow, context state, provider choice, analysis cache.
- [api/analyze.ts](../api/analyze.ts): request validation, prompt, Ajv validation, repair, and response.
- [api/nimProvider.ts](../api/nimProvider.ts): PDF rasterization and NIM chat-completions transport.
- [api/nimConfig.ts](../api/nimConfig.ts): server-only provider settings and page/request limits.
- [schema.ts](../src/lib/schema.ts): JSON Schema, TypeScript result contract, Ajv validation.
- [pdfText.ts](../src/lib/pdfText.ts), [evidenceMatcher.ts](../src/lib/evidenceMatcher.ts), [useEvidence.ts](../src/hooks/useEvidence.ts): local extraction, verification, and cache.
- [DemoProvider.ts](../src/lib/providers/DemoProvider.ts): offline prepared demo data.

## Deployment

[Vercel configuration](../vercel.json) maps `api/*.ts` to serverless functions and rewrites other routes to the SPA. The Vite development command does not start a local serverless runtime; use the deployment runtime for live route testing. The function is configured for 60 seconds, while the browser request timeout is 45 seconds and each provider request has an 18-second timeout.

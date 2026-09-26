# Nyaya_Portal Technical Risks

## NIM Image and Request Limits

**Risk:** The selected NIM endpoint accepts image inputs, not raw PDFs. The server rasterizes every page and sends them in one request. A 3 MB PDF can expand substantially as images; the provider's maximum image count and total request size are not enforced by this application.

**Mitigation:** Server-side PDF signature/size checks, a 200-page cap, bounded render dimensions, JPEG compression, and an 18-second provider timeout are implemented. Validate upper-bound page counts and request sizes against the deployed endpoint before production.

## Structured Output Compatibility

**Risk:** The selected model supports JSON output mode but not schema-constrained structured output. The model may still omit fields or return invalid types.

**Mitigation:** The exact schema is included in the prompt; output is parsed and validated by Ajv, one repair request is attempted, and remaining invalid output fails closed. JSON mode is not treated as schema enforcement.

## Document and Provider Privacy

**Risk:** Live analysis transmits rendered document pages to the configured NVIDIA NIM service. Application memory is ephemeral, but provider-side retention and logging are governed by the selected service and account terms.

**Mitigation:** No database or application-side file persistence, no document content in app logs, server-only key handling, and `store`-free stateless requests where supported by the endpoint. Confirm provider retention and compliance terms before sending sensitive legal documents.

## Evidence Matcher Calibration

**Risk:** Fuzzy matching defaults (`0.85` similarity and `0.10` best/second-best margin) are deterministic but not calibrated against a representative real-document corpus. Rasterized NIM vision reading can differ from the client PDF text layer.

**Mitigation:** Keep approximate matches distinct from exact verification and retain an honest unverified state. Test against real, consented contracts and scanned/low-density PDFs before relying on thresholds.

## Latency and Page Rendering

**Risk:** PDF.js rasterization plus remote multimodal inference may exceed the 45-second browser timeout, especially for large or complex PDFs. A repair attempt can add another provider request.

**Mitigation:** 18-second per-call abort timeout, 60-second Vercel function limit, bounded raster resolution, and fail-closed handling. Measure end-to-end latency with representative documents; the 200-page cap is not a promise that a document at that limit fits provider constraints.

## Prompt Injection and Model Reliability

**Risk:** PDF content may contain instruction-like text; model output can still be inaccurate or hallucinated despite prompt controls and JSON mode.

**Mitigation:** Keep document images separate from the system instruction, label document content as untrusted, request verbatim quotes and uncertainty notes, validate against Ajv, scan for known injection markers, render strings through React escaping, and verify quotes independently against the local text layer. These controls reduce risk but do not prove legal correctness.

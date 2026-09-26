# NVIDIA NIM Validation

Live validation is an explicit, networked operation over synthetic fixtures. It is not run by `npm test` and the script exits without an API request unless `--live` is supplied.

Configure `NVIDIA_API_KEY`, `NIM_BASE_URL`, and `NIM_MODEL` in the server environment. No credential is hardcoded or printed. The selected endpoint should be `https://integrate.api.nvidia.com/v1` with model `nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-NVFP4` unless deployment configuration intentionally selects another supported model.

Commands:

```bash
npm run validate:live
npm run validate:smoke
```

The full validation checks contextual differentiation, schema results, evidence matches, prompt-injection fixture behavior, latency, and deterministic failure cases. Smoke mode limits provider requests. Results are written under `scripts/results/`; they include raw model analysis and should only be generated from synthetic fixtures. Do not put real legal documents in the validation fixtures.

The selected model accepts image inputs, not raw PDFs. The validation runner renders PDF pages to JPEG using PDF.js and sends inline images through the NIM chat-completions API. It requests JSON mode, not JSON Schema-constrained output; the existing Ajv validator remains authoritative.

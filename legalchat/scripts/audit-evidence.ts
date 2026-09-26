import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { extractDocumentIndex } from '../src/lib/pdfText';
import { matchEvidence } from '../src/lib/evidenceMatcher';
import { CONTEXT_A_DATA, CONTEXT_B_DATA } from '../src/lib/providers/demoData';

async function main() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const pdfPath = path.resolve('public/demo/clean-lease.pdf');
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;

  const docIndex = await extractDocumentIndex(pdf);

  printTable(docIndex);
}

function printTable(docIndex: any) {
  console.log('ID | TYPE | TITLE/LABEL | PAGE_HINT | STATUS | TIER | SIMILARITY | MATCHED_PAGE | SPANS');
  console.log('-'.repeat(95));
  const items = [
    // Context A
    ...CONTEXT_A_DATA.key_facts.map((k: any) => ({ ...k, context: 'Tenant', type: 'Key Fact', label: k.label })),
    ...CONTEXT_A_DATA.attention_items.map((a: any) => ({ ...a, context: 'Tenant', type: 'Attention Item', label: a.title })),
    ...CONTEXT_A_DATA.obligations.map((o: any) => ({ ...o, context: 'Tenant', type: 'Obligation', label: `${o.who}: ${o.what}` })),
    // Context B
    ...CONTEXT_B_DATA.key_facts.map((k: any) => ({ ...k, context: 'Landlord', type: 'Key Fact', label: k.label })),
    ...CONTEXT_B_DATA.attention_items.map((a: any) => ({ ...a, context: 'Landlord', type: 'Attention Item', label: a.title })),
    ...CONTEXT_B_DATA.obligations.map((o: any) => ({ ...o, context: 'Landlord', type: 'Obligation', label: `${o.who}: ${o.what}` })),
  ];

  for (const it of items) {
    const res = matchEvidence(it.exact_quote, it.page_hint, docIndex);
    const matchedPages = res.spans ? [...new Set(res.spans.map((s: any) => s.page + 1))] : [];
    const sim = res.similarity !== undefined ? res.similarity.toFixed(2) : '-';
    const tier = res.tier ?? '-';
    const spans = res.spans ? res.spans.length : 0;
    const pageStr = matchedPages.length > 0 ? matchedPages.join(',') : '-';
    console.log(`${it.id} | ${it.context} ${it.type} | ${it.label} | ${it.page_hint ?? '-'} | ${res.status} | ${tier} | ${sim} | ${pageStr} | ${spans}`);
  }
}

main().catch(console.error);

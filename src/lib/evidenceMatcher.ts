/**
 * evidenceMatcher.ts
 *
 * Tiered evidence matcher — Pipeline B core.
 *
 * Takes an exact_quote from model output and searches the normalized
 * document text index for it. Computes evidence_status deterministically.
 *
 * THIS FILE NEVER SENDS DATA TO A SERVER. All operations are in-memory.
 *
 * Tier 1: Exact normalized substring — single hit → verified
 * Tier 2: Exact normalized substring — multiple hits → verified (page_hint disambiguates) or multiple_matches
 * Tier 3: Token-boundary regex (flexible whitespace) → verified
 * Tier 4: Sliding-window fuzzy (configurable threshold) → verified_approximate
 * Tier 5: No match → unverified
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceStatus =
  | 'verified'
  | 'verified_approximate'
  | 'multiple_matches'
  | 'unverified'
  | 'unverified_scanned';

export interface TextItem {
  /** Optional identifier for the source text item */
  id?: string;
  /** Normalized text content of this item */
  text: string;
  /** 0-indexed page number */
  page: number;
  /** Bounding box in PDF user-space units [x, y, width, height] */
  bbox: [number, number, number, number];
  /** Optional character offset of this character within the original item's text */
  charOffset?: number;
}

/**
 * A span within the flattened, normalized document string.
 * Maps back to one or more source TextItems.
 */
export interface NormalizedSpan {
  /** Start offset (inclusive) in the normalized full-document string */
  start: number;
  /** End offset (exclusive) in the normalized full-document string */
  end: number;
  /** 0-indexed page number */
  page: number;
  /** Source bounding boxes (may span multiple TextItems) */
  bboxes: Array<[number, number, number, number]>;
}

export interface MatchResult {
  status: EvidenceStatus;
  /** Present when status is verified, verified_approximate, or multiple_matches */
  spans?: NormalizedSpan[];
  /** Similarity score when status is verified_approximate (0–1) */
  similarity?: number;
  /** Human-readable reason (especially for unverified states) */
  reason?: string;
}

/** Configuration for the matcher — all thresholds externalized for tuning */
export interface MatcherConfig {
  /**
   * Minimum token-level similarity for Tier 4 fuzzy match.
   * MUST be validated experimentally against real PDFs before setting a final value.
   * Default: 0.85 (conservative — tune upward if too many false unverified, downward only with evidence)
   */
  fuzzyMinSimilarity: number;
  /**
   * Minimum margin between best and second-best fuzzy match.
   * Prevents accepting a match when two near-identical clauses exist.
   */
  fuzzyMinMargin: number;
  /**
   * Fuzzy search window: search over document windows of size quote_tokens ± padding fraction.
   */
  fuzzyWindowPadding: number;
  /**
   * A line appearing in the top/bottom of more than this fraction of pages is treated as a header/footer.
   */
  headerFooterPageThreshold: number;
}

export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  fuzzyMinSimilarity: 0.85,       // ⚠️ tune after testing real contract PDFs
  fuzzyMinMargin: 0.10,
  fuzzyWindowPadding: 0.20,
  headerFooterPageThreshold: 0.5,
};

/**
 * The document index built by pdfText.ts.
 * Consumed (read-only) by the matcher.
 */
export interface DocumentIndex {
  /** Full normalized text of the document */
  normalizedText: string;
  /**
   * Reverse index: for every character position in normalizedText,
   * which TextItem (and therefore which page + bbox) produced it.
   */
  charToItem: TextItem[];
  /** All pages with very low character density (likely scanned pages) */
  scannedPages: Set<number>;
  /** Total page count */
  pageCount: number;
  /** Optional classification per page: TEXT_EXTRACTABLE | LOW_TEXT_DENSITY | SCANNED_NO_TEXT */
  pageClassifications?: string[];
}

// ---------------------------------------------------------------------------
// Normalization (applied identically to document text AND to quotes)
// ---------------------------------------------------------------------------

/** Unicode ligature map */
const LIGATURE_MAP: Record<string, string> = {
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
  '\u00E6': 'ae',
  '\u00C6': 'AE',
  '\u0153': 'oe',
  '\u0152': 'OE',
};

const LIGATURE_RE = new RegExp(Object.keys(LIGATURE_MAP).join('|'), 'g');

/**
 * Normalize a string for comparison purposes.
 * Applied identically to document text AND to every exact_quote.
 * Symmetry is what makes matching reliable.
 */
export function normalize(text: string): string {
  return (
    text
      // 1. Replace known ligatures before NFKC (NFKC handles most, but be explicit)
      .replace(LIGATURE_RE, (ch) => LIGATURE_MAP[ch] ?? ch)
      // 2. Unicode NFKC (handles full-width, remaining ligatures, canonical forms)
      .normalize('NFKC')
      // 3. Straighten curly quotes to ASCII
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      // 4. Normalize dashes to hyphen-minus
      .replace(/[\u2013\u2014\u2015]/g, '-')
      // 5. Strip soft hyphens followed by optional whitespace (line-break artifact: "some\u00ADwrap" → "somewrap")
      .replace(/\u00AD\s*/g, '')
      // 6. Collapse all whitespace (including line breaks, tabs, non-breaking spaces) to single space
      .replace(/[\s\u00A0]+/g, ' ')
      // 7. Trim
      .trim()
  );
}

/**
 * Normalize for comparison only (also case-folds).
 * Used for matching. Display always uses the original text.
 */
export function normalizeForComparison(text: string): string {
  return normalize(text).toLowerCase();
}

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

/** Split normalized text into tokens (words) */
function tokenize(text: string): string[] {
  return normalizeForComparison(text).split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Similarity (token-level Jaccard + sequence overlap)
// ---------------------------------------------------------------------------

/**
 * Compute token-level similarity between two strings.
 * Uses a combination of token overlap and sequence alignment.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.length === 0 && tokB.length === 0) return 1;
  if (tokA.length === 0 || tokB.length === 0) return 0;

  // Jaccard similarity on token sets
  const setA = new Set(tokA);
  const setB = new Set(tokB);
  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = new Set([...setA, ...setB]);
  const jaccard = intersection.size / union.size;

  // Longest Common Subsequence (LCS) ratio on token sequences
  const lcs = lcsLength(tokA, tokB);
  const lcsRatio = (2 * lcs) / (tokA.length + tokB.length);

  // Weighted average: LCS captures ordering, Jaccard captures vocabulary
  return 0.4 * jaccard + 0.6 * lcsRatio;
}

/** Compute LCS length between two token arrays (O(n*m) DP) */
function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Use flat Uint16Array for performance on large sequences
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i * (n + 1) + j] =
        a[i - 1] === b[j - 1]
          ? dp[(i - 1) * (n + 1) + (j - 1)] + 1
          : Math.max(dp[(i - 1) * (n + 1) + j], dp[i * (n + 1) + (j - 1)]);
    }
  }
  return dp[m * (n + 1) + n];
}

// ---------------------------------------------------------------------------
// Span reconstruction & precise bounding box calculation
// ---------------------------------------------------------------------------

/**
 * Proportional typographic weights for Latin glyphs in standard sans-serif / serif fonts.
 * Used to calculate accurate intra-item bounding boxes for matched character ranges.
 */
export function getCharWeight(ch: string): number {
  if ('ijlI1.:;!|\'",`'.includes(ch)) return 0.35;
  if ('frt-()[]{} '.includes(ch)) return 0.55;
  if ('mwMW@%#&'.includes(ch)) return 1.4;
  if (ch >= 'A' && ch <= 'Z') return 0.95;
  if (ch >= '0' && ch <= '9') return 0.75;
  return 0.7; // default lowercase
}

/**
 * Deterministically compute exact sub-bounding box for a character range [startChar, endChar]
 * within an item whose full text is `text` and full bounding box is `bbox = [x, y, w, h]`.
 */
export function computeSubBbox(
  text: string,
  startChar: number,
  endChar: number,
  bbox: [number, number, number, number],
): [number, number, number, number] {
  const [x, y, totalW, h] = bbox;
  if (startChar <= 0 && endChar >= text.length - 1) {
    return bbox;
  }

  let totalWeight = 0;
  const weights: number[] = new Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const w = getCharWeight(text[i]);
    weights[i] = w;
    totalWeight += w;
  }
  if (totalWeight <= 0) return bbox;

  const unitW = totalW / totalWeight;
  let offsetW = 0;
  for (let i = 0; i < startChar && i < text.length; i++) {
    offsetW += weights[i] * unitW;
  }
  let subW = 0;
  for (let i = startChar; i <= endChar && i < text.length; i++) {
    subW += weights[i] * unitW;
  }

  return [x + offsetW, y, subW, h];
}

/**
 * Given a start/end offset in normalizedText and the charToItem index,
 * reconstruct the set of bounding boxes and the page number.
 *
 * Implements deterministic intra-item character range sub-bounding boxes
 * so the highlighted region corresponds exactly to the matched quote.
 */
function offsetsToSpan(
  start: number,
  end: number,
  index: DocumentIndex,
): NormalizedSpan {
  const itemCharMap = new Map<string, { item: TextItem; charOffsets: number[] }>();
  let page = 0;

  for (let i = start; i < end && i < index.charToItem.length; i++) {
    const entry = index.charToItem[i];
    if (entry && entry.bbox && (entry.bbox[2] > 0 || entry.bbox[3] > 0)) {
      page = entry.page;
      const key = entry.id ?? `${entry.page}:${entry.bbox.join(',')}:${entry.text}`;
      let group = itemCharMap.get(key);
      if (!group) {
        group = { item: entry, charOffsets: [] };
        itemCharMap.set(key, group);
      }
      if (entry.charOffset !== undefined && entry.charOffset >= 0) {
        group.charOffsets.push(entry.charOffset);
      }
    }
  }

  const bboxes: Array<[number, number, number, number]> = [];

  for (const { item, charOffsets } of itemCharMap.values()) {
    if (charOffsets.length === 0 || item.charOffset === undefined) {
      bboxes.push(item.bbox);
      continue;
    }

    charOffsets.sort((a, b) => a - b);
    const minChar = charOffsets[0];
    const maxChar = charOffsets[charOffsets.length - 1];

    const subBbox = computeSubBbox(item.text, minChar, maxChar, item.bbox);
    bboxes.push(subBbox);
  }

  return {
    start,
    end,
    page,
    bboxes,
  };
}

// ---------------------------------------------------------------------------
// Main matcher
// ---------------------------------------------------------------------------

/**
 * Match an exact_quote (from model output) against the document index.
 *
 * @param quote      - The exact_quote string from the analysis result
 * @param pageHint   - Optional page hint from the model (advisory only, 1-indexed)
 * @param index      - The DocumentIndex built by pdfText.ts
 * @param config     - Matcher configuration (thresholds)
 */
export function matchEvidence(
  quote: string,
  pageHint: number | null | undefined,
  index: DocumentIndex,
  config: MatcherConfig = DEFAULT_MATCHER_CONFIG,
): MatchResult {
  if (!quote || !quote.trim()) {
    return { status: 'unverified', reason: 'Empty quote' };
  }

  const normalizedQuote = normalizeForComparison(quote);
  const documentText = index.normalizedText.toLowerCase();

  // -----------------------------------------------------------------------
  // Tier 1 & 2: Exact normalized substring match
  // -----------------------------------------------------------------------
  const exactMatches: NormalizedSpan[] = [];
  let searchFrom = 0;
  while (true) {
    const pos = documentText.indexOf(normalizedQuote, searchFrom);
    if (pos === -1) break;
    exactMatches.push(offsetsToSpan(pos, pos + normalizedQuote.length, index));
    searchFrom = pos + 1;
  }

  if (exactMatches.length === 1) {
    const span = exactMatches[0];
    // Check if the matched page is a scanned page
    if (index.scannedPages.has(span.page)) {
      return {
        status: 'unverified_scanned',
        reason: `Page ${span.page + 1} appears to be scanned (no selectable text layer)`,
      };
    }
    return { status: 'verified', spans: exactMatches };
  }

  if (exactMatches.length > 1) {
    // Tier 2: try to disambiguate with page_hint (1-indexed → 0-indexed)
    if (pageHint != null) {
      const hintPage = pageHint - 1;
      const hinted = exactMatches.filter((s) => s.page === hintPage);
      if (hinted.length === 1) {
        return { status: 'verified', spans: hinted };
      }
    }
    return {
      status: 'multiple_matches',
      spans: exactMatches,
      reason: `Quote appears ${exactMatches.length} times in the document`,
    };
  }

  // -----------------------------------------------------------------------
  // Tier 3: Token-boundary regex (handles line-wrap artifacts)
  // -----------------------------------------------------------------------
  const quoteTokens = normalizedQuote.split(/\s+/).filter(Boolean);
  if (quoteTokens.length > 0) {
    // Build a regex that allows flexible whitespace between tokens
    const escapedTokens = quoteTokens.map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    );
    const flexPattern = new RegExp(escapedTokens.join('[\\s\\S]{0,5}'), 'gi');
    const flexMatches: NormalizedSpan[] = [];
    let m: RegExpExecArray | null;
    while ((m = flexPattern.exec(index.normalizedText)) !== null) {
      flexMatches.push(offsetsToSpan(m.index, m.index + m[0].length, index));
    }
    if (flexMatches.length === 1) {
      const span = flexMatches[0];
      if (index.scannedPages.has(span.page)) {
        return {
          status: 'unverified_scanned',
          reason: `Page ${span.page + 1} appears to be scanned`,
        };
      }
      return { status: 'verified', spans: flexMatches };
    }
    if (flexMatches.length > 1) {
      if (pageHint != null) {
        const hinted = flexMatches.filter((s) => s.page === pageHint - 1);
        if (hinted.length === 1) return { status: 'verified', spans: hinted };
      }
      return {
        status: 'multiple_matches',
        spans: flexMatches,
        reason: `Flexible match found ${flexMatches.length} candidates`,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Tier 4: Sliding-window fuzzy match
  // -----------------------------------------------------------------------
  const quoteLen = quoteTokens.length;
  const allDocTokens = documentText.split(/\s+/).filter(Boolean);
  const windowSize = Math.round(quoteLen * (1 + config.fuzzyWindowPadding));
  const minWindow = Math.max(1, Math.round(quoteLen * (1 - config.fuzzyWindowPadding)));

  let bestSim = 0;
  let secondBestSim = 0;
  let bestWindowStart = -1;
  let bestWindowEnd = -1;

  for (let start = 0; start <= allDocTokens.length - minWindow; start++) {
    for (
      let wLen = minWindow;
      wLen <= Math.min(windowSize, allDocTokens.length - start);
      wLen++
    ) {
      const window = allDocTokens.slice(start, start + wLen).join(' ');
      const sim = tokenSimilarity(normalizedQuote, window);
      if (sim > bestSim) {
        secondBestSim = bestSim;
        bestSim = sim;
        bestWindowStart = start;
        bestWindowEnd = start + wLen;
      } else if (sim > secondBestSim) {
        secondBestSim = sim;
      }
    }
  }

  if (
    bestSim >= config.fuzzyMinSimilarity &&
    bestSim - secondBestSim >= config.fuzzyMinMargin
  ) {
    // Reconstruct character offsets from token positions
    const preText = allDocTokens.slice(0, bestWindowStart).join(' ');
    const matchText = allDocTokens
      .slice(bestWindowStart, bestWindowEnd)
      .join(' ');
    const charStart = documentText.indexOf(
      allDocTokens[bestWindowStart] ?? '',
      preText.length,
    );
    const charEnd = charStart + matchText.length;
    const span = offsetsToSpan(
      Math.max(0, charStart),
      Math.min(index.normalizedText.length, charEnd),
      index,
    );

    if (index.scannedPages.has(span.page)) {
      return {
        status: 'unverified_scanned',
        reason: `Page ${span.page + 1} appears to be scanned`,
      };
    }

    return {
      status: 'verified_approximate',
      spans: [span],
      similarity: bestSim,
      reason: `Fuzzy match similarity: ${(bestSim * 100).toFixed(1)}%`,
    };
  }

  // -----------------------------------------------------------------------
  // Tier 5: Unverified
  // -----------------------------------------------------------------------
  return {
    status: 'unverified',
    reason:
      'Quote could not be located in the document text. It may be a summary rather than a verbatim quote, or the document may have limited text layer coverage.',
  };
}

/**
 * Pretext — Reflow-free text measurement and layout engine for NEXUS.
 *
 * Inspired by chenglou/pretext. Two-phase architecture:
 *   1. PREPARE — segment text, measure via OffscreenCanvas, cache results.
 *   2. LAYOUT  — pure arithmetic on cached widths. No DOM reads.
 *
 * This means resize, animation, and virtual-scroll height calculations
 * are ~0.01ms instead of triggering expensive browser reflow.
 */

// ---------------------------------------------------------------------------
// Measurement context (singleton OffscreenCanvas — never in the DOM)
// ---------------------------------------------------------------------------
let _ctx = null;

function getMeasureCtx() {
  if (_ctx) return _ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    _ctx = new OffscreenCanvas(1, 1).getContext('2d');
  } else if (typeof document !== 'undefined') {
    _ctx = document.createElement('canvas').getContext('2d');
  } else {
    throw new Error('Pretext requires OffscreenCanvas or a DOM canvas context.');
  }
  return _ctx;
}

// ---------------------------------------------------------------------------
// Segment-level measurement cache: font → segment → width (LRU-bounded)
// ---------------------------------------------------------------------------
const MAX_CACHE_ENTRIES_PER_FONT = 2000;
const _caches = new Map();

function getCache(font) {
  let c = _caches.get(font);
  if (!c) { c = new Map(); _caches.set(font, c); }
  return c;
}

function measureSegment(segment, font) {
  const cache = getCache(font);
  let w = cache.get(segment);
  if (w !== undefined) {
    // LRU touch: delete + re-insert moves to end of iteration order
    cache.delete(segment);
    cache.set(segment, w);
    return w;
  }
  const ctx = getMeasureCtx();
  ctx.font = font;
  w = ctx.measureText(segment).width;
  // Evict oldest 25% when exceeding cap
  if (cache.size >= MAX_CACHE_ENTRIES_PER_FONT) {
    const evictCount = MAX_CACHE_ENTRIES_PER_FONT >>> 2;
    let removed = 0;
    for (const key of cache.keys()) {
      if (removed >= evictCount) break;
      cache.delete(key);
      removed++;
    }
  }
  cache.set(segment, w);
  return w;
}

// ---------------------------------------------------------------------------
// Collapsed-space-width cache (for inter-item gaps)
// ---------------------------------------------------------------------------
const _spaceWidths = new Map();

export function getSpaceWidth(font) {
  let w = _spaceWidths.get(font);
  if (w !== undefined) return w;
  const joined = measureSegment('A A', font);
  const compact = measureSegment('AA', font);
  w = Math.max(0, joined - compact);
  _spaceWidths.set(font, w);
  return w;
}

// ---------------------------------------------------------------------------
// Text segmentation via Intl.Segmenter — with locale support
// ---------------------------------------------------------------------------
let _wordSegmenter = null;
let _graphemeSegmenter = null;
let _locale = undefined; // undefined = browser default

/**
 * Set the locale for text segmentation. Affects word-boundary rules
 * for CJK, Thai, Khmer, and other scripts with locale-specific breaking.
 * Call with no argument to reset to browser default.
 *
 * @param {string} [locale] — BCP 47 locale tag (e.g. 'ja', 'th', 'zh-Hans')
 */
export function setLocale(locale) {
  if (_locale === locale) return;
  _locale = locale;
  _wordSegmenter = null;
  _graphemeSegmenter = null;
}

function wordSegmenter() {
  if (!_wordSegmenter) _wordSegmenter = new Intl.Segmenter(_locale, { granularity: 'word' });
  return _wordSegmenter;
}

export function graphemeSegmenter() {
  if (!_graphemeSegmenter) _graphemeSegmenter = new Intl.Segmenter(_locale, { granularity: 'grapheme' });
  return _graphemeSegmenter;
}

// ---------------------------------------------------------------------------
// Phase 1: PREPARE — segment + measure, return opaque handle
// ---------------------------------------------------------------------------

/**
 * Prepare text for layout. Segments into words, measures each, caches.
 * Returns an opaque PreparedText with parallel arrays for segments and widths.
 *
 * @param {string} text
 * @param {string} font — CSS font shorthand, e.g. '500 14px Roboto, sans-serif'
 * @param {{ whiteSpace?: 'normal' | 'pre-wrap' }} [options]
 * @returns {PreparedText}
 */
export function prepare(text, font, options) {
  const mode = options?.whiteSpace ?? 'normal';
  const normalized = mode === 'normal' ? text.replace(/\s+/g, ' ').trim() : text;
  if (normalized.length === 0) {
    return { text: '', font, segments: [], widths: [], isWhitespace: [], totalWidth: 0 };
  }

  const segs = [];
  const widths = [];
  const isWhitespace = [];
  let totalWidth = 0;

  if (mode === 'pre-wrap') {
    // In pre-wrap mode, split on hard newlines and preserve whitespace runs
    const lines = normalized.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        segs.push('\n');
        widths.push(0);
        isWhitespace.push(true);
      }
      const line = lines[i];
      if (line.length === 0) continue;
      for (const { segment } of wordSegmenter().segment(line)) {
        const w = measureSegment(segment, font);
        segs.push(segment);
        widths.push(w);
        isWhitespace.push(/^\s+$/.test(segment));
        totalWidth += w;
      }
    }
  } else {
    for (const { segment } of wordSegmenter().segment(normalized)) {
      const w = measureSegment(segment, font);
      segs.push(segment);
      widths.push(w);
      isWhitespace.push(/^\s+$/.test(segment));
      totalWidth += w;
    }
  }

  return { text: normalized, font, segments: segs, widths, isWhitespace, totalWidth };
}

// ---------------------------------------------------------------------------
// Phase 2: LAYOUT — pure arithmetic, zero DOM reads
// ---------------------------------------------------------------------------

/**
 * Compute height + line count for prepared text at a given maxWidth.
 * This is the fast path — ~0.01ms per call.
 *
 * @param {PreparedText} prepared
 * @param {number} maxWidth
 * @param {number} lineHeight — px per line
 * @returns {{ lineCount: number, height: number }}
 */
export function layout(prepared, maxWidth, lineHeight) {
  if (prepared.segments.length === 0) return { lineCount: 0, height: 0 };
  const safeMax = Math.max(1, maxWidth);

  let lineCount = 1;
  let lineWidth = 0;

  for (let i = 0; i < prepared.segments.length; i++) {
    const w = prepared.widths[i];
    const ws = prepared.isWhitespace[i];

    // Hard newline
    if (prepared.segments[i] === '\n') {
      lineCount++;
      lineWidth = 0;
      continue;
    }

    // Whitespace hangs at line end (CSS behaviour)
    if (ws) {
      lineWidth += w;
      continue;
    }

    // Would this word overflow?
    if (lineWidth + w > safeMax && lineWidth > 0) {
      lineCount++;
      lineWidth = w;
    } else {
      lineWidth += w;
    }
  }

  return { lineCount, height: lineCount * lineHeight };
}

/**
 * Return actual line contents with widths and text.
 * More expensive than layout() — use when you need the text.
 *
 * @param {PreparedText} prepared
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @returns {{ lineCount: number, height: number, lines: Array<{ text: string, width: number }> }}
 */
export function layoutWithLines(prepared, maxWidth, lineHeight) {
  if (prepared.segments.length === 0) return { lineCount: 0, height: 0, lines: [] };
  const safeMax = Math.max(1, maxWidth);

  const lines = [];
  let lineText = '';
  let lineWidth = 0;

  function pushLine() {
    // Trim trailing whitespace from line text for display
    const trimmed = lineText.replace(/\s+$/, '');
    const trimmedWidth = trimmed === lineText ? lineWidth : measureSegment(trimmed, prepared.font);
    lines.push({ text: trimmed, width: trimmedWidth });
  }

  for (let i = 0; i < prepared.segments.length; i++) {
    const seg = prepared.segments[i];
    const w = prepared.widths[i];
    const ws = prepared.isWhitespace[i];

    if (seg === '\n') {
      pushLine();
      lineText = '';
      lineWidth = 0;
      continue;
    }

    if (ws) {
      lineText += seg;
      lineWidth += w;
      continue;
    }

    if (lineWidth + w > safeMax && lineWidth > 0) {
      pushLine();
      lineText = seg;
      lineWidth = w;
    } else {
      lineText += seg;
      lineWidth += w;
    }
  }

  if (lineText.length > 0 || lines.length === 0) {
    pushLine();
  }

  const lineCount = lines.length;
  return { lineCount, height: lineCount * lineHeight, lines };
}

/**
 * Layout a single line from a cursor position, up to maxWidth.
 * Returns { text, width, endIndex } or null if cursor is past end.
 * This is the variable-width iterator — call repeatedly for custom layouts.
 *
 * @param {PreparedText} prepared
 * @param {number} startIndex — segment index to start from
 * @param {number} maxWidth
 * @returns {{ text: string, width: number, endIndex: number } | null}
 */
export function layoutNextLine(prepared, startIndex, maxWidth) {
  if (startIndex >= prepared.segments.length) return null;
  const safeMax = Math.max(1, maxWidth);

  let lineText = '';
  let lineWidth = 0;
  let i = startIndex;

  // Skip leading whitespace at line start
  while (i < prepared.segments.length && prepared.isWhitespace[i] && prepared.segments[i] !== '\n') {
    i++;
  }

  for (; i < prepared.segments.length; i++) {
    const seg = prepared.segments[i];
    const w = prepared.widths[i];
    const ws = prepared.isWhitespace[i];

    if (seg === '\n') {
      return { text: lineText, width: lineWidth, endIndex: i + 1 };
    }

    if (ws) {
      lineText += seg;
      lineWidth += w;
      continue;
    }

    if (lineWidth + w > safeMax && lineWidth > 0) {
      return { text: lineText.replace(/\s+$/, ''), width: lineWidth, endIndex: i };
    }

    lineText += seg;
    lineWidth += w;
  }

  return { text: lineText.replace(/\s+$/, ''), width: lineWidth, endIndex: i };
}

// ---------------------------------------------------------------------------
// Rich inline layout — mixed text runs + atomic inline elements (chips, badges)
// ---------------------------------------------------------------------------

/**
 * @typedef {'text'|'chip'} InlineKind
 *
 * @typedef {Object} InlineSpec
 * @property {'text'} kind
 * @property {string} text
 * @property {string} font — CSS font shorthand
 * @property {string} [className]
 * @property {number} [chromeWidth] — extra px (padding/border) around the text
 *
 * @typedef {Object} ChipSpec
 * @property {'chip'} kind
 * @property {string} label
 * @property {string} font — font used to measure label width
 * @property {string} [className]
 * @property {number} [chromeWidth] — total horizontal padding/border
 */

/**
 * Prepare a list of inline specs into measurable items.
 * This is the PREPARE phase for rich inline content.
 *
 * @param {Array<InlineSpec|ChipSpec>} specs
 * @param {{ gapFont?: string }} [options] — font to derive the inter-item gap from
 * @returns {PreparedInlineItem[]}
 */
export function prepareInlineItems(specs, options) {
  const gapFont = options?.gapFont ?? '400 14px Roboto, sans-serif';
  const gap = getSpaceWidth(gapFont);
  const items = [];
  let pendingGap = 0;

  for (const spec of specs) {
    if (spec.kind === 'chip') {
      const labelWidth = measureSegment(spec.label, spec.font ?? gapFont);
      const chrome = spec.chromeWidth ?? 22;
      items.push({
        kind: 'chip',
        className: spec.className ?? '',
        label: spec.label,
        width: Math.ceil(labelWidth) + chrome,
        leadingGap: pendingGap || gap,
      });
      pendingGap = gap;
      continue;
    }

    // kind === 'text'
    const hasLeadingSpace = /^\s/.test(spec.text);
    const hasTrailingSpace = /\s$/.test(spec.text);
    const trimmed = spec.text.trim();
    if (trimmed.length === 0) {
      pendingGap = gap;
      continue;
    }

    const font = spec.font ?? gapFont;
    const chrome = spec.chromeWidth ?? 0;
    const prepared = prepare(trimmed, font);

    items.push({
      kind: 'text',
      className: spec.className ?? '',
      chromeWidth: chrome,
      font,
      prepared,
      fullText: trimmed,
      fullWidth: prepared.totalWidth + chrome,
      leadingGap: (pendingGap > 0 || hasLeadingSpace) ? gap : 0,
    });
    pendingGap = hasTrailingSpace ? gap : 0;
  }

  return items;
}

/**
 * Layout prepared inline items into lines at a given maxWidth.
 * Chips are atomic (never break). Text wraps at word boundaries.
 *
 * @param {PreparedInlineItem[]} items
 * @param {number} maxWidth
 * @returns {Array<{ fragments: Array<{ kind: string, className: string, text: string, leadingGap: number }> }>}
 */
export function layoutInlineItems(items, maxWidth) {
  const safeWidth = Math.max(1, maxWidth);
  const lines = [];

  let itemIdx = 0;
  let textSegIdx = null; // segment index within current text item if partially consumed

  while (itemIdx < items.length) {
    const fragments = [];
    let lineWidth = 0;
    let remaining = safeWidth;

    lineLoop:
    while (itemIdx < items.length) {
      const item = items[itemIdx];

      if (item.kind === 'chip') {
        const gap = fragments.length === 0 ? 0 : item.leadingGap;
        if (fragments.length > 0 && gap + item.width > remaining) break lineLoop;

        fragments.push({ kind: 'chip', className: item.className, text: item.label, leadingGap: gap });
        lineWidth += gap + item.width;
        remaining = Math.max(0, safeWidth - lineWidth);
        itemIdx++;
        textSegIdx = null;
        continue;
      }

      // kind === 'text'
      const gap = fragments.length === 0 ? 0 : item.leadingGap;
      const reserved = gap + item.chromeWidth;

      // Fast path: full item fits
      if (textSegIdx === null && reserved + item.fullWidth - item.chromeWidth <= remaining) {
        fragments.push({ kind: 'text', className: item.className, text: item.fullText, leadingGap: gap });
        lineWidth += gap + item.fullWidth;
        remaining = Math.max(0, safeWidth - lineWidth);
        itemIdx++;
        continue;
      }

      // Slow path: break the text item
      if (fragments.length > 0 && reserved >= remaining) break lineLoop;

      const startIdx = textSegIdx ?? 0;
      const line = layoutNextLine(item.prepared, startIdx, Math.max(1, remaining - reserved));
      if (!line || line.text.length === 0) {
        itemIdx++;
        textSegIdx = null;
        continue;
      }

      fragments.push({ kind: 'text', className: item.className, text: line.text, leadingGap: gap });
      lineWidth += gap + line.width + item.chromeWidth;
      remaining = Math.max(0, safeWidth - lineWidth);

      if (line.endIndex >= item.prepared.segments.length) {
        itemIdx++;
        textSegIdx = null;
        continue;
      }

      textSegIdx = line.endIndex;
      break lineLoop;
    }

    if (fragments.length === 0) break;
    lines.push({ fragments });
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Height estimation for virtual scrolling
// ---------------------------------------------------------------------------

/**
 * Estimate the rendered height of a block of text at a given width,
 * without touching the DOM. Useful for virtual list row heights.
 *
 * @param {string} text
 * @param {string} font
 * @param {number} maxWidth
 * @param {number} lineHeight — px per line
 * @param {{ paddingY?: number }} [options]
 * @returns {number} — total height in px
 */
export function estimateTextHeight(text, font, maxWidth, lineHeight, options) {
  if (!text || maxWidth <= 0) return options?.paddingY ?? 0;
  const prepared = prepare(text, font);
  const { height } = layout(prepared, maxWidth, lineHeight);
  return height + (options?.paddingY ?? 0);
}

/**
 * Batch-estimate heights for an array of items. Returns a parallel array of heights.
 * The prepare phase is amortised across items sharing the same font.
 *
 * @param {Array<{ text: string, font?: string }>} items
 * @param {string} defaultFont
 * @param {number} maxWidth
 * @param {number} lineHeight
 * @param {{ paddingY?: number, minHeight?: number }} [options]
 * @returns {number[]}
 */
export function batchEstimateHeights(items, defaultFont, maxWidth, lineHeight, options) {
  const padY = options?.paddingY ?? 0;
  const minH = options?.minHeight ?? 0;
  return items.map(item => {
    const font = item.font ?? defaultFont;
    const h = estimateTextHeight(item.text, font, maxWidth, lineHeight, { paddingY: padY });
    return Math.max(minH, h);
  });
}

// ---------------------------------------------------------------------------
// Smart truncation — word-boundary-aware "Show more"
// ---------------------------------------------------------------------------

/**
 * Truncate text to fit within `maxLines` lines at `maxWidth`, breaking
 * at a word boundary. Returns the truncated text and whether it was clipped.
 *
 * Unlike CSS `line-clamp`, this computes the exact cut point via arithmetic
 * — no DOM measurement, no hidden element, no reflow.
 *
 * @param {string} text
 * @param {string} font
 * @param {number} maxWidth
 * @param {number} maxLines
 * @param {{ ellipsis?: string }} [options]
 * @returns {{ text: string, truncated: boolean, lineCount: number }}
 */
export function truncateToLines(text, font, maxWidth, maxLines, options) {
  if (!text) return { text: '', truncated: false, lineCount: 0 };
  const prepared = prepare(text, font);
  const full = layout(prepared, maxWidth, 1); // lineHeight=1 just for counting
  if (full.lineCount <= maxLines) {
    return { text, truncated: false, lineCount: full.lineCount };
  }

  const ellipsis = options?.ellipsis ?? '…';
  const ellipsisWidth = measureSegment(ellipsis, font);

  // Walk lines until we reach maxLines, then truncate the last
  let lineCount = 1;
  let lineWidth = 0;
  let lastGoodIdx = 0;

  for (let i = 0; i < prepared.segments.length; i++) {
    const seg = prepared.segments[i];
    const w = prepared.widths[i];
    const ws = prepared.isWhitespace[i];

    if (seg === '\n') {
      lineCount++;
      if (lineCount > maxLines) break;
      lineWidth = 0;
      lastGoodIdx = i + 1;
      continue;
    }

    if (ws) { lineWidth += w; continue; }

    if (lineWidth + w > maxWidth && lineWidth > 0) {
      lineCount++;
      if (lineCount > maxLines) break;
      lineWidth = w;
      lastGoodIdx = i;
    } else {
      lineWidth += w;
      // On the last allowed line, check if ellipsis still fits
      if (lineCount === maxLines && lineWidth + ellipsisWidth > maxWidth) {
        break;
      }
      lastGoodIdx = i + 1;
    }
  }

  const truncated = prepared.segments.slice(0, lastGoodIdx).join('').replace(/\s+$/, '') + ellipsis;
  return { text: truncated, truncated: true, lineCount: maxLines };
}

/**
 * Extract plain text from an array of inline specs.
 * Useful for screen readers — builds the accessible text content
 * from the same specs used for visual rendering.
 *
 * @param {Array<InlineSpec|ChipSpec>} specs
 * @returns {string}
 */
export function specsToPlainText(specs) {
  return specs.map(s => s.kind === 'chip' ? s.label : s.text).join('');
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

export function clearCaches() {
  _caches.clear();
  _spaceWidths.clear();
  _wordSegmenter = null;
  _graphemeSegmenter = null;
}

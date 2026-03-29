/**
 * usePretext — React hooks for the Pretext measurement engine.
 *
 * Bridges the reflow-free measurement engine with React's render cycle.
 * All measurement happens off-DOM; layout recomputes on width change via
 * ResizeObserver, but the recompute is pure arithmetic (~0.01ms).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  prepare,
  layout,
  layoutWithLines,
  estimateTextHeight,
  batchEstimateHeights,
  prepareInlineItems,
  layoutInlineItems,
  measureAccordionHeight,
} from './pretext.js';

// ---------------------------------------------------------------------------
// useTextHeight — measure text height without DOM reflow
// ---------------------------------------------------------------------------

/**
 * Returns the computed height of `text` at the current container width.
 * Recalculates on resize (via ResizeObserver), but the calculation is
 * pure arithmetic — no layout thrashing.
 *
 * @param {string} text
 * @param {string} font — CSS font shorthand
 * @param {number} lineHeight — px per line
 * @param {{ paddingY?: number, fallbackWidth?: number }} [options]
 * @returns {{ ref: React.RefObject, height: number, lineCount: number }}
 */
export function useTextHeight(text, font, lineHeight, options) {
  const ref = useRef(null);
  const [result, setResult] = useState({ height: 0, lineCount: 0 });

  const prepared = useMemo(() => text ? prepare(text, font) : null, [text, font]);

  const measure = useCallback(() => {
    if (!prepared) { setResult({ height: 0, lineCount: 0 }); return; }
    const width = ref.current?.offsetWidth ?? options?.fallbackWidth ?? 400;
    const r = layout(prepared, width, lineHeight);
    setResult(prev => (prev.height === r.height && prev.lineCount === r.lineCount) ? prev : r);
  }, [prepared, lineHeight, options?.fallbackWidth]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, ...result };
}

// ---------------------------------------------------------------------------
// useTextLines — get line-broken text content
// ---------------------------------------------------------------------------

/**
 * Returns the line-broken text with per-line widths.
 * Use when you need to render individual lines (custom text rendering,
 * absolutely-positioned lines like the rich-note demo).
 *
 * @param {string} text
 * @param {string} font
 * @param {number} lineHeight
 * @param {{ fallbackWidth?: number }} [options]
 * @returns {{ ref: React.RefObject, lines: Array<{text: string, width: number}>, height: number }}
 */
export function useTextLines(text, font, lineHeight, options) {
  const ref = useRef(null);
  const [result, setResult] = useState({ lines: [], height: 0, lineCount: 0 });

  const prepared = useMemo(() => text ? prepare(text, font) : null, [text, font]);

  const measure = useCallback(() => {
    if (!prepared) { setResult({ lines: [], height: 0, lineCount: 0 }); return; }
    const width = ref.current?.offsetWidth ?? options?.fallbackWidth ?? 400;
    const r = layoutWithLines(prepared, width, lineHeight);
    setResult(r);
  }, [prepared, lineHeight, options?.fallbackWidth]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, ...result };
}

// ---------------------------------------------------------------------------
// useRichInlineLayout — layout mixed inline content (text + chips)
// ---------------------------------------------------------------------------

/**
 * Prepare + layout rich inline specs at the current container width.
 * Re-runs layout (pure arithmetic) on resize; prepare runs once per specs change.
 *
 * @param {Array<import('./pretext.js').InlineSpec|import('./pretext.js').ChipSpec>} specs
 * @param {{ gapFont?: string, fallbackWidth?: number }} [options]
 * @returns {{ ref: React.RefObject, lines: Array, height: number }}
 */
export function useRichInlineLayout(specs, lineHeight, options) {
  const ref = useRef(null);
  const [result, setResult] = useState({ lines: [], height: 0 });

  const items = useMemo(
    () => specs?.length ? prepareInlineItems(specs, { gapFont: options?.gapFont }) : [],
    [specs, options?.gapFont]
  );

  const measure = useCallback(() => {
    if (items.length === 0) { setResult({ lines: [], height: 0 }); return; }
    const width = ref.current?.offsetWidth ?? options?.fallbackWidth ?? 400;
    const lines = layoutInlineItems(items, width);
    const height = lines.length * lineHeight;
    setResult(prev => (prev.lines.length === lines.length && prev.height === height) ? prev : { lines, height });
  }, [items, lineHeight, options?.fallbackWidth]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, ...result };
}

// ---------------------------------------------------------------------------
// useVirtualRows — virtual scrolling with pre-computed heights
// ---------------------------------------------------------------------------

/**
 * Virtual scroll engine powered by Pretext height estimation.
 * Only renders the visible window of items, using pre-measured heights
 * so scroll position is accurate without rendering off-screen items.
 *
 * @param {{ items: Array<{ text: string, font?: string }>, defaultFont: string, maxWidth: number, lineHeight: number, containerHeight: number, overscan?: number, paddingY?: number, minRowHeight?: number }}
 * @returns {{ visibleItems: Array<{ item: any, index: number, top: number }>, totalHeight: number, onScroll: (e) => void, scrollTop: number }}
 */
export function useVirtualRows({
  items,
  defaultFont,
  maxWidth,
  lineHeight,
  containerHeight,
  overscan = 3,
  paddingY = 0,
  minRowHeight = 40,
}) {
  const [scrollTop, setScrollTop] = useState(0);

  // Batch estimate all row heights (cached per font+segment, so cheap on re-render)
  const heights = useMemo(
    () => batchEstimateHeights(items, defaultFont, maxWidth, lineHeight, { paddingY, minHeight: minRowHeight }),
    [items, defaultFont, maxWidth, lineHeight, paddingY, minRowHeight]
  );

  // Prefix sums for O(1) position lookup
  const offsets = useMemo(() => {
    const o = new Float64Array(heights.length + 1);
    for (let i = 0; i < heights.length; i++) {
      o[i + 1] = o[i] + heights[i];
    }
    return o;
  }, [heights]);

  const totalHeight = offsets[offsets.length - 1] ?? 0;

  // Binary search for first visible item
  const visibleItems = useMemo(() => {
    if (items.length === 0) return [];

    // Find first item whose bottom edge is past scrollTop
    let lo = 0, hi = items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
      else hi = mid;
    }

    const startIdx = Math.max(0, lo - overscan);
    const viewBottom = scrollTop + containerHeight;
    const visible = [];

    for (let i = startIdx; i < items.length; i++) {
      const top = offsets[i];
      if (top > viewBottom + overscan * minRowHeight) break;
      visible.push({ item: items[i], index: i, top, height: heights[i] });
    }

    return visible;
  }, [items, offsets, heights, scrollTop, containerHeight, overscan, minRowHeight]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return { visibleItems, totalHeight, onScroll, scrollTop };
}

// ---------------------------------------------------------------------------
// useAccordionHeight — pre-measure accordion content
// ---------------------------------------------------------------------------

/**
 * Returns the exact pixel height for accordion content, pre-computed
 * via Pretext so Framer Motion can animate to a known value instead of
 * `height: 'auto'` (which forces a layout read).
 *
 * @param {string} text
 * @param {string} font
 * @param {number} lineHeight
 * @param {{ paddingY?: number, containerWidth?: number }} [options]
 * @returns {{ ref: React.RefObject, contentHeight: number }}
 */
export function useAccordionHeight(text, font, lineHeight, options) {
  const ref = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  const prepared = useMemo(() => text ? prepare(text, font) : null, [text, font]);

  const measure = useCallback(() => {
    if (!prepared) { setContentHeight(0); return; }
    const width = options?.containerWidth ?? ref.current?.offsetWidth ?? 400;
    const { height } = layout(prepared, width, lineHeight);
    const total = height + (options?.paddingY ?? 0);
    setContentHeight(prev => prev === total ? prev : total);
  }, [prepared, lineHeight, options?.containerWidth, options?.paddingY]);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, contentHeight };
}

/**
 * usePretext — React hooks for the Pretext measurement engine.
 *
 * Bridges the reflow-free measurement engine with React's render cycle.
 * All measurement happens off-DOM; layout recomputes on width change via
 * ResizeObserver, but the recompute is pure arithmetic (~0.01ms).
 */

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  prepare,
  layout,
  layoutWithLines,
  prepareInlineItems,
  layoutInlineItems,
} from './pretext.js';

// ---------------------------------------------------------------------------
// useReducedMotion — observe prefers-reduced-motion, react to changes
// ---------------------------------------------------------------------------

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let _rmSubscribers = [];
let _rmValue = false;
let _rmMql = null;

function initReducedMotion() {
  if (_rmMql || typeof window === 'undefined') return;
  _rmMql = window.matchMedia(REDUCED_MOTION_QUERY);
  _rmValue = _rmMql.matches;
  _rmMql.addEventListener('change', (e) => {
    _rmValue = e.matches;
    for (const cb of _rmSubscribers) cb();
  });
}

function subscribeRM(cb) {
  initReducedMotion();
  _rmSubscribers.push(cb);
  return () => { _rmSubscribers = _rmSubscribers.filter(s => s !== cb); };
}

function getSnapshotRM() {
  initReducedMotion();
  return _rmValue;
}

function getServerSnapshotRM() {
  return false;
}

/**
 * Returns true if the user prefers reduced motion.
 * Observes the media query and re-renders on change.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeRM, getSnapshotRM, getServerSnapshotRM);
}

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
    const el = ref.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el); // schedules initial callback at end of frame
      return () => ro.disconnect();
    }
    // No element or no ResizeObserver — measure once asynchronously
    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(measure);
      return () => {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      };
    }
    const timeout = setTimeout(measure, 0);
    return () => clearTimeout(timeout);
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
    const el = ref.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
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
    const el = ref.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  return { ref, ...result };
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
    const el = ref.current;
    if (el && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure]);

  return { ref, contentHeight };
}

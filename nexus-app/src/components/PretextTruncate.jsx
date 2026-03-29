/**
 * PretextTruncate — Smart text truncation at word boundaries.
 *
 * Unlike CSS `line-clamp` (which requires rendered DOM to determine where
 * to clip), PretextTruncate computes the exact cut point via OffscreenCanvas
 * arithmetic. This means:
 *   - No layout shift — height is known before first paint
 *   - Word-boundary break — never cuts mid-word
 *   - "Show more" toggles between truncated and full text
 *   - Works in virtual lists (height can be pre-computed for scroll accuracy)
 *
 * Accessibility:
 *   - Toggle button has aria-expanded
 *   - Full text available to screen readers when truncated
 *
 * Usage:
 *   <PretextTruncate
 *     text={proposal.description}
 *     maxLines={2}
 *     font="400 14px Roboto, system-ui, sans-serif"
 *     lineHeight={22}
 *     className="text-sm text-nexus-text-dim"
 *   />
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { truncateToLines } from '../lib/pretext.js';
import { FONTS, LINE_HEIGHTS } from '../config/designTokens.js';

export default function PretextTruncate({
  text,
  maxLines = 2,
  font = FONTS.body,
  lineHeight = LINE_HEIGHTS.body,
  className = '',
  expandLabel = 'Show more',
  collapseLabel = 'Show less',
  ellipsis = '…',
}) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(400);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute truncation via Pretext (pure arithmetic, no DOM)
  const result = useMemo(() => {
    if (!text) return { display: '', truncated: false, truncatedHeight: 0 };
    const trunc = truncateToLines(text, font, containerWidth, maxLines, { ellipsis });
    return {
      display: trunc.text,
      truncated: trunc.truncated,
      truncatedHeight: trunc.lineCount * lineHeight,
    };
  }, [text, font, containerWidth, maxLines, lineHeight, ellipsis]);

  const toggle = useCallback(() => setExpanded(e => !e), []);

  if (!text) return null;

  const showToggle = result.truncated;
  const displayText = expanded ? text : result.display;

  return (
    <div ref={containerRef}>
      <p
        className={className}
        style={{ minHeight: result.truncatedHeight || undefined }}
        aria-label={result.truncated && !expanded ? text : undefined}
      >
        {displayText}
      </p>
      {showToggle && (
        <button
          onClick={toggle}
          aria-expanded={expanded}
          className="text-xs text-nexus-cyan hover:underline mt-1 focus:outline-none focus:ring-1 focus:ring-nexus-cyan/50 rounded px-1"
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
}

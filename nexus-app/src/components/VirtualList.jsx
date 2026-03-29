/**
 * VirtualList — Virtual scrolling powered by Pretext height estimation.
 *
 * Instead of rendering 100+ DOM nodes for a long list, only renders the
 * visible window. Row heights are pre-computed via OffscreenCanvas text
 * measurement — no DOM reads needed, no "render then measure" cycle.
 *
 * The key insight from Pretext: separate measurement from rendering.
 * Heights are pure arithmetic on cached segment widths, so:
 *   - Initial render knows all heights before any DOM exists
 *   - Scroll position is accurate (no jumping/shimmer)
 *   - Resize recalculates in ~0.01ms per item
 *
 * Usage:
 *   <VirtualList
 *     items={proposals}
 *     containerHeight={600}
 *     estimateHeight={(item) => estimateTextHeight(item.description, font, width, lineHeight)}
 *     renderItem={(item, index, style) => (
 *       <div style={style}><ProposalCard proposal={item} /></div>
 *     )}
 *   />
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * @param {{
 *   items: any[],
 *   containerHeight: number,
 *   estimateHeight: (item: any, index: number) => number,
 *   renderItem: (item: any, index: number, style: object) => React.ReactNode,
 *   overscan?: number,
 *   className?: string,
 *   innerClassName?: string,
 *   gap?: number,
 * }} props
 */
export default function VirtualList({
  items,
  containerHeight,
  estimateHeight,
  renderItem,
  overscan = 5,
  className = '',
  innerClassName = '',
  gap = 0,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track container width for responsive re-estimation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pre-compute all heights (Pretext makes this cheap — cached arithmetic)
  const heights = useMemo(
    () => items.map((item, i) => estimateHeight(item, i) + gap),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, containerWidth, gap]
  );

  // Prefix sums for O(1) position lookup
  const offsets = useMemo(() => {
    const o = new Float64Array(heights.length + 1);
    for (let i = 0; i < heights.length; i++) {
      o[i + 1] = o[i] + heights[i];
    }
    return o;
  }, [heights]);

  const totalHeight = offsets.length > 0 ? offsets[offsets.length - 1] : 0;

  // Binary search for first visible index
  const visibleRange = useMemo(() => {
    if (items.length === 0) return { start: 0, end: 0 };

    let lo = 0, hi = items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
      else hi = mid;
    }

    const start = Math.max(0, lo - overscan);
    const viewBottom = scrollTop + containerHeight;

    let end = lo;
    while (end < items.length && offsets[end] < viewBottom) end++;
    end = Math.min(items.length, end + overscan);

    return { start, end };
  }, [items.length, offsets, scrollTop, containerHeight, overscan]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Render only visible items
  const visibleItems = [];
  for (let i = visibleRange.start; i < visibleRange.end; i++) {
    const style = {
      position: 'absolute',
      top: offsets[i],
      left: 0,
      right: 0,
      height: heights[i] - gap,
    };
    visibleItems.push(renderItem(items[i], i, style));
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={onScroll}
    >
      <div className={`relative ${innerClassName}`} style={{ height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  );
}

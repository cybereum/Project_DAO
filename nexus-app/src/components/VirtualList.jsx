/**
 * VirtualList — Virtual scrolling powered by Pretext height estimation.
 *
 * Instead of rendering 100+ DOM nodes for a long list, only renders the
 * visible window. Row heights are pre-computed via OffscreenCanvas text
 * measurement — no DOM reads needed, no "render then measure" cycle.
 *
 * Accessibility:
 *   - Container has role="list" and aria-label
 *   - Each row has role="listitem"
 *   - Keyboard navigation: ArrowUp/Down moves focus between items
 *   - Home/End jumps to first/last item
 *   - Focus follows scroll position
 *   - scrollToItem() for programmatic scroll (e.g. new messages)
 *
 * Usage:
 *   <VirtualList
 *     items={proposals}
 *     containerHeight={600}
 *     estimateHeight={(item) => estimateTextHeight(item.description, font, width, lineHeight)}
 *     renderItem={(item, index, style) => (
 *       <div style={style}><ProposalCard proposal={item} /></div>
 *     )}
 *     ariaLabel="Proposal list"
 *   />
 */

import { useState, useCallback, useMemo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const VirtualList = forwardRef(function VirtualList({
  items,
  containerHeight,
  estimateHeight,
  renderItem,
  overscan = 5,
  className = '',
  innerClassName = '',
  gap = 0,
  ariaLabel = 'Scrollable list',
  onFocusChange,
}, forwardedRef) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(-1);

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

  // Scroll to a specific item index (for programmatic control)
  const scrollToItem = useCallback((index, position = 'start') => {
    const el = containerRef.current;
    if (!el || index < 0 || index >= items.length) return;

    let targetTop;
    if (position === 'end') {
      targetTop = offsets[index + 1] - containerHeight;
    } else if (position === 'center') {
      targetTop = offsets[index] - (containerHeight - heights[index]) / 2;
    } else {
      targetTop = offsets[index];
    }

    el.scrollTop = Math.max(0, Math.min(targetTop, totalHeight - containerHeight));
  }, [items.length, offsets, heights, containerHeight, totalHeight]);

  // Expose scrollToItem to parent via ref
  useImperativeHandle(forwardedRef, () => ({
    scrollToItem,
    scrollToEnd: () => {
      const el = containerRef.current;
      if (el) el.scrollTop = totalHeight;
    },
    getContainer: () => containerRef.current,
  }), [scrollToItem, totalHeight]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (items.length === 0) return;

    let nextIndex = focusedIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = Math.min(items.length - 1, focusedIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = Math.max(0, focusedIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== focusedIndex) {
      setFocusedIndex(nextIndex);
      scrollToItem(nextIndex, 'center');
      onFocusChange?.(nextIndex, items[nextIndex]);
    }
  }, [items, focusedIndex, scrollToItem, onFocusChange]);

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
    visibleItems.push(renderItem(items[i], i, style, i === focusedIndex));
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={onScroll}
      onKeyDown={handleKeyDown}
      role="list"
      aria-label={ariaLabel}
      aria-rowcount={items.length}
      tabIndex={0}
    >
      <div className={`relative ${innerClassName}`} style={{ height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  );
});

export default VirtualList;

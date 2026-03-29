/**
 * MeasuredAccordion — Smooth expand/collapse with pre-measured heights.
 *
 * Traditional accordions animate to `height: 'auto'`, which forces the browser
 * to render the content, read its height, then animate. This causes:
 *   1. A hidden layout read (reflow) on every open
 *   2. Content flash if the browser can't batch the read + animation
 *
 * MeasuredAccordion uses Pretext to pre-compute the expanded height via
 * OffscreenCanvas — pure arithmetic, no DOM. Framer Motion then animates
 * to the exact pixel value. Result: zero reflow, buttery animation.
 *
 * Usage:
 *   <MeasuredAccordion
 *     isOpen={expanded === id}
 *     text={proposal.description}
 *     font="400 14px Roboto, system-ui, sans-serif"
 *     lineHeight={22}
 *     paddingY={40}
 *   >
 *     <p className="text-sm text-nexus-text-dim">{proposal.description}</p>
 *     <VoteButtons />
 *   </MeasuredAccordion>
 */

import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useAccordionHeight } from '../lib/usePretext.js';

/**
 * @param {{
 *   isOpen: boolean,
 *   text: string,
 *   font?: string,
 *   lineHeight?: number,
 *   paddingY?: number,
 *   containerWidth?: number,
 *   children: React.ReactNode,
 *   className?: string,
 *   contentClassName?: string,
 *   duration?: number,
 * }} props
 */
export default function MeasuredAccordion({
  isOpen,
  text,
  font = '400 14px Roboto, system-ui, sans-serif',
  lineHeight = 22,
  paddingY = 40,
  containerWidth,
  children,
  className = '',
  contentClassName = '',
  duration = 0.25,
}) {
  const { ref, contentHeight } = useAccordionHeight(text, font, lineHeight, {
    paddingY,
    containerWidth,
  });

  return (
    <div ref={ref} className={className}>
      <AnimatePresence initial={false}>
        {isOpen && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: contentHeight || 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className={contentClassName}>
              {children}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

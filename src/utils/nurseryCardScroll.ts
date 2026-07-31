export interface ScrollTargetInput {
  /** The container's current scrollTop. */
  scrollTop: number;
  /** Viewport-relative top of the child being scrolled to. */
  childTop: number;
  /** Viewport-relative top of the scroll container. */
  containerTop: number;
  /** The child's CSS scroll-margin-top; NaN (an unset property) counts as 0. */
  scrollMarginTop: number;
}

/**
 * Scroll offset that brings `child` to the top of its scroll container,
 * leaving its scroll-margin-top as breathing room.
 *
 * Exists so nursery mode can scroll one specific container instead of calling
 * Element.scrollIntoView(), which scrolls every scrollable ancestor. That
 * included `.nursery-stage` — `position: fixed; inset: 0; overflow: hidden`,
 * which is still programmatically scrollable — leaving it permanently offset
 * and exposing the page background as a black bar that never recovered.
 */
export function scrollTargetForChild({
  scrollTop,
  childTop,
  containerTop,
  scrollMarginTop,
}: ScrollTargetInput): number {
  const margin = Number.isNaN(scrollMarginTop) ? 0 : scrollMarginTop;
  return Math.max(0, scrollTop + childTop - containerTop - margin);
}

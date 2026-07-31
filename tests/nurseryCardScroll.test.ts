import { describe, it, expect } from 'vitest';
import { scrollTargetForChild } from '@/src/utils/nurseryCardScroll';

// Nursery mode expands a decision card and needs its header snapped to the top
// of the activity scroller. The previous implementation used
// Element.scrollIntoView(), which scrolls EVERY scrollable ancestor — including
// `.nursery-stage`, a `position: fixed; inset: 0; overflow: hidden` box that is
// still programmatically scrollable. That left the stage permanently offset
// (scrollTop 19.5 observed), exposing the page wrapper's #0a0a1a background as a
// black bar that never recovered. Computing the target ourselves lets us scroll
// only the container that is meant to scroll.

describe('scrollTargetForChild', () => {
  it('returns 0 when the child already sits at the scroll margin', () => {
    // childTop - containerTop === scrollMarginTop, so nothing needs to move
    expect(scrollTargetForChild({ scrollTop: 0, childTop: 26, containerTop: 0, scrollMarginTop: 26 })).toBe(0);
  });

  it('scrolls down by the distance past the scroll margin', () => {
    expect(scrollTargetForChild({ scrollTop: 0, childTop: 300, containerTop: 100, scrollMarginTop: 26 })).toBe(174);
  });

  it('adds to the container current scroll offset', () => {
    expect(scrollTargetForChild({ scrollTop: 150, childTop: 300, containerTop: 100, scrollMarginTop: 26 })).toBe(324);
  });

  it('clamps to 0 rather than returning a negative offset', () => {
    // Child above the container top — scrolling to a negative offset is invalid
    expect(scrollTargetForChild({ scrollTop: 0, childTop: -80, containerTop: 0, scrollMarginTop: 26 })).toBe(0);
  });

  it('honours a zero scroll margin', () => {
    expect(scrollTargetForChild({ scrollTop: 0, childTop: 200, containerTop: 50, scrollMarginTop: 0 })).toBe(150);
  });

  it('treats a NaN scroll margin as zero', () => {
    // getComputedStyle returns '' for an unset property, so parseFloat gives NaN
    expect(scrollTargetForChild({ scrollTop: 0, childTop: 200, containerTop: 50, scrollMarginTop: NaN })).toBe(150);
  });

  it('handles fractional layout values without rounding them away', () => {
    expect(
      scrollTargetForChild({ scrollTop: 19.5, childTop: 278.75, containerTop: 252.75, scrollMarginTop: 26 }),
    ).toBe(19.5);
  });
});

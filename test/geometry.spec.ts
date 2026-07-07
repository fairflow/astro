import { describe, expect, it } from 'vitest';
import { distToSegment } from '../src/render/wheel';

describe('distToSegment', () => {
  it('perpendicular distance to the middle of a segment', () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('distance to the nearest endpoint when beyond the segment', () => {
    expect(distToSegment({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('degenerate segment (a conjunction chord of zero length)', () => {
    expect(distToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });

  it('zero on the segment itself', () => {
    expect(distToSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });
});

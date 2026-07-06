import { describe, expect, it } from 'vitest';
import { fmtDegInSign, fmtOrb } from '../src/render/glyphs';

describe('fmtDegInSign', () => {
  it('formats a plain longitude', () => {
    expect(fmtDegInSign(347.5)).toContain('17°30′');
    expect(fmtDegInSign(347.5)).toContain('Pisces');
  });

  it('never shows 60 minutes — carries into the degree', () => {
    // 23°59.7′ Gemini rounds up to 24°00′, not 23°60′
    expect(fmtDegInSign(60 + 23 + 59.7 / 60)).toContain('24°00′');
  });

  it('carries across a sign boundary', () => {
    // 29°59.8′ Gemini rounds to 0°00′ Cancer
    const s = fmtDegInSign(60 + 29 + 59.8 / 60);
    expect(s).toContain('0°00′');
    expect(s).toContain('Cancer');
  });

  it('carries across 360° back to Aries', () => {
    const s = fmtDegInSign(359 + 59.9 / 60);
    expect(s).toContain('0°00′');
    expect(s).toContain('Aries');
  });
});

describe('fmtOrb', () => {
  it('formats an orb', () => {
    expect(fmtOrb(5.05)).toBe('5°03′');
  });

  it('never shows 60 minutes', () => {
    expect(fmtOrb(4.9999)).toBe('5°00′');
  });
});

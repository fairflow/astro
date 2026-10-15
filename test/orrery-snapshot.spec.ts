import { describe, expect, it } from 'vitest';
import { orrerySnapshot } from '../src/interpret/snapshot.js';

describe('orrerySnapshot', () => {
  const base = {
    date: '15 Oct 2026 14:00 UT', model: 'ephemeris' as const, view: 'earth' as const,
  };

  it('lists each planet with position, motion, elongation and its retrograde spell', () => {
    const md = orrerySnapshot({
      ...base,
      planets: [
        {
          name: 'Mercury', lon: '12°34′ ︎♏ Scorpio', speed: -0.8123, status: 'retrograde', elong: 18.24,
          next: {
            inRetro: true, srDate: '9 Oct 2026 03:12 UT', srLon: '20°01′ ♏ Scorpio',
            sdDate: '30 Oct 2026 11:40 UT', sdLon: '4°55′ ♏ Scorpio', arc: 15.1, days: 21.35,
          },
        },
        { name: 'Venus', lon: '3°10′ ♐ Sagittarius', speed: 1.2, status: 'direct', elong: -40 },
      ],
      events: [{ date: '9 Oct 2026', text: 'Mercury stations retrograde ℞ at 20°01′ ♏ Scorpio' }],
    });

    expect(md).toContain('# Orrery — the sky on 15 Oct 2026 14:00 UT');
    expect(md).toContain('true orbits');
    expect(md).toContain('Earth at the centre');
    // text-presentation selector stripped
    expect(md).not.toContain('︎');
    expect(md).toContain('- Mercury: 12°34′ ♏ Scorpio · retrograde, −0.812°/day · 18.2° east of the Sun (evening sky)');
    expect(md).toContain('Turned retrograde 9 Oct 2026 03:12 UT');
    expect(md).toContain('retrograde arc 15.1° over 21.4 days');
    expect(md).toContain('- Venus: 3°10′ ♐ Sagittarius · direct, +1.200°/day · 40.0° west of the Sun (morning sky)');
    expect(md).toContain('## Recent events (newest first)');
  });

  it('omits the events section when the log is empty and notes the circular model', () => {
    const md = orrerySnapshot({ ...base, model: 'circular', view: 'sun', planets: [], events: [] });
    expect(md).not.toContain('Recent events');
    expect(md).toContain('idealised circular orbits');
    expect(md).toContain('Sun at the centre');
    expect(md).toContain('(none selected)');
  });
});

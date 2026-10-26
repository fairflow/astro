import { describe, expect, it } from 'vitest';
import { orrerySnapshot } from '../src/interpret/snapshot.js';

describe('orrerySnapshot', () => {
  const base = {
    date: '15 Oct 2026 14:00 UT', model: 'ephemeris' as const, view: 'earth' as const, sun: '22°10′ ♎ Libra',
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
    expect(md).toContain('The Sun: 22°10′ ♎ Libra.');
    expect(md).not.toContain('## The Moon');
  });

  // 2026-10-26: asked about the 12 Aug 2026 eclipse, Claude replied that the
  // snapshot had no Moon or eclipse data, and worked the Sun out from Mercury
  it('gives the Moon, the eclipses and a total eclipse\'s central line', () => {
    const md = orrerySnapshot({
      ...base, date: '12 Aug 2026 17:46 UT', sun: '20°02′ ♌ Leo', planets: [], events: [],
      moon: {
        lon: '20°05′ ♌ Leo', lat: 0.2, speed: 15.1, distKm: 366_000, phase: 'New Moon', lit: 0, elong: 0.4,
        waxing: true, age: 0, sunNode: 1.3, quarters: [{ name: 'First Quarter', date: '20 Aug 2026 02:46 UT' }],
        place: 'Greenwich, London',
        lunar: { date: '28 Aug 2026 04:13 UT', kind: 'partial', start: '28 Aug 2026 01:23 UT', end: '28 Aug 2026 07:03 UT', moonAlt: 12, now: false },
        localSolar: { date: '12 Aug 2026 18:13 UT', kind: 'partial', covered: 0.91, sunAlt: 12, start: '12 Aug 2026 17:16 UT', end: '12 Aug 2026 19:07 UT', now: true },
        globalSolar: { date: '12 Aug 2026 17:46 UT', kind: 'total', greatest: '65.2° N, 25.2° W',
          centralLine: [{ time: '16:59:55 UT', at: '75.6° N, 113.8° E' }, { time: '18:32:04 UT', at: '38.9° N, 4.7° E' }] },
      },
    });
    expect(md).toContain('## The Moon');
    expect(md).toContain('- New Moon, 0% lit');
    expect(md).toContain('(eclipse season');
    expect(md).toContain('91% of the Sun\'s disc covered');
    expect(md).toContain('**Under way at the date shown.**');
    expect(md).toContain('- Solar, anywhere on Earth: total, greatest 12 Aug 2026 17:46 UT at 65.2° N, 25.2° W.');
    expect(md).toContain('    - 18:32:04 UT: 38.9° N, 4.7° E');
  });
});

import { describe, expect, it } from 'vitest';
import { houses } from '../src/chart/houses.js';
import { jdUtFromUtc } from '../src/chart/time.js';
import { degDiff } from '../src/ephemeris/types.js';

/**
 * How sensitive are the angles to picking a nearby city from the
 * gazetteer? Brussels vs Sint-Niklaas (~35 km apart) as the reference
 * case: documents the expected error bound of place-list granularity.
 */
const BRUSSELS = { lat: 50.8505, lon: 4.3488 };
const ST_NIKLAAS = { lat: 51.1653, lon: 4.1431 };

describe('gazetteer place granularity: Brussels vs Sint-Niklaas', () => {
  it('ASC/MC differ by well under a degree at every hour of the day', () => {
    let worstAsc = 0, worstMc = 0;
    for (let h = 0; h < 24; h++) {
      const jd = jdUtFromUtc(1961, 12, 3, h, 15);
      const a = houses(jd, BRUSSELS.lat, BRUSSELS.lon);
      const b = houses(jd, ST_NIKLAAS.lat, ST_NIKLAAS.lon);
      worstAsc = Math.max(worstAsc, Math.abs(degDiff(a.asc, b.asc)));
      worstMc = Math.max(worstMc, Math.abs(degDiff(a.mc, b.mc)));
    }
    // eslint-disable-next-line no-console
    console.log(`Brussels vs Sint-Niklaas worst-case: ASC ${worstAsc.toFixed(3)}°, MC ${worstMc.toFixed(3)}°`);
    expect(worstAsc).toBeLessThan(1);
    expect(worstMc).toBeLessThan(0.3);
  });

  it('intermediate cusps stay under a degree too', () => {
    let worst = 0;
    for (let h = 0; h < 24; h += 3) {
      const jd = jdUtFromUtc(1990, 7, 15, h, 0);
      const a = houses(jd, BRUSSELS.lat, BRUSSELS.lon);
      const b = houses(jd, ST_NIKLAAS.lat, ST_NIKLAAS.lon);
      for (let i = 0; i < 12; i++) {
        worst = Math.max(worst, Math.abs(degDiff(a.cusps[i]!, b.cusps[i]!)));
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Brussels vs Sint-Niklaas worst cusp difference: ${worst.toFixed(3)}°`);
    expect(worst).toBeLessThan(1.2);
  });
});

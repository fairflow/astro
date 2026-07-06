import { describe, expect, it } from 'vitest';
import { pairText } from '../src/interpret/templates.js';
import { getBodyIntros, getNatalLibrary } from '../src/interpret/textstore.js';
import { STYLES } from '../src/interpret/types.js';
import type { AspectClass } from '../src/chart/aspects.js';
import type { BodyKey } from '../src/ephemeris/types.js';

/**
 * User-test finding F1: styles must not share sentences, or they read
 * as "the same thing somewhat tweaked". Enforced for every template
 * pair/class, every authored entry, and every body introduction.
 */

const BODIES: BodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'ceres', 'pallas', 'juno',
  'vesta', 'eris', 'meanNode', 'lilith',
];
const CLASSES: AspectClass[] = ['neutral', 'flowing', 'challenge', 'adjusting'];

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 8);
}

function assertDistinct(texts: string[], label: string): void {
  const seen = new Map<string, number>();
  texts.forEach((t, i) => {
    for (const s of sentences(t)) {
      const prev = seen.get(s);
      expect(prev === undefined || prev === i,
        `${label}: sentence shared between styles: "${s}"`).toBe(true);
      seen.set(s, i);
    }
  });
}

describe('styles are genuinely distinct', () => {
  it('template pairText shares no sentence between styles (all pairs, all classes)', () => {
    for (let i = 0; i < BODIES.length; i++) {
      for (let j = i + 1; j < BODIES.length; j++) {
        for (const klass of CLASSES) {
          assertDistinct(
            STYLES.map(s => pairText(BODIES[i]!, BODIES[j]!, klass, s.id)),
            `${BODIES[i]}-${BODIES[j]} ${klass}`,
          );
        }
      }
    }
  });

  it('authored library entries share no sentence between styles', () => {
    for (const [key, entry] of Object.entries(getNatalLibrary())) {
      for (const [klass, texts] of Object.entries(entry)) {
        assertDistinct(STYLES.map(s => texts[s.id]), `${key} ${klass}`);
      }
    }
  });

  it('body introductions exist for every body and differ by style', () => {
    for (const b of BODIES) {
      const intro = getBodyIntros()[b];
      expect(intro, b).toBeDefined();
      if (!intro) continue;
      assertDistinct(STYLES.map(s => intro[s.id]), `intro ${b}`);
      // minimal style is legitimately terse; others should have substance
      for (const s of STYLES) {
        expect(intro[s.id].length).toBeGreaterThan(s.id === 'minimal' ? 20 : 40);
      }
    }
  });
});

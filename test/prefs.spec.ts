import { describe, expect, it } from 'vitest';
import {
  BODY_GROUPS, defaultPrefs, filterAspectDefs, filterBodies,
} from '../src/ui/prefs.svelte.js';
import { transitAspects } from '../src/chart/relate.js';
import { saturnDossier } from '../src/interpret/dossiers.js';
import { computeChart } from '../src/chart/chart.js';
import { CoreProvider } from '../src/ephemeris/core.js';
import { jdUtFromUtc } from '../src/chart/time.js';
import type { ChartPoint } from '../src/chart/aspects.js';

const pt = (body: string, lon: number): ChartPoint =>
  ({ body: body as ChartPoint['body'], state: { lon, lat: 0, speed: 0 } });

describe('calculation prefs (settings)', () => {
  it('defaults enable everything; groups cover all 18 bodies', () => {
    const p = defaultPrefs();
    expect(BODY_GROUPS.flatMap(g => g.bodies)).toHaveLength(18);
    expect(filterBodies(p)).toHaveLength(18);
    expect(filterAspectDefs(p)).toHaveLength(6);
  });

  it('disabling a body removes it; the luminaries cannot be disabled', () => {
    const p = defaultPrefs();
    p.bodies.vesta = false;
    p.bodies.sun = false; // locked — ignored
    const bodies = filterBodies(p);
    expect(bodies).not.toContain('vesta');
    expect(bodies).toContain('sun');
  });

  it('disabling quincunx removes it from natal and transit aspects', () => {
    const p = defaultPrefs();
    p.aspects.quincunx = false;
    const defs = filterAspectDefs(p);
    expect(defs.some(d => d.name === 'quincunx')).toBe(false);
    // transit path honours the enabled-name set
    const hits = transitAspects(
      [pt('saturn', 0)], [pt('venus', 150.5)],
      new Set(defs.map(d => d.name)),
    );
    expect(hits.some(h => h.def.name === 'quincunx')).toBe(false);
    const withQ = transitAspects([pt('saturn', 0)], [pt('venus', 150.5)]);
    expect(withQ.some(h => h.def.name === 'quincunx')).toBe(true);
  });

  it('saturn dossier degrades gracefully when Saturn is disabled', () => {
    const provider = new CoreProvider();
    const chart = computeChart(provider, {
      jdUt: jdUtFromUtc(1975, 3, 8, 14, 30), lat: 51.5, lon: -0.13,
      bodies: ['sun', 'moon', 'venus'],
    });
    const d = saturnDossier(chart, 'minimal');
    expect(d.sections).toHaveLength(1);
    expect(d.sections[0]!.text).toContain('Settings');
  });
});

import type { Chart, ChartPosition } from '../chart/chart.js';
import type { EphemerisProvider } from '../ephemeris/types.js';
import { degDiff, normDeg } from '../ephemeris/types.js';
import { BODY_NAME, SIGN_NAMES, fmtDegInSign } from '../render/glyphs.js';
import { signIndex } from '../render/glyphs.js';
import { modifiersFor, modifierSentence, readingFor } from './composer.js';
import { inHouseText, inSignText, cap } from './templates.js';
import type { StyleId } from './types.js';

/**
 * Themed dossiers (DESIGN.md §8): each gathers a declared set of chart
 * factors and renders them in the selected style. 7a Chiron wound,
 * 7b Saturn's curriculum, 7c Sun–Moon dialogue. (7d relationships and
 * 7e career arrive with synastry in M4.)
 */

export interface DossierSection {
  heading: string;
  text: string;
  source: 'authored' | 'template' | 'computed';
}

export interface Dossier {
  id: string;
  title: string;
  factors: string;
  sections: DossierSection[];
}

function pos(chart: Chart, body: string): ChartPosition | undefined {
  return chart.positions.find(p => p.body === body);
}

const CHIRON_ARC: Record<StyleId, string> = {
  jungian: 'The contemporary reading of Chiron follows the wound → coping → gift arc: an early injury that cannot quite heal becomes, precisely through being tended consciously, the place where one can guide others. The wound is not a fault in the chart; it is the syllabus.',
  mundane: 'Practically: expect the sore point to surface as a recurring life situation rather than an abstract feeling — and expect competence, and eventually a helping role, to grow exactly there.',
  energy: 'Chiron’s ~50-year cycle returns the theme at ages ~50 (the Chiron return) with squares and oppositions marking mid-chapters; each pass reworks the same material at a higher turn of the spiral.',
  minimal: 'Pattern: it hurts, you learn to manage it, you end up teaching it. Standard Chiron arc.',
};

export function chironDossier(chart: Chart, style: StyleId): Dossier {
  const ch = pos(chart, 'chiron');
  const sections: DossierSection[] = [];
  if (!ch) {
    return {
      id: 'chiron', title: 'The Chiron wound',
      factors: 'Chiron by sign, house and aspect',
      sections: [{ heading: 'Not available', text: 'Chiron is not covered at this chart date.', source: 'computed' }],
    };
  }
  sections.push({
    heading: `Chiron in ${SIGN_NAMES[signIndex(ch.lon)]} (${fmtDegInSign(ch.lon)})`,
    text: inSignText('chiron', signIndex(ch.lon), style),
    source: 'template',
  });
  sections.push({
    heading: `House ${ch.house}`,
    text: inHouseText('chiron', ch.house, style),
    source: 'template',
  });
  for (const a of chart.aspects.filter(x => x.a === 'chiron' || x.b === 'chiron').slice(0, 3)) {
    const r = readingFor(a, style);
    sections.push({
      heading: `${BODY_NAME[a.a]} ${a.def.name} ${BODY_NAME[a.b]}`,
      text: r.text,
      source: r.source,
    });
  }
  sections.push({ heading: 'The arc', text: CHIRON_ARC[style], source: 'authored' });
  return {
    id: 'chiron', title: 'The Chiron wound',
    factors: 'Chiron by sign, house and aspects (strongest first)',
    sections,
  };
}

/** Exact Saturn-return dates by scanning the ephemeris from birth. */
export function saturnReturns(
  provider: EphemerisProvider, natalLon: number, jdBirth: number, count = 3,
): number[] {
  const out: number[] = [];
  const step = 15;
  let prev = degDiff(provider.state('saturn', jdBirth + 400).lon, natalLon);
  for (let jd = jdBirth + 400 + step; jd < jdBirth + 100 * 365.25 && out.length < count; jd += step) {
    if (!provider.available('saturn', jd)) break;
    const cur = degDiff(provider.state('saturn', jd).lon, natalLon);
    // Sign change through zero (not the ±180 wrap).
    if (prev < 0 && cur >= 0 && Math.abs(cur - prev) < 90) {
      let lo = jd - step, hi = jd;
      for (let i = 0; i < 25; i++) {
        const mid = (lo + hi) / 2;
        if (degDiff(provider.state('saturn', mid).lon, natalLon) < 0) lo = mid; else hi = mid;
      }
      const hit = (lo + hi) / 2;
      // Retrograde shuffles produce clustered crossings; keep first of each era.
      if (!out.length || hit - out[out.length - 1]! > 3 * 365) out.push(hit);
    }
    prev = cur;
  }
  return out;
}

export function jdToDateString(jd: number): string {
  const ms = (jd - 2440587.5) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

const SATURN_FRAME: Record<StyleId, string> = {
  jungian: 'Saturn marks where the senex archetype examines the personality: the demand is for structure earned from the inside, and what is refused returns as circumstance.',
  mundane: 'Saturn shows where life applies deadlines, bills and gatekeepers — and where patient work compounds into unassailable position.',
  energy: 'Saturn is the slow compression phase of the system: its ~29.5-year cycle times when structures must be rebuilt to carry the next span.',
  minimal: 'Saturn: where the work is. Do it and it pays; defer it and it invoices.',
};

export function saturnDossier(
  chart: Chart, style: StyleId, provider?: EphemerisProvider, jdBirth?: number,
): Dossier {
  const sa = pos(chart, 'saturn');
  if (!sa) {
    return {
      id: 'saturn', title: 'Saturnal teachings',
      factors: 'Saturn (disabled in Settings)',
      sections: [{
        heading: 'Saturn is switched off',
        text: 'Enable Saturn in Settings → Bodies to read this dossier.',
        source: 'computed',
      }],
    };
  }
  const sections: DossierSection[] = [
    { heading: 'The curriculum', text: SATURN_FRAME[style], source: 'authored' },
    {
      heading: `Saturn in ${SIGN_NAMES[signIndex(sa.lon)]} (${fmtDegInSign(sa.lon)})`,
      text: inSignText('saturn', signIndex(sa.lon), style),
      source: 'template',
    },
    {
      heading: `House ${sa.house}`,
      text: inHouseText('saturn', sa.house, style),
      source: 'template',
    },
  ];
  for (const a of chart.aspects.filter(x => (x.a === 'saturn' || x.b === 'saturn')).slice(0, 3)) {
    const r = readingFor(a, style);
    sections.push({
      heading: `${BODY_NAME[a.a]} ${a.def.name} ${BODY_NAME[a.b]}`,
      text: r.text,
      source: r.source,
    });
  }
  if (provider && jdBirth !== undefined) {
    const returns = saturnReturns(provider, sa.lon, jdBirth);
    if (returns.length) {
      sections.push({
        heading: 'Saturn returns',
        text: `Exact (first pass): ${returns.map(jdToDateString).join(' · ')}. Each return closes one curriculum and opens the next; the year around it rewards consolidation over expansion.`,
        source: 'computed',
      });
    }
  }
  return {
    id: 'saturn', title: 'Saturnal teachings',
    factors: 'Saturn by sign, house, aspects; return dates from the ephemeris',
    sections,
  };
}

const PHASE_NAMES = [
  'New Moon', 'Crescent', 'First Quarter', 'Gibbous',
  'Full Moon', 'Disseminating', 'Last Quarter', 'Balsamic',
];

const PHASE_TEXT: Record<StyleId, string[]> = {
  jungian: [
    'conscious and unconscious begin a joint venture — instinctive, self-starting, not yet self-observing',
    'emerging purpose must pull away from the past’s gravity',
    'a crisis of action: structures must be built for the impulse or it dies',
    'refinement — the work is analysed, perfected, made ready to be seen',
    'full illumination: the inner life is visible, relationship becomes the mirror of the psyche',
    'what was realised must now be given away and taught',
    'a crisis of conscience: the system is questioned from inside',
    'the cycle composts itself; the psyche serves something not yet born',
  ],
  mundane: [
    'projects are started on instinct and explained later',
    'momentum builds against early resistance',
    'decisive turning points demand visible commitment',
    'skills are polished for an audience',
    'life is lived in public view and through partnerships',
    'experience converts naturally into teaching and mentoring',
    'established roles are re-evaluated mid-stream',
    'endings and handovers recur; travel light',
  ],
  energy: [
    'the cycle at ignition: maximum instinct, minimum form',
    'rising current working against inertia',
    'first structural stress-test of the waveform',
    'amplitude refined toward peak',
    'peak amplitude: full radiation, full exposure',
    'the wave gives back its energy outward',
    'controlled decay, extracting the usable remainder',
    'the trough that seeds the next wave',
  ],
  minimal: [
    'starter, instinctive, poor at self-explanation',
    'builds momentum against drag',
    'forces decisions; builds or breaks',
    'perfects before showing',
    'lives publicly; needs the mirror of others',
    'natural teacher of what it has lived',
    'questions its own structures midlife',
    'finishes things; travels light',
  ],
};

export function lunationPhase(sunLon: number, moonLon: number):
  { index: number; name: string; waxing: boolean; angle: number } {
  const elong = normDeg(moonLon - sunLon);
  const index = Math.floor(elong / 45) % 8;
  // Waxing from New to Full (0–180°, indices 0–3); waning back to New
  // (180–360°, indices 4–7, beginning with the just-past-full Full Moon phase).
  return { index, name: PHASE_NAMES[index]!, waxing: index < 4, angle: elong };
}

/** One-line phase reading in the chosen register (as shown in the panel). */
export function lunationBlurb(index: number, style: StyleId): string {
  return PHASE_TEXT[style][index] ?? '';
}

export function sunMoonDossier(chart: Chart, style: StyleId): Dossier {
  const sun = pos(chart, 'sun'), moon = pos(chart, 'moon');
  if (!sun || !moon) {
    return {
      id: 'sunmoon', title: 'Sun–Moon dialogue',
      factors: 'Sun and Moon',
      sections: [{
        heading: 'Not available',
        text: 'The luminaries are required for this dossier.',
        source: 'computed',
      }],
    };
  }
  const sections: DossierSection[] = [];

  const aspect = chart.aspects.find(a =>
    (a.a === 'sun' && a.b === 'moon') || (a.a === 'moon' && a.b === 'sun'));
  if (aspect) {
    const r = readingFor(aspect, style);
    sections.push({
      heading: `Sun ${aspect.def.name} Moon`,
      text: r.text,
      source: r.source,
    });
    const mods = modifiersFor(chart, aspect, 3);
    if (mods.length) {
      sections.push({
        heading: 'Modified by',
        text: mods.map(m => modifierSentence(m, style)).join(' '),
        source: 'computed',
      });
    }
  } else {
    const NO_ASPECT: Record<StyleId, string> = {
      jungian: 'What you want to become and what you need to feel safe simply don’t talk to each other much — like two friends who get on fine but only meet when someone books the table. Neither sabotages the other; nothing brings them together automatically either. The work, and it is workable, is making the introductions yourself: asking, before a big choice, "and what does the needing part say?"',
      mundane: 'Ambitions and home life don’t clash here — they just run in different rooms. Left alone, career decisions get made without consulting comfort, and domestic choices without consulting direction. A simple habit fixes most of it: check every big plan once against each.',
      energy: 'The two main currents run side by side without touching: purpose doesn’t drain feeling, feeling doesn’t swamp purpose — and neither recharges the other. Bridging moments (rest scheduled inside ambitions, aims spoken at home) have to be built; once built, they hold.',
      minimal: 'Wants and needs neither help nor block each other. Connect them on purpose or they drift apart quietly.',
    };
    sections.push({
      heading: 'No major Sun–Moon aspect',
      text: NO_ASPECT[style],
      source: 'authored',
    });
  }

  const phase = lunationPhase(sun.lon, moon.lon);
  sections.push({
    heading: `${phase.name} birth — ${phase.waxing ? 'waxing' : 'waning'} `
      + `(Rudhyar-derived reading)`,
    text: cap(PHASE_TEXT[style][phase.index]!) + '.',
    source: 'authored',
  });

  const se = signIndex(sun.lon) % 4, me = signIndex(moon.lon) % 4;
  const harmonious = se === me || (se % 2) === (me % 2);
  const ELEM = ['fire', 'earth', 'air', 'water'];
  sections.push({
    heading: `Elements: ${ELEM[se]} Sun, ${ELEM[me]} Moon`,
    text: se === me
      ? 'Identity and instinct speak the same elemental language — self-agreement comes naturally, blind spots come in matching pairs.'
      : harmonious
        ? 'Compatible elements: the identity and the instincts translate each other without much loss.'
        : 'Uneasy elements: what the identity wants to be and what the instincts reach for are phrased in different languages; the translation work, once done, gives unusual range.',
    source: 'authored',
  });

  return {
    id: 'sunmoon', title: 'Sun–Moon dialogue',
    factors: 'Sun–Moon aspect (and its modifiers), natal lunation phase, elemental relation',
    sections,
  };
}

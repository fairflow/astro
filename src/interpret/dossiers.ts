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

// Fuller lunation-phase readings (8 Rudhyar phases × 4 registers), shown in
// the natal panel and the Sun–Moon dialogue. Each is a self-contained
// sentence or two — capitalised, ending in a full stop.
const PHASE_READING: Record<StyleId, string[]> = {
  jungian: [
    'Born at the New Moon, you begin things from instinct, before you can see them clearly — self and feeling are fused and pointed the same way. The gift is spontaneity; the task is developing the self-observation a New-Moon nature is born without.',
    'A Crescent birth carries a forward push that must fight the gravity of the past and the familiar. Emerging purpose meets inertia — habit, family, old security — and grows only by daring to leave them behind.',
    'A First-Quarter birth meets life as a crisis of action: the impulse now demands structures, and building them means breaking with what came before. Strong-willed and constructive, it grows through decisive turning points, not gradual drift.',
    'A Gibbous birth is driven toward perfection and usefulness — analysing, refining, making the work ready to be seen. The gift is craft and devotion; the shadow is the self-criticism that never lets "good enough" be enough.',
    'Born at the Full Moon, you come to consciousness through relationship — the other is the mirror in which you finally see yourself. Everything is illuminated and objective now; the risk is living entirely through others’ reactions.',
    'A Disseminating birth is here to give away what it has realised — to teach, share, spread the meaning gathered on the way up. Fulfilment comes from transmission; frustration comes from hoarding it.',
    'A Last-Quarter birth meets a crisis of consciousness: the structures it once believed in are questioned from inside, often out of step with its time. The work is reorientation — dismantling an outlived worldview to seed a truer one.',
    'A Balsamic birth lives at the end of a cycle, composting the past to seed a future it may not see — a sense of destiny, endings, and service to something not yet born. It travels light and lets go, and can feel set apart.',
  ],
  mundane: [
    'A New-Moon birth acts first and understands later: projects launch on impulse, identity and mood pull together, and hindsight does the explaining. Best given room to initiate; helped by pausing to ask what it is actually feeling.',
    'Momentum here builds against early resistance — the impulse is real but circumstances (and one’s own caution) drag. Progress comes from mobilising resources and refusing to slide back into what is comfortable.',
    'This is the phase of decisive commitment: build it or it dies. Expect strong will, a taste for turning points, and friction with anything that resists being restructured.',
    'Skills are polished for an audience here: the drive is to contribute something worked-out and useful, and to keep improving it. Watch the perfectionism that delays ever showing the work.',
    'A Full-Moon nature lives in the open and through partnerships: clarity, awareness, and a strong pull toward significant others. Best when the relating serves understanding rather than replacing it.',
    'Experience converts naturally into teaching, mentoring, publishing, campaigning — the drive is to spread a conviction. Watch for preaching; the real gift is genuine transmission.',
    'This phase re-evaluates established roles mid-stream and can feel ideologically out of step with the times. The task is inner reorganisation, not defending the old position.',
    'Endings and handovers recur here; the drive is release and preparation rather than accumulation. Best when it trusts the sense of transition instead of clinging.',
  ],
  energy: [
    'The lunar cycle caught at ignition — maximum instinct, minimum form. Enormous starting energy that has not yet learned to watch itself; direction emerges by doing, not by planning.',
    'The rising current working against inertia — thrust against drag. The signature is effortful build; once the early resistance breaks, the wave gathers speed.',
    'The first structural stress-test of the waveform: the current is high and must be given form or it tears loose. Crisis is the medium; it constructs under pressure.',
    'Amplitude refined toward peak — the wave is nearly full and the work is tuning, not launching. Fine adjustment and rising clarity, with a tendency to overwork.',
    'Peak amplitude: full radiation, full exposure. Maximum illumination and objectivity; the current now turns from building to broadcasting.',
    'The wave giving its energy back outward — distribution, not accumulation. It broadcasts what the earlier phases built.',
    'Controlled decay, extracting the usable remainder as the wave falls. Reorientation under a receding current: letting go of the form while keeping the essence.',
    'The trough that seeds the next wave — minimal amplitude, maximal potential. Dissolution that carries the germ of the cycle to come.',
  ],
  minimal: [
    'New Moon: instinctive starter, self and feeling fused. Strong on beginnings, poor at self-explanation.',
    'Crescent: forward push against the gravity of the past. Grows by leaving the familiar behind.',
    'First Quarter: crisis in action — build structures or lose the impulse. Strong-willed, breaks to build.',
    'Gibbous: perfects before showing; driven to be useful. Watch the self-criticism.',
    'Full Moon: consciousness through relationship; the other is the mirror. Lives publicly.',
    'Disseminating: teaches and spreads what it has lived. Fulfilled by giving it away.',
    'Last Quarter: questions its own structures midlife; often out of step. Reorients from within.',
    'Balsamic: finishes things, travels light; seeds a future it will not fully see.',
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

/** Full lunation-phase reading in the chosen register (panel + dossier). */
export function lunationReading(index: number, style: StyleId): string {
  return PHASE_READING[style][index] ?? '';
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
    text: PHASE_READING[style][phase.index]!,
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

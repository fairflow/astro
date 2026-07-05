import type { Chart, ChartPosition } from '../chart/chart.js';
import type { BodyKey } from '../ephemeris/types.js';
import { BODY_NAME, SIGN_NAMES, fmtDegInSign, signIndex, fmtOrb } from '../render/glyphs.js';
import { houseOf } from '../chart/houses.js';
import {
  CrossAspect, MidpointContact, Overlay,
} from '../chart/relate.js';
import { readingFor } from './composer.js';
import { contextReading } from './contexts.js';
import { inHouseText, inSignText } from './templates.js';
import { HOUSE_ARENA } from './vocab.js';
import type { StyleId } from './types.js';
import type { Dossier, DossierSection } from './dossiers.js';

/**
 * Themes 7d (intimate relationships & compatibility) and 7e (career).
 * Natal capacity first; when a second chart is supplied, 7d extends with
 * synastry inter-aspects, house overlays and Ebertin midpoint contacts.
 */

function pos(chart: Chart, body: BodyKey): ChartPosition | undefined {
  return chart.positions.find(p => p.body === body);
}

const MODERN_RULER: BodyKey[] = [
  'mars', 'venus', 'mercury', 'moon', 'sun', 'mercury',
  'venus', 'pluto', 'jupiter', 'saturn', 'uranus', 'neptune',
];

const CAREER_FRAME: Record<StyleId, string> = {
  jungian: 'Career, read psychologically, is the ego’s negotiation with the collective: the MC shows the summit-image the psyche is climbing toward, its ruler shows how the climb is made, and the 6th and 2nd houses show the daily craft and the sense of worth underneath it.',
  mundane: 'Vocation factors, concretely: the MC and its ruler set the direction, the 10th shows the public role, the 6th the working conditions that suit, the 2nd how income and worth are built, and the North Node the direction that keeps paying long-term.',
  energy: 'The vocational current runs from the 2nd (fuel: worth) through the 6th (throughput: craft) to the 10th (radiation: standing). Blockages show up at whichever stage its ruler is most strained.',
  minimal: 'Direction: MC + ruler. Public role: 10th. Daily work: 6th. Worth/income: 2nd. Growth direction: North Node.',
};

export function careerDossier(chart: Chart, style: StyleId): Dossier {
  const sections: DossierSection[] = [
    { heading: 'How to read this', text: CAREER_FRAME[style], source: 'authored' },
  ];
  const mcSign = signIndex(chart.houses.mc);
  const ruler = MODERN_RULER[mcSign]!;
  const rp = pos(chart, ruler);
  sections.push({
    heading: `MC in ${SIGN_NAMES[mcSign]} (${fmtDegInSign(chart.houses.mc)})`,
    text: `The summit-image is ${SIGN_NAMES[mcSign]}-shaped: ${inSignText(ruler, mcSign, style)}`,
    source: 'template',
  });
  if (rp) {
    sections.push({
      heading: `MC ruler: ${BODY_NAME[ruler]} in house ${rp.house}`,
      text: `${inSignText(ruler, signIndex(rp.lon), style)} ${inHouseText(ruler, rp.house, style)}${rp.speed < 0 ? ' (Retrograde: the vocational drive matures by revisiting rather than by straight advance.)' : ''}`,
      source: 'template',
    });
    const rulerAspect = chart.aspects.find(a => a.a === ruler || a.b === ruler);
    if (rulerAspect) {
      const r = readingFor(rulerAspect, style);
      sections.push({
        heading: `Strongest aspect to the MC ruler: ${BODY_NAME[rulerAspect.a]} ${rulerAspect.def.name} ${BODY_NAME[rulerAspect.b]}`,
        text: r.text, source: r.source,
      });
    }
  }
  for (const h of [10, 6, 2]) {
    const tenants = chart.positions.filter(p => p.house === h);
    if (tenants.length) {
      sections.push({
        heading: `House ${h} tenants: ${tenants.map(t => BODY_NAME[t.body]).join(', ')}`,
        text: `${HOUSE_ARENA[h - 1]!} — carried by ${tenants.map(t => BODY_NAME[t.body]).join(', ')}.`,
        source: 'computed',
      });
    }
  }
  const node = pos(chart, 'meanNode');
  if (node) {
    sections.push({
      heading: `North Node in ${SIGN_NAMES[signIndex(node.lon)]}, house ${node.house} (modern usage)`,
      text: inHouseText('meanNode', node.house, style),
      source: 'template',
    });
  }
  return {
    id: 'career', title: 'Career dynamics',
    factors: 'MC sign + ruler and its condition, 10th/6th/2nd tenants, North Node; Saturn is covered in its own dossier',
    sections,
  };
}

const REL_FRAME: Record<StyleId, string> = {
  jungian: 'Intimacy factors: the Moon shows what safety feels like, Venus how love is valued and received, Mars how desire asserts, the 7th house the partner-image carried (and projected), the 8th what deep merging costs and pays, and Juno the shape of committed partnership.',
  mundane: 'Practically: Moon = domestic compatibility, Venus = affection style and taste, Mars = conflict and desire style, 7th = the kind of partner repeatedly chosen, 8th = money/intimacy entanglements, Juno = what the marriage-like bond needs to hold.',
  energy: 'The relational circuit: lunar intake, Venusian attraction, Martial pursuit — with the 7th and 8th as the coupling stages where two systems connect and merge. Signal quality at each stage sets what partnerships can carry.',
  minimal: 'Moon: needs. Venus: affection. Mars: desire/conflict. 7th: chosen partner type. 8th: merging. Juno: commitment terms.',
};

export interface SynastryInput {
  otherName: string;
  cross: CrossAspect[];
  overlays: Overlay[];
  midpoints: MidpointContact[];
}

export function relationshipsDossier(
  chart: Chart, style: StyleId, syn?: SynastryInput,
): Dossier {
  const sections: DossierSection[] = [
    { heading: 'How to read this', text: REL_FRAME[style], source: 'authored' },
  ];
  for (const body of ['moon', 'venus', 'mars', 'juno'] as BodyKey[]) {
    const p = pos(chart, body);
    if (!p) continue;
    sections.push({
      heading: `${BODY_NAME[body]} in ${SIGN_NAMES[signIndex(p.lon)]}, house ${p.house}`,
      text: `${inSignText(body, signIndex(p.lon), style)} ${inHouseText(body, p.house, style)}`,
      source: 'template',
    });
  }
  const seventhSign = signIndex(chart.houses.cusps[6]!);
  sections.push({
    heading: `7th house cusp in ${SIGN_NAMES[seventhSign]}`,
    text: style === 'minimal'
      ? `Partner-image: ${SIGN_NAMES[seventhSign]} qualities are sought (or provoked) in others.`
      : `The descendant carries a ${SIGN_NAMES[seventhSign]} partner-image: these qualities are sought in others — and, until owned, projected onto them.`,
    source: 'template',
  });
  const relAspect = chart.aspects.find(a =>
    ['venus', 'mars', 'moon', 'juno'].includes(a.a) && ['venus', 'mars', 'moon', 'juno'].includes(a.b));
  if (relAspect) {
    const r = readingFor(relAspect, style);
    sections.push({
      heading: `Key natal contact: ${BODY_NAME[relAspect.a]} ${relAspect.def.name} ${BODY_NAME[relAspect.b]}`,
      text: r.text, source: r.source,
    });
  }

  if (syn) {
    sections.push({
      heading: `Synastry with ${syn.otherName}`,
      text: style === 'minimal'
        ? 'Cross-aspects below, strongest first. Both readings are true at once; contradictions are structural.'
        : 'The strongest inter-chart contacts follow. Where they contradict each other, both are real — relationships run on exactly such simultaneous truths.',
      source: 'authored',
    });
    for (const x of syn.cross.slice(0, 4)) {
      const r = contextReading(x, style, 'synastry');
      sections.push({
        heading: `${BODY_NAME[x.a]} ${x.def.name} ${BODY_NAME[x.b]} (orb ${fmtOrb(x.orb)})`,
        text: r.text, source: r.source,
      });
    }
    const relevant = syn.overlays.filter(o =>
      ['sun', 'moon', 'venus', 'mars', 'juno'].includes(o.body) && [1, 5, 7, 8].includes(o.house));
    if (relevant.length) {
      sections.push({
        heading: 'House overlays',
        text: relevant.map(o =>
          `Their ${BODY_NAME[o.body]} falls in your ${o.house}th house (${HOUSE_ARENA[o.house - 1]}).`).join(' '),
        source: 'computed',
      });
    }
    if (syn.midpoints.length) {
      const m = syn.midpoints[0]!;
      sections.push({
        heading: 'Midpoint contacts (Ebertin)',
        text: `${syn.midpoints.slice(0, 3).map(x =>
          `Their ${BODY_NAME[x.body]} sits on your ${BODY_NAME[x.pair[0]]}/${BODY_NAME[x.pair[1]]} midpoint (dial orb ${fmtOrb(x.orb)})`).join('; ')}. Midpoint contacts mark where one person plugs directly into the *combination* of two of the other's principles — ${BODY_NAME[m.pair[0]]}/${BODY_NAME[m.pair[1]]} being the strongest here.`,
        source: 'computed',
      });
    }
  }

  return {
    id: 'relationships', title: 'Intimate relationships',
    factors: 'Moon, Venus, Mars, Juno by sign/house; 7th cusp; key natal contact'
      + (syn ? `; synastry with ${syn.otherName}: cross-aspects, overlays, midpoint contacts` : ' (select a partner chart for synastry)'),
    sections,
  };
}

export function overlayHouse(lon: number, cusps: number[]): number {
  return houseOf(lon, cusps);
}

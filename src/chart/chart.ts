import {
  ASTEROIDS, BodyKey, EclipticState, EphemerisProvider, PLANETS, POINTS,
} from '../ephemeris/types.js';
import { CoreProvider } from '../ephemeris/core.js';
import { ChainProvider, ChebPack, ChebProvider } from '../ephemeris/chebyshev.js';
import { HouseSystem, Houses, houseOf, houses } from './houses.js';
import { Aspect, AspectOptions, findAspects } from './aspects.js';

export interface ChartInput {
  jdUt: number;
  /** Geographic latitude, degrees north. */
  lat: number;
  /** Geographic longitude, degrees east. */
  lon: number;
  bodies?: BodyKey[];
  houseSystem?: HouseSystem;
  aspectOptions?: AspectOptions;
}

export interface ChartPosition extends EclipticState {
  body: BodyKey;
  house: number;
}

export interface Chart {
  jdUt: number;
  positions: ChartPosition[];
  houses: Houses;
  aspects: Aspect[];
  /** Bodies requested but not covered by the provider at this date. */
  missing: BodyKey[];
}

export const DEFAULT_BODIES: BodyKey[] = [...PLANETS, ...ASTEROIDS, ...POINTS];

/** App-default provider: astronomy-engine core + Chebyshev asteroid packs. */
export function defaultProvider(packs: ChebPack[]): EphemerisProvider {
  const cheb = new ChebProvider();
  for (const p of packs) cheb.add(p);
  return new ChainProvider([new CoreProvider(), cheb]);
}

export function computeChart(provider: EphemerisProvider, input: ChartInput): Chart {
  const wanted = input.bodies ?? DEFAULT_BODIES;
  const hs = houses(input.jdUt, input.lat, input.lon, input.houseSystem ?? 'placidus');

  const positions: ChartPosition[] = [];
  const missing: BodyKey[] = [];
  for (const body of wanted) {
    if (!provider.available(body, input.jdUt)) {
      missing.push(body);
      continue;
    }
    const state = provider.state(body, input.jdUt);
    positions.push({ body, ...state, house: houseOf(state.lon, hs.cusps) });
  }

  const aspects = findAspects(
    positions.map(p => ({ body: p.body, state: p })),
    input.aspectOptions,
  );
  return { jdUt: input.jdUt, positions, houses: hs, aspects, missing };
}

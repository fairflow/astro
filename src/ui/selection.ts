import type { BodyKey } from '../ephemeris/types.js';

export type Selection =
  | { kind: 'none' }
  | { kind: 'aspect'; key: string }
  | { kind: 'body'; body: BodyKey }
  | { kind: 'sign'; index: number }
  | { kind: 'house'; num: number };

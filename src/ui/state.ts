import type { SavedPlace, TimeAccuracy } from '../store/db.js';

export interface FormState {
  name: string;
  date: string;
  time: string;
  accuracy: TimeAccuracy;
  place: SavedPlace | null;
}

export interface ChartMeta extends Omit<FormState, 'place'> {
  place: SavedPlace;
  offsetMinutes: number;
}

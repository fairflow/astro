import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DISPLAY, WHEEL_SIZE_MAX, WHEEL_SIZE_MIN, loadDisplay } from '../src/ui/state.js';

function withStored(value: unknown) {
  const store = new Map<string, string>([['astro-display', JSON.stringify(value)]]);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
}

describe('display settings: wheel size', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('settings saved before the wheel-size option get the default', () => {
    withStored({ glyphScale: 1.5 });
    const d = loadDisplay();
    expect(d.wheelSize).toBe(DEFAULT_DISPLAY.wheelSize);
    expect(d.glyphScale).toBe(1.5);
  });

  it('a stored size is kept, and clamped to the slider range', () => {
    withStored({ wheelSize: 820 });
    expect(loadDisplay().wheelSize).toBe(820);
    withStored({ wheelSize: 5000 });
    expect(loadDisplay().wheelSize).toBe(WHEEL_SIZE_MAX);
    withStored({ wheelSize: 10 });
    expect(loadDisplay().wheelSize).toBe(WHEEL_SIZE_MIN);
    withStored({ wheelSize: 'big' });
    expect(loadDisplay().wheelSize).toBe(DEFAULT_DISPLAY.wheelSize);
  });
});

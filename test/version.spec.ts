import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildStamp } from '../buildstamp';

const root = resolve(__dirname, '..');
const json = (f: string) => JSON.parse(readFileSync(resolve(root, f), 'utf8'));

describe('version alignment', () => {
  it('package.json and package-lock.json carry the same version', () => {
    const v = json('package.json').version;
    const lock = json('package-lock.json');
    expect(lock.version).toBe(v);
    expect(lock.packages[''].version).toBe(v);
  });

  it('the build id is <version>+<5-hex commit>, marked when built from uncommitted changes', () => {
    const s = buildStamp(root);
    expect(s.version).toBe(json('package.json').version);
    expect(s.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(s.id).toBe(`${s.version}+${s.hash.slice(0, 5)}${s.dirty ? '.dirty' : ''}`);
  });

  it('the service worker still has the VERSION line the build stamps', () => {
    // swVersionStamp (vite.config.ts) rewrites this line; if it vanished the
    // cache key would silently stop following deploys
    expect(readFileSync(resolve(root, 'data/sw.js'), 'utf8')).toMatch(/const VERSION = '[^']*';/);
  });
});

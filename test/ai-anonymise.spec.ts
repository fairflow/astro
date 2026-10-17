import { describe, expect, it } from 'vitest';
import { redact } from '../src/ai/anonymise.js';

describe('redact', () => {
  it('replaces names and withholds places, leaving the astrology intact', () => {
    const snap = [
      '# Synastry — Alice × Bob',
      '## Alice (positions, house)',
      '- Sun: 23°40′ Pisces, H11',
      '## Bob (positions, house)',
      '- Moon: 5°12′ Cancer, H3 ℞',
      "## Inter-aspects (strongest first; synastry orbs)",
      "- Alice's Sun conjunction Bob's Moon (orb 1°20′)",
      'Born in London, United Kingdom',
    ].join('\n');

    const out = redact(snap, [
      { find: 'Alice', replace: 'Person A' },
      { find: 'Bob', replace: 'Person B' },
      { find: 'London', replace: '[location withheld]' },
      { find: 'United Kingdom', replace: '[country withheld]' },
    ]);

    expect(out).not.toContain('Alice');
    expect(out).not.toContain('Bob');
    expect(out).not.toContain('London');
    expect(out).toContain('Person A');
    expect(out).toContain('Person B');
    expect(out).toContain('[location withheld]');
    // the factors survive
    expect(out).toContain('23°40′ Pisces, H11');
    expect(out).toContain("Person A's Sun conjunction Person B's Moon");
  });

  it('applies the longest find first so substrings cannot pre-empt', () => {
    // "Jo" is a substring of "Joanna": longest-first must win.
    const out = redact('Joanna met Jo today.', [
      { find: 'Jo', replace: 'X' },
      { find: 'Joanna', replace: 'Person A' },
    ]);
    expect(out).toBe('Person A met X today.');
  });

  it('ignores blank finds and no-op replacements', () => {
    const out = redact('Person A and Sun', [
      { find: '', replace: 'nope' },
      { find: 'Person A', replace: 'Person A' }, // identity, skipped
    ]);
    expect(out).toBe('Person A and Sun');
  });

  it('treats finds literally, not as regex', () => {
    const out = redact('name is a.b (test)', [
      { find: 'a.b', replace: 'REDACTED' },
    ]);
    // a regex would also match "aXb"; literal must only match "a.b"
    expect(out).toBe('name is REDACTED (test)');
  });
});

import { aiAvailable } from '../src/ai/config';

describe('Ask Claude shows only where the Worker accepts the page', () => {
  const url = 'https://astro-ai.example.workers.dev';
  const origins = ['https://fairflow.co.uk', 'http://localhost:8322'];
  it('allowed origins get the panel', () => {
    expect(aiAvailable(url, origins, 'https://fairflow.co.uk')).toBe(true);
    expect(aiAvailable(url, origins, 'http://localhost:8322')).toBe(true);
  });
  it('other copies (GitHub Pages, a claude.ai artifact) do not', () => {
    expect(aiAvailable(url, origins, 'https://projects.fairflow.co.uk')).toBe(false);
    expect(aiAvailable(url, origins, 'null')).toBe(false);
    expect(aiAvailable(url, origins, undefined)).toBe(false);
  });
  it('no Worker URL: never; no origin list: anywhere', () => {
    expect(aiAvailable('', origins, 'https://fairflow.co.uk')).toBe(false);
    expect(aiAvailable(url, [], 'https://anywhere.example')).toBe(true);
  });
});

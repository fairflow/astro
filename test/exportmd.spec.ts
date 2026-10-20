import { describe, expect, it } from 'vitest';
import { readingsMarkdown } from '../src/api/exportmd.js';

describe('readingsMarkdown', () => {
  it('lists readings with title, UTC date, question and text, noting partial or unhidden ones', () => {
    const md = readingsMarkdown('me@example.com', '2026-10-20T12:00:00+00:00', [
      { title: 'Natal · A', question: 'Core personality sketch', text: '  **Bold** start.\n', createdAt: Date.UTC(2026, 9, 1, 9, 5), anonymised: true },
      { title: 'Synastry · A × B', question: 'Strengths', text: 'Half', createdAt: Date.UTC(2026, 9, 2), anonymised: false, stopped: true, interrupted: true },
    ]);
    expect(md).toContain('# Astrodynamics readings\n\nAccount: me@example.com  \nExported: 2026-10-20T12:00:00+00:00  \nReadings: 2\n');
    expect(md).toContain('## Natal · A\n\n*1 October 2026 at 09:05 UTC*\n\n**Question:** Core personality sketch\n\n**Bold** start.\n');
    expect(md).toContain('*2 October 2026 at 00:00 UTC* · names and places were sent · interrupted before the end');
    expect(md.match(/^---$/gm)).toHaveLength(2);
  });

  it('handles no readings', () => {
    expect(readingsMarkdown('me@example.com', 'now', [])).toBe('# Astrodynamics readings\n\nAccount: me@example.com  \nExported: now  \nReadings: 0\n');
  });
});

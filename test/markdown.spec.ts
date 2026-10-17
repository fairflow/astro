import { describe, expect, it } from 'vitest';
import { renderMarkdown as md } from '../src/ai/markdown.js';

describe('renderMarkdown', () => {
  it('renders headings (shifted down one level), paragraphs and emphasis', () => {
    const html = md('# Title\n\n## Section\n\nSome **bold** and *italic* text\nacross two lines.');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<h3>Section</h3>');
    expect(html).toContain('<p>Some <strong>bold</strong> and <em>italic</em> text across two lines.</p>');
  });

  it('renders bullet and numbered lists, with one level of nesting', () => {
    const html = md('- **Benita:** first\n- second\n  - nested\n\n1. one\n2. two');
    expect(html).toContain('<ul><li><strong>Benita:</strong> first</li><li>second</li><li class="sub">nested</li></ul>');
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>');
  });

  it('renders rules, quotes, code and http(s) links', () => {
    const html = md('---\n> a quote\n\nuse `x < y` and [docs](https://example.com/a?b=1&c=2)');
    expect(html).toContain('<hr>');
    expect(html).toContain('<blockquote>a quote</blockquote>');
    expect(html).toContain('<code>x &lt; y</code>');
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">docs</a>');
  });

  it('cannot inject markup or script', () => {
    const html = md('<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[click](javascript:alert(3))\n\n**<b>x</b>**');
    expect(html).not.toMatch(/<script|<img|<b>|href="javascript/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('[click](javascript:alert(3))'); // left as plain text
    expect(html).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
  });

  it('leaves arithmetic, snake_case and unclosed markers alone', () => {
    expect(md('5 * 3 = 15')).toBe('<p>5 * 3 = 15</p>');
    expect(md('a snake_case_name')).toBe('<p>a snake_case_name</p>');
    // mid-stream: an unclosed bold shows as typed until it closes
    expect(md('half **bold')).toBe('<p>half **bold</p>');
  });

  it('renders GitHub-style tables, with alignment and inline formatting in cells', () => {
    const html = md([
      'Approximate values:',
      '',
      '| Planet | Synodic period (approx.) | Retrograde frequency |',
      '|---|:---:|--:|',
      '| **Mars** | ~780 days | About every 2 years |',
      '| Jupiter | ~399 days | `yearly` |',
      '| Saturn | ~378 days |',
      '',
      'After.',
    ].join('\n'));
    expect(html).toContain('<p>Approximate values:</p>');
    expect(html).toContain('<thead><tr><th>Planet</th><th style="text-align:center">Synodic period (approx.)</th>'
      + '<th style="text-align:right">Retrograde frequency</th></tr></thead>');
    expect(html).toContain('<tr><td><strong>Mars</strong></td><td style="text-align:center">~780 days</td>');
    expect(html).toContain('<td style="text-align:right"><code>yearly</code></td>');
    // a short row is padded to the header's width
    expect(html).toContain('<tr><td>Saturn</td><td style="text-align:center">~378 days</td><td style="text-align:right"></td></tr>');
    expect(html.match(/<tr>/g)).toHaveLength(4);
    expect(html).toContain('<p>After.</p>');
  });

  it('tables: outer pipes optional, escaped pipes kept, no injection through cells', () => {
    const html = md('a | b\n--- | ---\nx \\| y | <script>alert(1)</script>');
    expect(html).toContain('<th>a</th><th>b</th>');
    expect(html).toContain('<td>x | y</td>');
    expect(html).not.toMatch(/<script/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('a pipe without a separator row, or a bare rule, is not a table', () => {
    expect(md('this | that')).toBe('<p>this | that</p>');
    expect(md('a | b\n---')).toBe('<p>a | b</p>\n<hr>');
    expect(md('| a | b |\n|---|---|---|')).not.toContain('<table>'); // column counts differ
  });
});

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
});

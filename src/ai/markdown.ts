/**
 * A small, safe Markdown renderer for Claude's readings.
 *
 * Safe by construction: every piece of text is HTML-escaped first, and the
 * only markup ever generated is a fixed set of tags (h2–h4, p, ul/ol/li,
 * strong, em, code, blockquote, hr, table parts, and <a> for http(s) links
 * only; the only attribute values are fixed strings or a checked URL). Nothing
 * in a reading can inject its own markup or script. (No sanitiser library:
 * DOMPurify is not MIT-licensed, and this project bundles only MIT code.)
 *
 * Covers what readings actually use: headings, paragraphs, bold/italic,
 * bullet and numbered lists (one level of nesting), quotes, rules, tables
 * (GitHub style, with column alignment), inline code and links. Anything
 * else simply shows as plain text.
 */

const esc = (s: string): string => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Inline formatting on already-escaped text. */
function inline(s: string): string {
  // protect code spans from the other rules
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c: string) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  // links: http(s) only, so no javascript: or data: URLs
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, t: string, u: string) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>');
  // single * or _ emphasis; not "5 * 3", not snake_case
  s = s.replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

const fmt = (s: string) => inline(esc(s));

/** Cells of a table row: outer pipes optional, `\|` is a literal pipe. */
function cells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
  return t.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

type Align = '' | 'left' | 'center' | 'right';

/** The alignments if `line` is a table's separator row (|---|:--:|--:|), else null. */
function separator(line: string): Align[] | null {
  if (!line.includes('|') && !line.includes(':')) return null; // a bare --- is a rule
  const cs = cells(line);
  if (!cs.length || !cs.every(c => /^:?-+:?$/.test(c))) return null;
  return cs.map(c => c.startsWith(':') && c.endsWith(':') ? 'center'
    : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : '');
}

function table(head: string[], aligns: Align[], body: string[][]): string {
  const n = head.length;
  const cell = (tag: 'th' | 'td', text: string, i: number) =>
    `<${tag}${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${fmt(text)}</${tag}>`;
  const row = (tag: 'th' | 'td', cs: string[]) =>
    `<tr>${Array.from({ length: n }, (_, i) => cell(tag, cs[i] ?? '', i)).join('')}</tr>`;
  return `<div class="tablewrap"><table><thead>${row('th', head)}</thead>`
    + `<tbody>${body.map(r => row('td', r)).join('')}</tbody></table></div>`;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let quote: string[] = [];
  // `as` keeps TS from narrowing to null: the flush helpers reassign it
  let list = null as { type: 'ul' | 'ol'; items: { text: string; sub: boolean }[] } | null;

  const flushPara = () => { if (para.length) { out.push(`<p>${fmt(para.join(' '))}</p>`); para = []; } };
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${fmt(quote.join(' '))}</blockquote>`); quote = []; } };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map(i => `<li${i.sub ? ' class="sub"' : ''}>${fmt(i.text)}</li>`).join('');
    out.push(`<${list.type}>${items}</${list.type}>`);
    list = null;
  };
  const flushAll = () => { flushPara(); flushQuote(); flushList(); };
  const addItem = (type: 'ul' | 'ol', text: string, indent: string) => {
    flushPara(); flushQuote();
    // a nested item keeps the outer list; only a top-level item can switch type
    if (!list || (list.type !== type && indent.length < 2)) { flushList(); list = { type, items: [] }; }
    list.items.push({ text, sub: indent.length >= 2 });
  };

  for (let k = 0; k < lines.length; k++) {
    const raw = lines[k]!;
    const line = raw.trimEnd();
    if (!line.trim()) { flushAll(); continue; }
    let m: RegExpExecArray | null;
    const aligns = line.includes('|') && k + 1 < lines.length ? separator(lines[k + 1]!) : null;
    if (aligns && cells(line).length === aligns.length) {
      // a table: header row, separator row, then |-rows up to a blank or pipe-less line
      flushAll();
      const body: string[][] = [];
      k += 2;
      while (k < lines.length && lines[k]!.trim() && lines[k]!.includes('|')) body.push(cells(lines[k++]!));
      k--;
      out.push(table(cells(line), aligns, body));
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flushAll();
      const level = Math.min(4, m[1]!.length + 1); // # → h2 inside the panel
      out.push(`<h${level}>${fmt(m[2]!.replace(/\s+#+\s*$/, ''))}</h${level}>`);
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll(); out.push('<hr>');
    } else if ((m = /^(\s*)[-*+]\s+(.*)$/.exec(line))) {
      addItem('ul', m[2]!, m[1]!);
    } else if ((m = /^(\s*)\d+[.)]\s+(.*)$/.exec(line))) {
      addItem('ol', m[2]!, m[1]!);
    } else if ((m = /^\s*>\s?(.*)$/.exec(line))) {
      flushPara(); flushList(); quote.push(m[1]!);
    } else if (list && /^\s+\S/.test(raw)) {
      // an indented line with no marker continues the last list item
      const last = list.items[list.items.length - 1]!;
      last.text += ' ' + line.trim();
    } else {
      flushList(); flushQuote(); para.push(line.trim());
    }
  }
  flushAll();
  return out.join('\n');
}

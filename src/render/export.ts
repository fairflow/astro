/**
 * Wheel export (issue #5): 'Export wheel' = a shareable SVG/PNG snapshot
 * of the wheel at the current display settings — deliberately distinct
 * from saved charts (birth data, recomputed on load).
 */

const SVGNS = 'http://www.w3.org/2000/svg';

/** Every custom property declared on any :root rule, with its current
 *  effective value (theme classes + skin overrides already applied). */
function collectRootVars(): Record<string, string> {
  const names = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && r.selectorText.includes(':root')) {
        for (const p of Array.from(r.style)) {
          if (p.startsWith('--')) names.add(p);
        }
      }
    }
  }
  const cs = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = cs.getPropertyValue(n).trim();
    if (v) out[n] = v;
  }
  return out;
}

/**
 * Standalone SVG markup for a wheel: glyph <symbol>s inlined (they live
 * in the separate GlyphDefs svg), theme variables resolved onto the root
 * element, and a solid background rect added.
 */
export function wheelSvgMarkup(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVGNS);
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('width', String(vb.width));
  clone.setAttribute('height', String(vb.height));

  // inline every referenced glyph symbol
  const defs = document.createElementNS(SVGNS, 'defs');
  const seen = new Set<string>();
  clone.querySelectorAll('use').forEach(u => {
    const id = (u.getAttribute('href') ?? '').slice(1);
    if (id && !seen.has(id)) {
      const el = document.getElementById(id);
      if (el) {
        defs.appendChild(el.cloneNode(true));
        seen.add(id);
      }
    }
  });

  // solid backdrop (the app page normally provides the background)
  const bg = document.createElementNS(SVGNS, 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', 'var(--bg)');
  clone.insertBefore(bg, clone.firstChild);
  clone.insertBefore(defs, bg);

  // resolve the current theme/skin variables onto the root element
  for (const [k, v] of Object.entries(collectRootVars())) {
    clone.style.setProperty(k, v);
  }
  // interactive-only affordances make no sense in a static file
  clone.querySelectorAll('.aspect-hit, .aspect-hit-dot').forEach(el => el.remove());

  return new XMLSerializer().serializeToString(clone);
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportWheelSvg(svg: SVGSVGElement, basename: string): void {
  const markup = wheelSvgMarkup(svg);
  download(new Blob([markup], { type: 'image/svg+xml' }), `${basename}.svg`);
}

export async function exportWheelPng(
  svg: SVGSVGElement, basename: string, scale = 2,
): Promise<void> {
  const markup = wheelSvgMarkup(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG rasterisation failed'));
      img.src = url;
    });
    const vb = svg.viewBox.baseVal;
    const canvas = document.createElement('canvas');
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    if (blob) download(blob, `${basename}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** File-safe basename from a caption line, e.g. "wheel-benita-2026-07-06". */
export function wheelBasename(who: string | undefined): string {
  const slug = (who ?? 'chart').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'chart';
  return `wheel-${slug}-${new Date().toISOString().slice(0, 10)}`;
}

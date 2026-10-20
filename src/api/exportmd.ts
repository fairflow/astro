/**
 * "Download my data" as Markdown (astro-tbb.5): the account's readings, oldest
 * first, each under its title and date with the question asked. The JSON
 * download carries everything; this is the readable copy.
 */

interface ExportReading {
  title?: string; question?: string; text?: string; createdAt?: number;
  stopped?: boolean; interrupted?: boolean; anonymised?: boolean;
}

const day = (ms: number) => new Date(ms).toLocaleString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
}) + ' UTC';

export function readingsMarkdown(email: string, exportedAt: string, readings: ExportReading[]): string {
  const head = `# Astrodynamics readings\n\nAccount: ${email}  \nExported: ${exportedAt}  \n`
    + `Readings: ${readings.length}\n`;
  const body = readings.map(r => {
    const notes = [
      r.anonymised === false ? 'names and places were sent' : '',
      r.interrupted ? 'interrupted before the end' : r.stopped ? 'stopped before the end' : '',
    ].filter(Boolean);
    return `\n---\n\n## ${r.title ?? 'Reading'}\n\n*${r.createdAt ? day(r.createdAt) : 'undated'}*`
      + `${notes.length ? ` · ${notes.join(' · ')}` : ''}\n\n**Question:** ${r.question ?? ''}\n\n${(r.text ?? '').trim()}\n`;
  });
  return head + body.join('');
}

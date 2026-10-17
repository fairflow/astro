import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * One build identity for the app and the standalone Retrograde page, so the
 * two can be checked against each other and against the source commit.
 *
 *   version  package.json "version"
 *   hash     full commit hash ('' outside a git checkout, e.g. a tarball)
 *   short    first 5 hex of the hash, git's front-truncation convention
 *   date     commit date, 'YYYY-MM-DD HH:MM'
 *   dirty    tracked files differ from the commit (a local build that no
 *            commit reproduces); untracked files do not count
 *   id       '<version>+<short>' with '.dirty' appended when dirty: shown
 *            on both pages and written to dist/version.json
 */
export interface BuildStamp {
  version: string; hash: string; short: string; date: string; dirty: boolean; id: string;
}

const sh = (cmd: string) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();

export function buildStamp(root: string): BuildStamp {
  const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version as string;
  let hash = '', date = '', dirty = false;
  try {
    hash = sh('git rev-parse HEAD');
    date = sh("git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M'");
    dirty = sh('git status --porcelain --untracked-files=no') !== '';
  } catch { /* not a git checkout */ }
  const short = hash.slice(0, 5);
  const id = `${version}${short ? `+${short}` : ''}${dirty ? '.dirty' : ''}`;
  return { version, hash, short, date, dirty, id };
}

/** Compile-time constants for Vite's `define` (declared in src/vite-env.d.ts). */
export function stampDefines(s: BuildStamp): Record<string, string> {
  return {
    __APP_VERSION__: JSON.stringify(s.version),
    __GIT_HASH__: JSON.stringify(s.hash),
    __GIT_DATE__: JSON.stringify(s.date),
    __BUILD_ID__: JSON.stringify(s.id),
  };
}

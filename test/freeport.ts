// A TCP port free right now on 127.0.0.1, chosen by the operating system, for
// the tests' `php -S` servers. Random ports in a fixed range clashed with other
// local servers (2026-10-20: Python servers on 8770-8901 made a suite fail
// when a test's PHP server could not bind and another server answered).
import { spawnSync } from 'node:child_process';

export function freePort(): number {
  const r = spawnSync(process.execPath, ['-e',
    "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{process.stdout.write(String(s.address().port));s.close()})"],
  { encoding: 'utf8' });
  const port = Number(r.stdout);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`no free port: ${r.stderr}`);
  return port;
}

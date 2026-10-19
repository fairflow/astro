"""Run the server API's account commands on the host, without typing its SSH details.

Uses the SSH login in the [ssh] table of the deploy secrets file (as
tools/deploy_sftp.py does) and prints only the commands' output. Passwords
for new accounts are asked for here, hidden, and passed to the server on
standard input: never stored, never on a command line.

  .venv/bin/python tools/host_account.py --secrets PATH migrate
  .venv/bin/python tools/host_account.py --secrets PATH list
  .venv/bin/python tools/host_account.py --secrets PATH add EMAIL        (asks for the password twice)
  .venv/bin/python tools/host_account.py --secrets PATH passwd EMAIL     (asks for the new password twice)
  .venv/bin/python tools/host_account.py --secrets PATH admin EMAIL
  .venv/bin/python tools/host_account.py --secrets PATH state EMAIL active|paused|frozen|pending
  .venv/bin/python tools/host_account.py --secrets PATH mail-test EMAIL

Run from the repo root (it imports tools/deploy_sftp.py).
"""
import argparse
import getpass
import re
import shlex
import sys

sys.path.insert(0, 'tools')
from deploy_sftp import connect  # noqa: E402

API = '~/fairflow.co.uk/astro/api'
EMAIL = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def run(client, cmd: str, stdin: str | None = None) -> int:
    chan_in, out, err = client.exec_command(cmd, timeout=60)
    if stdin is not None:
        chan_in.write(stdin)
        chan_in.channel.shutdown_write()
    text, errs = out.read().decode(), err.read().decode()
    if text:
        print(text, end='')
    if errs:
        print(errs, end='', file=sys.stderr)
    return out.channel.recv_exit_status()


def new_password() -> str:
    pw = getpass.getpass('New account password (10 to 72 characters): ')
    if getpass.getpass('Again: ') != pw:
        sys.exit('The two passwords differ.')
    return pw


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--secrets', required=True, help='deploy secrets file with an [ssh] table')
    ap.add_argument('command', choices=['migrate', 'list', 'add', 'passwd', 'admin', 'state', 'mail-test'])
    ap.add_argument('args', nargs='*')
    a = ap.parse_args()

    needs_email = a.command in ('add', 'passwd', 'admin', 'state', 'mail-test')
    if needs_email and (not a.args or not EMAIL.match(a.args[0])):
        sys.exit(f'Give an email address: {a.command} you@example.com')
    if a.command == 'state' and (len(a.args) < 2 or a.args[1] not in ('active', 'paused', 'frozen', 'pending')):
        sys.exit('state EMAIL active|paused|frozen|pending')

    stdin = new_password() + '\n' if a.command in ('add', 'passwd') else None
    q = [shlex.quote(x) for x in a.args]
    cmd = {
        'migrate': f'php {API}/cli/migrate.php',
        'list': f'php {API}/cli/user.php list',
        'add': f'php {API}/cli/user.php add {q[0] if q else ""}',
        'passwd': f'php {API}/cli/user.php passwd {q[0] if q else ""}',
        'admin': f'php {API}/cli/user.php admin {q[0] if q else ""}',
        'state': f'php {API}/cli/user.php state {" ".join(q[:2])}',
        'mail-test': f'php {API}/cli/mail_test.php {q[0] if q else ""}',
    }[a.command]

    client = connect(a.secrets)
    try:
        code = run(client, cmd, stdin)
    if code == 255:
        print('PHP stopped with an error on the host (details go to its error log). '
              'If the database has not been set up yet, run "migrate" first.', file=sys.stderr)
    sys.exit(code)
    finally:
        client.close()


if __name__ == '__main__':
    main()

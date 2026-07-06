#!/usr/bin/env python3
"""Deploy dist/ to a shared host over SFTP.

Credentials are NEVER stored in this repo: pass a TOML file containing an
[ssh] table (host, port, username, password) — e.g. a .streamlit/secrets.toml.

Usage:
  .venv/bin/python tools/deploy_sftp.py \
      --secrets ~/path/to/secrets.toml \
      --remote /home/USER/site.example/astro [--delete]

Uploads the contents of dist/ into --remote (created if missing).
--delete removes remote files that no longer exist locally (stale hashed
assets); it only ever deletes inside --remote.
"""
import argparse
import pathlib
import posixpath
import stat
import sys
import tomllib

import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def connect(secrets_path: str) -> paramiko.SSHClient:
    with open(pathlib.Path(secrets_path).expanduser(), "rb") as f:
        cfg = tomllib.load(f)["ssh"]
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=cfg["host"], port=int(cfg.get("port", 22)),
        username=cfg["username"], password=cfg.get("password") or None,
        timeout=30,
    )
    return client


def ensure_dir(sftp: paramiko.SFTPClient, remote: str) -> None:
    parts = remote.strip("/").split("/")
    path = ""
    for p in parts:
        path += "/" + p
        try:
            sftp.stat(path)
        except FileNotFoundError:
            sftp.mkdir(path)


def remote_files(sftp: paramiko.SFTPClient, base: str) -> set[str]:
    found: set[str] = set()

    def walk(d: str) -> None:
        for entry in sftp.listdir_attr(d):
            p = posixpath.join(d, entry.filename)
            if stat.S_ISDIR(entry.st_mode or 0):
                walk(p)
            else:
                found.add(posixpath.relpath(p, base))

    walk(base)
    return found


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--secrets", required=True)
    ap.add_argument("--remote", required=True, help="absolute remote directory")
    ap.add_argument("--delete", action="store_true")
    args = ap.parse_args()

    if not (DIST / "index.html").exists():
        sys.exit("dist/index.html missing — run `npm run build` first")

    client = connect(args.secrets)
    sftp = client.open_sftp()
    ensure_dir(sftp, args.remote)

    local = sorted(p for p in DIST.rglob("*") if p.is_file())
    uploaded = 0
    for p in local:
        rel = p.relative_to(DIST).as_posix()
        dest = posixpath.join(args.remote, rel)
        ensure_dir(sftp, posixpath.dirname(dest))
        sftp.put(str(p), dest)
        uploaded += 1
    print(f"uploaded {uploaded} files to {args.remote}")

    if args.delete:
        keep = {p.relative_to(DIST).as_posix() for p in local}
        stale = remote_files(sftp, args.remote) - keep
        for rel in sorted(stale):
            sftp.remove(posixpath.join(args.remote, rel))
        print(f"removed {len(stale)} stale files")

    sftp.close()
    client.close()


if __name__ == "__main__":
    main()

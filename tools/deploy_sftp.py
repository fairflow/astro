#!/usr/bin/env python3
"""Deploy dist/ to a shared host over SFTP.

Credentials are NEVER stored in this repo: they come from a TOML file with an
[ssh] table (host, port, username, password), by default
~/.config/fairflow/hosting.toml (the Krystal hosting account's login, readable
only by its owner); --secrets names another.

Usage:
  .venv/bin/python tools/deploy_sftp.py \
      --remote /home/USER/site.example/astro [--delete] [--secrets PATH]

Uploads the contents of dist/ into --remote (created if missing), skipping
files whose content the host already has: --remote/.deploy-manifest.json
records each uploaded file's SHA-256, and only files that differ from it are
sent (--all sends everything). --delete removes remote files that no longer
exist locally (stale hashed assets); it only ever deletes inside --remote.
"""
import argparse
import hashlib
import json
import pathlib
import posixpath
import stat
import sys
import tomllib

import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


DEFAULT_SECRETS = "~/.config/fairflow/hosting.toml"
MANIFEST = ".deploy-manifest.json"


def connect(secrets_path: str = DEFAULT_SECRETS) -> paramiko.SSHClient:
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


_made: set[str] = set()


def ensure_dir(sftp: paramiko.SFTPClient, remote: str) -> None:
    parts = remote.strip("/").split("/")
    path = ""
    for p in parts:
        path += "/" + p
        if path in _made:
            continue
        try:
            sftp.stat(path)
        except FileNotFoundError:
            sftp.mkdir(path)
        _made.add(path)


def read_manifest(sftp: paramiko.SFTPClient, remote: str) -> dict[str, str]:
    """What the host has, by SHA-256; {} when there is no manifest (or it is unreadable)."""
    try:
        with sftp.open(posixpath.join(remote, MANIFEST)) as f:
            got = json.loads(f.read())
        return got if isinstance(got, dict) else {}
    except (OSError, ValueError):
        return {}


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
    ap.add_argument("--secrets", default=DEFAULT_SECRETS, help=f"default {DEFAULT_SECRETS}")
    ap.add_argument("--remote", required=True, help="absolute remote directory")
    ap.add_argument("--delete", action="store_true")
    ap.add_argument("--all", action="store_true", help="upload every file, whatever the manifest says")
    args = ap.parse_args()

    if not (DIST / "index.html").exists():
        sys.exit("dist/index.html missing — run `npm run build` first")

    client = connect(args.secrets)
    sftp = client.open_sftp()
    ensure_dir(sftp, args.remote)

    local = sorted(p for p in DIST.rglob("*") if p.is_file())
    have = {} if args.all else read_manifest(sftp, args.remote)
    now: dict[str, str] = {}
    uploaded = 0
    for p in local:
        rel = p.relative_to(DIST).as_posix()
        now[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
        if have.get(rel) == now[rel]:
            continue
        dest = posixpath.join(args.remote, rel)
        ensure_dir(sftp, posixpath.dirname(dest))
        sftp.put(str(p), dest)
        uploaded += 1
    # written after the uploads, so an interrupted deploy re-sends what it may have missed
    with sftp.open(posixpath.join(args.remote, MANIFEST), "w") as f:
        f.write(json.dumps(now, separators=(",", ":")))
    print(f"uploaded {uploaded} files to {args.remote} ({len(local) - uploaded} unchanged, skipped)")

    if args.delete:
        keep = {p.relative_to(DIST).as_posix() for p in local} | {MANIFEST}
        stale = remote_files(sftp, args.remote) - keep
        for rel in sorted(stale):
            sftp.remove(posixpath.join(args.remote, rel))
        print(f"removed {len(stale)} stale files")

    sftp.close()
    client.close()


if __name__ == "__main__":
    main()

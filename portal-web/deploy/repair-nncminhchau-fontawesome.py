#!/usr/bin/env python3
"""Repair only malformed Font Awesome hrefs in the Minh Chau LIVE theme.

Dry-run by default. Never edits GitHub templates or tenant configuration.
Usage:
    python3 portal-web/deploy/repair-nncminhchau-fontawesome.py
    python3 portal-web/deploy/repair-nncminhchau-fontawesome.py --apply
"""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil

ROOT = Path("/opt/portal-live/templates")
CSS_URL = "/portal.tuonghoa-imex.com/fontawesome/css/all.min.css"
HREF = re.compile(r'(?P<name>\b(?:th:)?href)\s*=\s*(?P<quote>["\'])(?P<value>.*?)(?P=quote)', re.IGNORECASE)
# Regex is deliberately restricted to attribute values that reference the
# Font Awesome target and visibly contain an unrendered domain expression.


def fix_one(path: Path, apply: bool) -> int:
    original = path.read_text(encoding="utf-8")
    edits = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal edits
        value = match.group("value")
        if "fontawesome/css/all.min.css" not in value:
            return match.group(0)
        if "${domain}" not in value and "%7Bdomain%7D" not in value:
            return match.group(0)
        edits += 1
        return f'{match.group("name")}="{CSS_URL}"'

    corrected = HREF.sub(replace, original)
    if not edits:
        return 0
    print(f'{"APPLY" if apply else "DRY-RUN"}: {path}: {edits} malformed href(s)')
    if apply:
        suffix = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = path.with_name(path.name + ".bak." + suffix)
        shutil.copy2(path, backup)
        path.write_text(corrected, encoding="utf-8")
        print(f"  Backup: {backup}")
    return edits


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Back up and apply a targeted fix")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    shared = args.root / "nncminhchau.html"
    theme = args.root / "nncminhchau.vn"
    files = ([shared] if shared.is_file() else [])
    if theme.is_dir():
        files.extend(sorted(theme.rglob("*.html")))
    changed = sum(fix_one(path, args.apply) for path in files)
    print(f"Checked {len(files)} HTML file(s); found {changed} malformed Font Awesome href(s).")
    if not changed:
        print("No matching malformed URL found; check the browser page source and current live files.")


if __name__ == "__main__":
    main()

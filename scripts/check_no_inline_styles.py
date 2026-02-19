#!/usr/bin/env python
"""Fail when inline style attributes exist in Django templates."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "poshapp" / "templates"
STYLE_ATTR_RE = re.compile(r"\bstyle\s*=", re.IGNORECASE)


def main() -> int:
    failures: list[tuple[str, int]] = []
    for path in sorted(TEMPLATES_DIR.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        count = len(STYLE_ATTR_RE.findall(text))
        if count:
            failures.append((path.relative_to(ROOT).as_posix(), count))

    if failures:
        total = sum(count for _, count in failures)
        print("Inline style attributes are still present:", file=sys.stderr)
        for rel, count in failures:
            print(f"  {rel}: {count}", file=sys.stderr)
        print(f"Total inline style attributes: {total}", file=sys.stderr)
        return 1

    print("No inline style attributes found in poshapp/templates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

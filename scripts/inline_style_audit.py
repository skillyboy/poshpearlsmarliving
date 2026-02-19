#!/usr/bin/env python
"""Generate a markdown inventory of inline style attributes in templates."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "poshapp" / "templates"
OUTPUT_FILE = ROOT / "docs" / "inline-style-inventory.md"
STYLE_ATTR_RE = re.compile(r"\bstyle\s*=", re.IGNORECASE)


def scan() -> tuple[int, list[tuple[str, int]]]:
    rows: list[tuple[str, int]] = []
    total = 0
    for path in sorted(TEMPLATES_DIR.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        count = len(STYLE_ATTR_RE.findall(text))
        if count:
            rel = path.relative_to(ROOT).as_posix()
            rows.append((rel, count))
            total += count
    rows.sort(key=lambda item: (-item[1], item[0]))
    return total, rows


def write_markdown(total: int, rows: list[tuple[str, int]]) -> None:
    lines = [
        "# Inline Style Inventory",
        "",
        f"- Template root: `{TEMPLATES_DIR.relative_to(ROOT).as_posix()}`",
        f"- Files with inline styles: `{len(rows)}`",
        f"- Total inline `style=` attributes: `{total}`",
        "",
        "## Per-file Breakdown",
        "",
        "| File | Inline `style=` Count |",
        "|---|---:|",
    ]
    for path, count in rows:
        lines.append(f"| `{path}` | {count} |")
    lines.append("")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    total, rows = scan()
    write_markdown(total, rows)
    print(f"Wrote {OUTPUT_FILE.relative_to(ROOT)}")
    print(f"Files with inline styles: {len(rows)}")
    print(f"Total inline style attributes: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

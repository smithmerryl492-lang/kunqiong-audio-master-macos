#!/usr/bin/env python3
"""Utilities for screenshot-manual workflow.

Subcommands:
- capture-plan
- capture-snippet
- verify-screenshots
- render-html
"""

from __future__ import annotations

import argparse
import json
import sys
from html import escape
from pathlib import Path
from typing import Any, Dict, List


def _load_manifest(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    required_top = ["project_title", "manual_subtitle", "base_url", "intro", "items"]
    for key in required_top:
        if key not in data:
            raise ValueError(f"Missing top-level key in manifest: {key}")
    if not isinstance(data["items"], list) or not data["items"]:
        raise ValueError("manifest.items must be a non-empty array")
    for idx, item in enumerate(data["items"], start=1):
        for key in ["category", "title", "url", "screenshot", "description", "steps"]:
            if key not in item:
                raise ValueError(f"manifest.items[{idx}] missing key: {key}")
        if not isinstance(item["steps"], list) or not item["steps"]:
            raise ValueError(f"manifest.items[{idx}].steps must be non-empty array")
    return data


def _full_url(base_url: str, route: str) -> str:
    if route.startswith("http://") or route.startswith("https://"):
        return route
    if not route.startswith("/"):
        route = "/" + route
    return base_url.rstrip("/") + route


def cmd_capture_plan(manifest: Dict[str, Any]) -> int:
    base_url = manifest["base_url"]
    plan = []
    for item in manifest["items"]:
        plan.append(
            {
                "category": item["category"],
                "title": item["title"],
                "url": _full_url(base_url, item["url"]),
                "screenshot": item["screenshot"],
            }
        )
    print(json.dumps(plan, ensure_ascii=False, indent=2))
    return 0


def cmd_capture_snippet(manifest: Dict[str, Any], out_dir: str) -> int:
    base_url = manifest["base_url"]
    plan = []
    for item in manifest["items"]:
        plan.append(
            {
                "url": _full_url(base_url, item["url"]),
                "screenshot": item["screenshot"],
            }
        )

    out_dir = out_dir.replace("\\", "/").rstrip("/")
    plan_json = json.dumps(plan, ensure_ascii=False, indent=2)

    snippet = f"""async (page) => {{
  const out = "{out_dir}";
  const plan = {plan_json};

  await page.setViewportSize({{ width: 1366, height: 768 }});

  async function go(url) {{
    await page.goto(url, {{ waitUntil: 'domcontentloaded', timeout: 60000 }});
    for (let i = 0; i < 20; i++) {{
      const c = await page.getByText('Loading...').count();
      if (c === 0) break;
      await page.waitForTimeout(600);
    }}
    await page.waitForTimeout(500);
  }}

  const done = [];
  for (const item of plan) {{
    await go(item.url);
    await page.screenshot({{
      path: `${{out}}/${{item.screenshot}}`,
      type: 'png'
    }});
    done.push(item.screenshot);
  }}
  return done;
}}"""
    print(snippet)
    return 0


def cmd_verify_screenshots(manifest: Dict[str, Any], screenshot_dir: Path) -> int:
    missing = []
    for item in manifest["items"]:
        shot = screenshot_dir / item["screenshot"]
        if not shot.exists():
            missing.append(str(shot))

    if missing:
        print("Missing screenshots:")
        for m in missing:
            print(f"- {m}")
        return 2

    print(f"[OK] all screenshots exist ({len(manifest['items'])} files)")
    return 0


def _build_toc(manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
    if "toc" in manifest and isinstance(manifest["toc"], list) and manifest["toc"]:
        return manifest["toc"]

    # fallback: auto-toc by categories
    categories: Dict[str, int] = {}
    for idx, item in enumerate(manifest["items"], start=4):
        categories.setdefault(item["category"], idx)

    auto = [{"title": "一、引言", "page": 3, "sub": [{"title": "（一）编写目的", "page": 3}, {"title": "（二）运行环境", "page": 3}]}]
    section_no = 2
    for cat, page in categories.items():
        auto.append({"title": f"{section_no}、{cat} 功能说明", "page": page, "sub": []})
        section_no += 1
    return auto


def _toc_lines_html(toc: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    for block in toc:
        lines.append(
            f'<p class="toc-item"><span class="name">{escape(str(block["title"]))}</span><span class="leader"></span><span class="page-num">{escape(str(block["page"]))}</span></p>'
        )
        for sub in block.get("sub", []):
            lines.append(
                f'<p class="toc-item sub"><span class="name">{escape(str(sub["title"]))}</span><span class="leader"></span><span class="page-num">{escape(str(sub["page"]))}</span></p>'
            )
    return "\n        ".join(lines)


def _feature_pages_html(items: List[Dict[str, Any]]) -> str:
    pages: List[str] = []
    start_page = 4
    for idx, item in enumerate(items, start=1):
        page_no = start_page + idx - 1
        heading = '<h2 class="section-title">四、操作说明</h2>' if idx == 1 else ""
        steps_html = "".join([f"<li>{escape(str(step))}</li>" for step in item["steps"]])
        page = f"""
  <section class="page">
    <div class="inner">
      {heading}
      <h3 class="func-title">（{idx}）【{escape(str(item['category']))}】{escape(str(item['title']))}</h3>
      <p class="desc">{escape(str(item['description']))}</p>
      <ol class="steps">
        {steps_html}
      </ol>
      <img class="shot" src="./screenshots/{escape(str(item['screenshot']))}" alt="{escape(str(item['category']))}-{escape(str(item['title']))}" />
    </div>
    <div class="page-no">第 {page_no} 页</div>
  </section>"""
        pages.append(page)
    return "\n".join(pages)


def cmd_render_html(manifest: Dict[str, Any], output: Path) -> int:
    toc = _build_toc(manifest)
    intro = manifest["intro"]
    items = manifest["items"]

    intro_steps = "".join([f"<li>{escape(str(step))}</li>" for step in intro["quick_steps"]])
    toc_html = _toc_lines_html(toc)
    feature_html = _feature_pages_html(items)

    html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{escape(str(manifest.get("manual_title", "软件使用说明书")))}</title>
  <style>
    html, body {{ margin: 0; padding: 0; background: #fff; color: #222; font-family: SimSun, "Songti SC", "宋体", serif; }}
    .page {{ width: 595.3pt; height: 841.9pt; margin: 0 auto; position: relative; page-break-after: always; overflow: hidden; background: #fff; }}
    .page:last-child {{ page-break-after: auto; }}
    .inner {{ position: absolute; left: 90pt; right: 90pt; top: 74pt; }}
    .cover-title {{ position: absolute; left: 0; right: 0; top: 322pt; text-align: center; font-size: 38px; line-height: 1.55; font-weight: 400; }}
    .toc-title {{ text-align: center; font-size: 30px; line-height: 1.3; margin: 0 0 14pt; font-weight: 400; }}
    .toc-list {{ margin-top: 8pt; }}
    .toc-item {{ display: flex; align-items: flex-end; font-size: 24px; line-height: 1.8; margin: 0; }}
    .toc-item.sub {{ padding-left: 28pt; font-size: 21px; line-height: 1.75; }}
    .toc-item .name {{ white-space: nowrap; margin-right: 8pt; }}
    .toc-item .leader {{ flex: 1; border-bottom: 3px dotted #111; margin: 0 8pt 7pt 0; min-width: 20pt; }}
    .toc-item .page-num {{ width: 18pt; text-align: right; white-space: nowrap; }}
    h2.section-title {{ margin: 0 0 10pt; font-size: 30px; line-height: 1.35; font-weight: 600; }}
    h3.func-title {{ margin: 0 0 10pt; font-size: 24px; line-height: 1.35; font-weight: 600; }}
    p.lead {{ margin: 0 0 10pt; font-size: 18px; line-height: 1.9; }}
    p.desc {{ margin: 0 0 8pt; font-size: 18px; line-height: 1.8; }}
    ol.steps {{ margin: 0 0 10pt 22pt; padding: 0; font-size: 17px; line-height: 1.75; }}
    .shot {{ width: 415pt; max-height: 470pt; object-fit: contain; border: none; display: block; margin-top: 8pt; }}
    .page-no {{ position: absolute; bottom: 28pt; left: 0; right: 0; text-align: center; font-size: 14px; color: #444; }}
    .split {{ height: 1px; background: #444; margin: 14pt 0; opacity: 0.35; }}
  </style>
</head>
<body>
  <section class="page">
    <div class="cover-title">
      <div>{escape(str(manifest["project_title"]))}</div>
      <div>{escape(str(manifest["manual_subtitle"]))}</div>
    </div>
  </section>

  <section class="page">
    <div class="inner">
      <h2 class="toc-title">目录</h2>
      <div class="toc-list">
        {toc_html}
      </div>
    </div>
    <div class="page-no">第 2 页</div>
  </section>

  <section class="page">
    <div class="inner">
      <h2 class="section-title">{escape(str(intro["title"]))}</h2>
      <p class="lead">{escape(str(intro["purpose"]))}</p>

      <h2 class="section-title" style="font-size: 26px;">{escape(str(intro["env_title"]))}</h2>
      <p class="lead">{escape(str(intro["env_text"]))}</p>

      <h2 class="section-title" style="font-size: 26px;">{escape(str(intro["quick_title"]))}</h2>
      <ol class="steps">
        {intro_steps}
      </ol>

      <div class="split"></div>
      <p class="desc">{escape(str(intro["overview_caption"]))}</p>
      <img class="shot" src="./screenshots/{escape(str(intro["overview_screenshot"]))}" alt="overview" />
    </div>
    <div class="page-no">第 3 页</div>
  </section>

{feature_html}
</body>
</html>
"""

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    print(f"[OK] rendered html -> {output}")
    print(f"[OK] feature pages: {len(items)}")
    print(f"[OK] expected total pages: {3 + len(items)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Manual workflow utilities")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_plan = sub.add_parser("capture-plan", help="Print screenshot capture plan JSON")
    p_plan.add_argument("--manifest", required=True, type=Path)

    p_snippet = sub.add_parser("capture-snippet", help="Print Playwright MCP browser_run_code snippet")
    p_snippet.add_argument("--manifest", required=True, type=Path)
    p_snippet.add_argument("--out-dir", required=True)

    p_verify = sub.add_parser("verify-screenshots", help="Verify all manifest screenshots exist")
    p_verify.add_argument("--manifest", required=True, type=Path)
    p_verify.add_argument("--screenshot-dir", required=True, type=Path)

    p_render = sub.add_parser("render-html", help="Render standardized manual HTML from manifest")
    p_render.add_argument("--manifest", required=True, type=Path)
    p_render.add_argument("--output", required=True, type=Path)

    args = parser.parse_args()
    manifest = _load_manifest(args.manifest)

    if args.cmd == "capture-plan":
        return cmd_capture_plan(manifest)
    if args.cmd == "capture-snippet":
        return cmd_capture_snippet(manifest, args.out_dir)
    if args.cmd == "verify-screenshots":
        return cmd_verify_screenshots(manifest, args.screenshot_dir)
    if args.cmd == "render-html":
        return cmd_render_html(manifest, args.output)

    print(f"Unknown command: {args.cmd}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

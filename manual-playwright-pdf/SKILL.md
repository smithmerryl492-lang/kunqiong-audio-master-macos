---
name: manual-playwright-pdf
description: Generate or update a standardized software user manual by automating Playwright MCP screenshots, rendering a fixed-format HTML manual, and exporting PDF. Use this skill when users ask for “说明书/用户手册” generation with strict format consistency, “每个功能页都要截图+配文”, ToC dotted-leader layout, HTML-to-PDF conversion, or cleanup/rebuild of previous manual artifacts.
---

# manual-playwright-pdf

## Overview
Use this skill to produce a repeatable manual pipeline:
1) capture screenshots for all manifest routes, 2) render standardized HTML, 3) export PDF, 4) verify completeness.

## Required Inputs
- Use `references/kq-tools-manual-manifest.json` as the single source of truth.
- Keep screenshot/output paths consistent:
  - screenshots: `docs/full_manual_assets/screenshots/`
  - html: `docs/full_manual_assets/manual_full.html`
  - pdf: `docs/开发者工具集全功能使用说明书.pdf` and `docs/kq-tools-full-function-manual.pdf`

If the user asks to change wording/layout/ToC style, update manifest fields or HTML styles via the render script, not ad-hoc per-page edits.

## Formatting Rules
Read `references/format-spec.md` before rendering.

Non-negotiable rules:
- Use A4 portrait pages.
- Keep ToC as `title + dotted leader + page number` style.
- Keep feature section heading `四、操作说明` only once (first feature page).
- Ensure one screenshot and one matching usage description block per feature item.
- Cover all routes listed in the manifest.

## Workflow

### Step 1: Prepare Folders
Run:

```powershell
New-Item -ItemType Directory -Force -Path e:\Projects\kq-tools\docs\full_manual_assets\screenshots | Out-Null
```

### Step 2: Start App
Run:

```powershell
Start-Process -FilePath cmd.exe -ArgumentList '/c','cd /d e:\Projects\kq-tools && npm run start -- --port 3200'
```

Confirm `http://127.0.0.1:3200` is reachable before capture.

### Step 3: Capture All Screenshots with Playwright MCP
Generate a ready-to-run `browser_run_code` snippet:

```powershell
python C:\Users\admin\.codex\skills\manual-playwright-pdf\scripts\manifest_utils.py capture-snippet ^
  --manifest C:\Users\admin\.codex\skills\manual-playwright-pdf\references\kq-tools-manual-manifest.json ^
  --out-dir e:/Projects/kq-tools/docs/full_manual_assets/screenshots
```

Copy the emitted JS into Playwright MCP `browser_run_code`.

### Step 4: Verify Screenshot Completeness
Run:

```powershell
python C:\Users\admin\.codex\skills\manual-playwright-pdf\scripts\manifest_utils.py verify-screenshots ^
  --manifest C:\Users\admin\.codex\skills\manual-playwright-pdf\references\kq-tools-manual-manifest.json ^
  --screenshot-dir e:\Projects\kq-tools\docs\full_manual_assets\screenshots
```

If missing files exist, recapture only missing pages.

### Step 5: Render HTML
Run:

```powershell
python C:\Users\admin\.codex\skills\manual-playwright-pdf\scripts\manifest_utils.py render-html ^
  --manifest C:\Users\admin\.codex\skills\manual-playwright-pdf\references\kq-tools-manual-manifest.json ^
  --output e:\Projects\kq-tools\docs\full_manual_assets\manual_full.html
```

### Step 6: Preview and Export PDF
Serve HTML:

```powershell
python -m http.server 39006 -d e:\Projects\kq-tools\docs\full_manual_assets
```

Use Playwright MCP:
- Navigate to `http://127.0.0.1:39006/manual_full.html`
- Export PDF with:
  - `docs/开发者工具集全功能使用说明书.pdf`
  - `docs/kq-tools-full-function-manual.pdf`

### Step 7: Validate PDF
Check pages/file size via local script or quick Python check. Confirm page count = `3 + number_of_manifest_items`.

## Update Policy
- To add/remove feature pages, edit manifest `items`.
- To update ToC text/page labels, edit manifest `toc`.
- To adjust typography/layout, update renderer styles in `scripts/manifest_utils.py`.
- Never manually duplicate per-page heading blocks in rendered HTML.

## Resources

### scripts/
- `scripts/manifest_utils.py`
  - `capture-plan`: print route/screenshot plan
  - `capture-snippet`: print Playwright MCP `browser_run_code` snippet
  - `verify-screenshots`: assert all expected screenshots exist
  - `render-html`: build standardized manual HTML from manifest

### references/
- `references/format-spec.md`: fixed formatting constraints
- `references/kq-tools-manual-manifest.json`: route + copy + ToC source of truth

### assets/
- `assets/capture_snippet.template.js`: fallback snippet template for manual editing

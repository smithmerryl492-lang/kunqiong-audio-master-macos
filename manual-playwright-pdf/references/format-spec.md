# Manual Format Spec

Apply these constraints when generating manuals with this skill.

## Page Structure
- Use A4 portrait pages.
- Keep page order:
  1. Cover
  2. ToC
  3. Intro / environment / quick steps
  4..N feature pages

## ToC Style
- Use rows formatted as:
  - left: title
  - middle: dotted leader
  - right: page number
- Keep support for sub-rows (indented one level).

## Feature Page Rules
- Keep one feature page per manifest item.
- Keep screenshot and text matched by item key.
- Show heading `四、操作说明` only once (first feature page only).
- Use feature title format: `（n）【分类】功能名`.

## Screenshot Rules
- Capture all URLs listed in manifest.
- Use consistent viewport (`1366x768` recommended).
- Save exactly with manifest screenshot filenames.

## Output Rules
- Render HTML from manifest via script.
- Export two PDF filenames:
  - Chinese delivery filename
  - ASCII fallback filename
- Validate expected page count = `3 + feature_item_count`.

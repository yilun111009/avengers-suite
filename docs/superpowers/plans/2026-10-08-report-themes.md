# Report Themes (1.5.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each hero's report, and the `/assemble` team page, a look of its own: an accent colour (light and dark), a small SVG emblem, a coloured header band and one tagline. Everything else in a report stays as it is.

**Architecture:** A new `engine/themes.mjs` owns all theme logic: the front-matter parser (moved out of `check-onboarding.mjs` so there is one copy), hex validation, WCAG contrast maths, the fixed emblem set, and `themeFor(name, pluginDir) -> { css, bandHtml } | null`. Twelve theme files in `themes/` hold four fields each. `build-report.mjs` and `build-assemble.mjs` import `themeFor` and add its CSS after their own styles and its band around the `<h1>`. Preflight validates every theme. A report with no `hero`, an unknown hero or a broken theme renders byte-for-byte as it does now.

**Tech Stack:** Node.js ESM scripts, `node:test`, Markdown skills. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-report-themes-design.md` (all sections). Builds on 1.4.0 (`main` at `95eb490`).

## Global Constraints

- `agents/repo-avengers.md` is not edited. The theme never enters the agent's prompt.
- Skills write only to `docs/flows/**` and `.claude/avengers-hints.md`.
- Theme file format (four fields, no body): `name`, `accent`, `accentDark`, `emblem`, `tagline`. `name` equals the file name and matches `^[a-z0-9-]+$`.
- Colours: **only** `#rrggbb` (six hex digits, `^#[0-9a-fA-F]{6}$`). Anything else is rejected before it can reach CSS.
- Emblem names (the fixed set, exactly these 12): `fist`, `hammer`, `shield`, `portal`, `suit`, `bow`, `web`, `widow`, `gauntlet`, `ant`, `scepter`, `eye`. A theme file never supplies SVG.
- Tagline: one line, 1 to 100 characters, HTML-escaped when rendered.
- Contrast (hard rule): `accent` vs `#ffffff` and `#f6f8fa`, and `accentDark` vs `#0d1117` and `#161b22`, each at least **4.5**. The band's title colour is `#ffffff` or `#111111`, whichever has the higher ratio against the accent, and that ratio is at least **4.5**.
- Distinctness (warning, not failure): two coloured themes whose light accents are within 12 degrees of hue. A theme with saturation below 0.1 is exempt.
- The 12 shipped themes use exactly the values in section 3.3 of the spec (already tested for contrast and hue spread).
- `themeFor` reads only `themes/<name>.md` and only when `name` matches `^[a-z0-9-]+$`; otherwise it returns `null` without touching the disk.
- The report JSON gains one optional field, `hero`. Old reports without it must render byte-for-byte as before.
- Version after this plan: `1.5.0`, with its own CHANGELOG section above 1.4.0.
- Working copies are CRLF here (`core.autocrlf=true`). Tests that read repo files normalise `\r\n` to `\n`. **Edit files with the Edit tool, or with a Node script using `String.raw` or `fs`; in Python never write `\b`, `\r`, `\n` or `\\` inside a normal string that lands in JS** (this went wrong four times before).
- Run the whole suite with `node --test "tests/*.test.mjs"` (quoted glob). Baseline: 220 tests passing at `95eb490`. It must be green at the end of every task.

## Review Focus

Inputs and conditions the spec implies but does not spell out. Each has a pinning test in the task shown.

1. A report with no `hero` is **byte-for-byte** what the current builder writes. The expected bytes are captured from the unchanged builder before any edit (Task 3).
2. A `hero` value such as `../secrets`, `a/b`, `HULK`, an empty string, a number or an array must not read a file and must not crash the builder (Tasks 1 and 3).
3. A theme file with CRLF line endings, a BOM, a quoted value that contains a `#`, or a trailing `# comment` must parse (Task 1).
4. The manual light/dark toggle must show the right accent: the CSS overrides `--accent` in all three places the page declares it (Task 1 and Task 3).
5. The band title stays a real `<h1>` containing the title text, escaped, so the page structure and any test that reads the title still work (Task 3).
6. A `hero` for which no theme file exists (a hero added later with no theme) renders unthemed and does not fail the build (Task 3), but preflight fails for it (Task 2).
7. The `assemble` page: a result whose `hero` has no theme still renders its card, and a failed hero's card has no emblem that implies success (Task 4).
8. Theme text reaches only escaped positions: a tagline of `<script>alert(1)</script>` is shown as text, never as markup (Task 1).

## File Structure

| Path | Responsibility | Change |
|---|---|---|
| `engine/themes.mjs` | `parseFrontmatter`, `isHex`, `contrast`, `bandTextColor`, `hue`, `EMBLEMS`, `readTheme`, `themeProblems`, `themeFor` | create (Task 1) |
| `engine/check-onboarding.mjs` | use the shared parser; validate `themes/`; require a theme per hero | modify (Task 2) |
| `themes/*.md` (12 files) | the looks | create (Task 2) |
| `engine/build-report.mjs` | apply a theme from `d.hero` | modify (Task 3) |
| `engine/build-assemble.mjs` | Fury's theme + per-card emblem and accent | modify (Task 4) |
| `skills/ask/SKILL.md`, `skills/assemble/SKILL.md` | write `hero` into the report JSON | modify (Task 5) |
| `tests/themes.test.mjs`, `tests/build-report.test.mjs`, `tests/build-assemble.test.mjs`, `tests/preflight.test.mjs`, `tests/skills.test.mjs`, `tests/assemble-skill.test.mjs`, `tests/plugin.test.mjs` | new and updated tests | create / modify |
| `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json` | docs and version 1.5.0 | modify (Task 6) |

---

### Task 1: `engine/themes.mjs`

**Files:**
- Create: `engine/themes.mjs`
- Test: `tests/themes.test.mjs` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (all `export`ed from `engine/themes.mjs`):
  - `parseFrontmatter(text) -> object|null` (the exact function now in `check-onboarding.mjs`: strips a BOM, normalises CRLF, reads `key: value` lines, strips a trailing `# comment` from unquoted values, keeps a quoted value whole)
  - `isHex(v) -> boolean` (`^#[0-9a-fA-F]{6}$`)
  - `contrast(a, b) -> number` (WCAG ratio of two `#rrggbb` colours, 1 to 21)
  - `bandTextColor(accent) -> '#ffffff'|'#111111'` (whichever has the higher ratio)
  - `hue(hex) -> number` (0 to 359) and `saturation(hex) -> number` (0 to 1)
  - `EMBLEMS` (object: name -> inline SVG string, 12 keys)
  - `readTheme(name, pluginDir) -> { name, accent, accentDark, emblem, tagline }|null` (null for a bad name, a missing file, or a file that fails `themeProblems`)
  - `themeProblems(name, text) -> string[]` (empty when valid; each string names the field)
  - `themeFor(name, pluginDir) -> { css, bandHtml, accent, accentDark, emblemSvg }|null`
  - `escapeHtml(s) -> string`

- [ ] **Step 1: Write the failing tests**

Create `tests/themes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, isHex, contrast, bandTextColor, hue, saturation, EMBLEMS, themeProblems, readTheme, themeFor, escapeHtml } from '../engine/themes.mjs';

const GOOD = (extra = {}) => {
  const f = { name: 'demo', accent: '#2e7d32', accentDark: '#7bd88f', emblem: 'fist', tagline: 'Hulk smash.', ...extra };
  return ['---', ...Object.entries(f).map(([k, v]) => `${k}: ${v === undefined ? '' : (typeof v === 'string' && k === 'tagline' ? JSON.stringify(v) : v)}`), '---', ''].join('\n');
};
function plugin(files) {
  const d = mkdtempSync(join(tmpdir(), 'avengers-themes-'));
  mkdirSync(join(d, 'themes'), { recursive: true });
  for (const [n, t] of Object.entries(files)) writeFileSync(join(d, 'themes', `${n}.md`), t);
  return d;
}

test('isHex accepts #rrggbb only', () => {
  for (const ok of ['#000000', '#FFFFFF', '#2e7d32']) assert.equal(isHex(ok), true, ok);
  for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#12345g', '#123456; } body{display:none', '', undefined, 5, '#1234567', ' #123456']) assert.equal(isHex(bad), false, String(bad));
});

test('contrast reproduces known WCAG values', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#ffffff', '#ffffff').toFixed(1), '1.0');
  assert.equal(contrast('#0b7a3b', '#ffffff').toFixed(2), '5.44');
  assert.equal(contrast('#f9a825', '#ffffff').toFixed(2), '1.97');
  assert.equal(contrast('#ffffff', '#0b7a3b'), contrast('#0b7a3b', '#ffffff'));
});

test('the band text colour is whichever of white or near-black scores higher', () => {
  assert.equal(bandTextColor('#2e7d32'), '#ffffff');
  assert.equal(bandTextColor('#f9a825'), '#111111');
  assert.equal(bandTextColor('#ffd54f'), '#111111');
});

test('hue and saturation: a grey has none', () => {
  assert.equal(hue('#ff0000'), 0);
  assert.equal(hue('#00ff00'), 120);
  assert.equal(saturation('#4a4a4a'), 0);
  assert.ok(saturation('#b71c1c') > 0.5);
});

test('there are exactly twelve emblems and each is a small inline svg that uses currentColor and no script', () => {
  const names = Object.keys(EMBLEMS);
  assert.deepEqual(names.sort(), ['ant', 'bow', 'eye', 'fist', 'gauntlet', 'hammer', 'portal', 'scepter', 'shield', 'suit', 'web', 'widow']);
  for (const n of names) {
    const svg = EMBLEMS[n];
    assert.match(svg, /^<svg [^>]*aria-hidden="true"/, n);
    assert.match(svg, /currentColor/, n);
    assert.doesNotMatch(svg, /<script|onload|onerror|href=|<style/i, n);
    assert.ok(svg.length < 1200, `${n} is ${svg.length} bytes`);
  }
});

test('parseFrontmatter: CRLF, BOM, quoted values with a hash, trailing comments', () => {
  const t = '﻿---\r\nname: demo\r\naccent: "#2e7d32"   # light\r\ntagline: "Smash # it"\r\nemblem: fist  # shape\r\n---\r\nbody';
  const f = parseFrontmatter(t);
  assert.equal(f.name, 'demo');
  assert.equal(f.accent, '#2e7d32');
  assert.equal(f.tagline, 'Smash # it');
  assert.equal(f.emblem, 'fist');
  assert.equal(parseFrontmatter('no frontmatter'), null);
});

test('themeProblems: a valid theme has none, and each bad field is named', () => {
  assert.deepEqual(themeProblems('demo', GOOD()), []);
  assert.match(themeProblems('demo', GOOD({ accent: 'green' })).join(' '), /accent/);
  assert.match(themeProblems('demo', GOOD({ accentDark: '#fff' })).join(' '), /accentDark/);
  assert.match(themeProblems('demo', GOOD({ emblem: 'banana' })).join(' '), /emblem/);
  assert.match(themeProblems('demo', GOOD({ tagline: '' })).join(' '), /tagline/);
  assert.match(themeProblems('demo', GOOD({ tagline: 'x'.repeat(101) })).join(' '), /tagline/);
  assert.match(themeProblems('other', GOOD()).join(' '), /name/);
  assert.match(themeProblems('demo', 'plain text').join(' '), /frontmatter/);
});

test('themeProblems: low contrast is named with the ratio', () => {
  const p = themeProblems('demo', GOOD({ accent: '#f9a825' })).join(' ');
  assert.match(p, /accent/);
  assert.match(p, /1\.9\d/);
  assert.match(themeProblems('demo', GOOD({ accentDark: '#222222' })).join(' '), /accentDark/);
});

test('readTheme and themeFor return null for a bad name, a missing file and an invalid theme, without reading outside themes/', () => {
  const dir = plugin({ demo: GOOD(), broken: GOOD({ accent: 'nope' }) });
  assert.ok(readTheme('demo', dir));
  for (const bad of ['../demo', 'a/b', 'a\\b', 'DEMO', '', ' ', 'demo.md', 'missing', 'broken', undefined, null, 5, ['demo'], {}]) {
    assert.equal(readTheme(bad, dir), null, String(bad));
    assert.equal(themeFor(bad, dir), null, String(bad));
  }
});

test('themeFor css overrides --accent in the three places the page declares it, with only validated colours', () => {
  const t = themeFor('demo', plugin({ demo: GOOD() }));
  assert.match(t.css, /^<style>/);
  assert.match(t.css, /:root\{--accent:#2e7d32\}/);
  assert.match(t.css, /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\)\{--accent:#7bd88f\}\}/);
  assert.match(t.css, /:root\[data-theme=dark\]\{--accent:#7bd88f\}/);
  const colours = t.css.match(/#[0-9a-fA-F]+/g);
  assert.ok(colours.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)), colours.join(' '));
});

test('themeFor band: a real h1 inside, the emblem, the tagline escaped, and a readable title colour', () => {
  const dir = plugin({ demo: GOOD({ tagline: '<script>alert(1)</script> & co' }) });
  const t = themeFor('demo', dir);
  assert.match(t.bandHtml, /class="band"/);
  assert.match(t.bandHtml, /<h1>\{\{TITLE\}\}<\/h1>/);
  assert.match(t.bandHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; co/);
  assert.doesNotMatch(t.bandHtml, /<script>/);
  assert.match(t.css, /\.band\{[^}]*color:#ffffff/);
});

test('escapeHtml escapes the five characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/themes.test.mjs`
Expected: FAIL: `Cannot find module '.../engine/themes.mjs'`.

- [ ] **Step 3: Write `engine/themes.mjs`**

```js
// Report themes: a look (accent colours, emblem, header band, tagline) per hero. Pure functions plus one file read.
// Nothing here ever puts text from a theme file into the page except the tagline, which is HTML-escaped, and colours,
// which are written only after they match #rrggbb. A theme can only choose an emblem by name from the fixed set below.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the one front-matter parser (check-onboarding.mjs imports it)
export function parseFrontmatter(text) {
  const m = String(text ?? '').replace(/^﻿/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    // a quoted value keeps everything inside the quotes; an unquoted one may end with a `# comment`
    o[kv[1]] = raw.startsWith('"') ? raw.replace(/^"(.*)"\s*(#.*)?$/, '$1') : raw.replace(/\s+#.*$/, '');
  }
  return o;
}

export const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

const channels = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const lin = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
const lum = (hex) => { const [r, g, b] = channels(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const bandTextColor = (accent) => (contrast(accent, '#ffffff') >= contrast(accent, '#111111') ? '#ffffff' : '#111111');

export function hue(hex) {
  const [r, g, b] = channels(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(h * 60);
  return (h + 360) % 360;
}
export function saturation(hex) {
  const [r, g, b] = channels(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

const svg = (body) => `<svg class="emblem" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
// simple original shapes drawn for this plugin; a theme file can only pick one by name
export const EMBLEMS = {
  fist: svg('<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3m0-1V6a1.5 1.5 0 0 1 3 0v4m0-1V7a1.5 1.5 0 0 1 3 0v4m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3a1.5 1.5 0 0 1 3 0"/>'),
  hammer: svg('<path d="M4 6h10v5H4zM14 8.5h5M9 11v10"/>'),
  shield: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 7l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"/>'),
  portal: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  suit: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="9"/>'),
  bow: svg('<path d="M6 3c8 3 8 15 0 18M6 3v18M6 12h14M16 9l4 3-4 3"/>'),
  web: svg('<path d="M12 12L12 3M12 12l7.8-4.5M12 12l7.8 4.5M12 12V21M12 12l-7.8 4.5M12 12L4.2 7.5"/><path d="M12 7l3.5 2v4L12 15l-3.5-2V9z"/>'),
  widow: svg('<path d="M12 4l5 8-5 8-5-8z"/><path d="M9 12h6"/>'),
  gauntlet: svg('<path d="M7 20v-6l-2-3V8h3v3m0-3V5h3v3m0-3h3v3m0 0h3v6l-2 3v3z"/><circle cx="12" cy="15" r="1.2"/>'),
  ant: svg('<circle cx="12" cy="6" r="2.5"/><ellipse cx="12" cy="14" rx="3.5" ry="5"/><path d="M8.5 12l-4-2M15.5 12l4-2M8.5 15l-4 1M15.5 15l4 1M10 4L8 2M14 4l2-2"/>'),
  scepter: svg('<path d="M12 21V9"/><path d="M12 9c-4 0-5-4-3.5-6 1.5 1 2.5 1 3.5 3 1-2 2-2 3.5-3C17 5 16 9 12 9z"/>'),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};

const NAME = /^[a-z0-9-]+$/;
const LIGHT_BG = ['#ffffff', '#f6f8fa'];
const DARK_BG = ['#0d1117', '#161b22'];
const MIN = 4.5;

export function themeProblems(name, text) {
  const fm = parseFrontmatter(text);
  if (!fm) return ['the file has no frontmatter'];
  const bad = [];
  if (fm.name !== name) bad.push('name (must equal the file name)');
  if (!isHex(fm.accent)) bad.push('accent (must be #rrggbb)');
  if (!isHex(fm.accentDark)) bad.push('accentDark (must be #rrggbb)');
  if (!Object.hasOwn(EMBLEMS, fm.emblem ?? '')) bad.push('emblem (one of ' + Object.keys(EMBLEMS).join(', ') + ')');
  if (!fm.tagline || fm.tagline.length > 100) bad.push('tagline (1 to 100 characters, one line)');
  if (bad.length) return bad;
  for (const bg of LIGHT_BG) {
    const r = contrast(fm.accent, bg);
    if (r < MIN) bad.push(`accent ${fm.accent} has contrast ${r.toFixed(2)} on ${bg} (needs ${MIN}); darken it`);
  }
  for (const bg of DARK_BG) {
    const r = contrast(fm.accentDark, bg);
    if (r < MIN) bad.push(`accentDark ${fm.accentDark} has contrast ${r.toFixed(2)} on ${bg} (needs ${MIN}); lighten it`);
  }
  for (const [label, c] of [['accent', fm.accent], ['accentDark', fm.accentDark]]) {
    const r = contrast(c, bandTextColor(c));
    if (r < MIN) bad.push(`${label} ${c}: the title on the band would have contrast ${r.toFixed(2)} (needs ${MIN})`);
  }
  return bad;
}

export function readTheme(name, pluginDir) {
  if (typeof name !== 'string' || !NAME.test(name)) return null;
  const p = join(pluginDir, 'themes', name + '.md');
  if (!existsSync(p)) return null;
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { return null; }
  if (themeProblems(name, text).length) return null;
  const fm = parseFrontmatter(text);
  return { name, accent: fm.accent, accentDark: fm.accentDark, emblem: fm.emblem, tagline: fm.tagline };
}

// css: re-declares --accent in the three places the pages declare it, so the manual light/dark toggle shows the right colour.
// bandHtml: the header band; the caller replaces {{TITLE}} with the already-escaped title.
export function themeFor(name, pluginDir) {
  const t = readTheme(name, pluginDir);
  if (!t) return null;
  const text = bandTextColor(t.accent);
  const textDark = bandTextColor(t.accentDark);
  const css = '<style>' +
    `:root{--accent:${t.accent}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--accent:${t.accentDark}}}` +
    `:root[data-theme=dark]{--accent:${t.accentDark}}` +
    `.band{display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:14px 18px;border-radius:8px;background:${t.accent};color:${text}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .band{background:${t.accentDark};color:${textDark}}}` +
    `:root[data-theme=dark] .band{background:${t.accentDark};color:${textDark}}` +
    `.band h1{margin:0;color:inherit}.band .tagline{margin:2px 0 0;font-size:.9rem;opacity:.95}.band .emblem{flex:none;width:36px;height:36px}` +
    '</style>';
  const bandHtml = `<div class="band">${EMBLEMS[t.emblem]}<div><h1>{{TITLE}}</h1><p class="tagline">${escapeHtml(t.tagline)}</p></div></div>`;
  return { css, bandHtml, accent: t.accent, accentDark: t.accentDark, emblemSvg: EMBLEMS[t.emblem] };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test tests/themes.test.mjs`
Expected: PASS (12 tests). If the contrast test fails on 5.44 or 1.97, the maths is wrong; check `lin` uses 0.03928 and the 2.4 exponent.

- [ ] **Step 5: Mutation-check the three rules that carry the safety, then restore**

For each of these edits to `engine/themes.mjs`, run `node --test tests/themes.test.mjs`, confirm at least one test fails, then restore the file. Use a Node script for the edit, not `sed`.
- `isHex` regex `{6}` changed to `{3,6}`.
- `NAME` changed to `/^[a-zA-Z0-9-./]+$/`.
- `escapeHtml` replaced with `(s) => String(s ?? '')`.
Expected: every mutation fails at least one test; if one passes, that rule has no test, so add one before continuing.

- [ ] **Step 6: Run the whole suite and commit**

Run: `node --test "tests/*.test.mjs"`
Expected: all pass (232).

```bash
git add -A
git commit -m "feat: themes module (colours, contrast, emblems, themeFor)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The 12 theme files and the preflight checks

**Files:**
- Create: `themes/{thor,captainamerica,drstrange,blackwidow,hulk,thanos,antman,loki,ironman,hawkeye,spiderman,fury}.md`
- Modify: `engine/check-onboarding.mjs` (import the shared parser; add `themeProblemsAll`)
- Modify: `tests/preflight.test.mjs` (the fixture grows a `themes/` folder), `tests/heroes.test.mjs`
- Test: `tests/themes.test.mjs`, `tests/preflight.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter`, `themeProblems`, `hue`, `saturation` from `engine/themes.mjs` (Task 1).
- Produces: failure ids `theme-invalid` (a theme file fails `themeProblems`), `theme-missing` (a hero without `themes/<hero>.md`, or no `themes/fury.md`), `theme-orphan` (a theme with no hero other than `fury`); warning id `theme-similar` (two coloured themes within 12 degrees). `check-onboarding.mjs` no longer defines its own `frontmatter()`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/themes.test.mjs`:

```js
import { readdirSync, readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman'];

test('there is a theme for every hero plus fury, and no other', () => {
  const names = readdirSync(join(root, 'themes')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual(names, [...HEROES, 'fury'].sort());
});

test('every shipped theme is valid and passes the contrast rule', () => {
  for (const n of [...HEROES, 'fury']) {
    const text = readFileSync(join(root, 'themes', `${n}.md`), 'utf8');
    assert.deepEqual(themeProblems(n, text), [], n);
  }
});

test('the shipped themes use twelve different emblems', () => {
  const emblems = [...HEROES, 'fury'].map((n) => parseFrontmatter(readFileSync(join(root, 'themes', `${n}.md`), 'utf8')).emblem);
  assert.equal(new Set(emblems).size, 12);
});

test('no two coloured shipped themes sit within 12 degrees of hue (grey is exempt)', () => {
  const light = [...HEROES, 'fury'].map((n) => [n, parseFrontmatter(readFileSync(join(root, 'themes', `${n}.md`), 'utf8')).accent]).filter(([, c]) => saturation(c) >= 0.1);
  for (let i = 0; i < light.length; i++) for (let j = i + 1; j < light.length; j++) {
    const d = Math.min(Math.abs(hue(light[i][1]) - hue(light[j][1])), 360 - Math.abs(hue(light[i][1]) - hue(light[j][1])));
    assert.ok(d > 12, `${light[i][0]} and ${light[j][0]} are only ${d} degrees apart`);
  }
});

test('the shipped taglines are one line, in the unsafe-wording scan\'s clear, and not copies of an intro', () => {
  for (const n of [...HEROES, 'fury']) {
    const fm = parseFrontmatter(readFileSync(join(root, 'themes', `${n}.md`), 'utf8'));
    assert.ok(fm.tagline.length >= 8 && fm.tagline.length <= 100, n);
    assert.doesNotMatch(fm.tagline, /\b(Bash|PowerShell|NotebookEdit|WebFetch|WebSearch|Write|Edit)\b/, n);
  }
});
```

Append to `tests/preflight.test.mjs` (the helper `makePlugin` is changed in Step 3):

```js
test('preflight fails when a hero has no theme, and names the theme file', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'theme-missing');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /themes[\\/]hulk\.md/);
});

test('preflight fails when fury has no theme', () => {
  assert.ok(ids(preflight({ plugin: makePlugin({ 'themes/fury': null }) })).includes('theme-missing'));
});

test('preflight fails on a theme with low contrast and says the ratio and the file', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/hulk': themeText('hulk', { accent: '#f9a825' }) }) });
  const f = r.failures.find((x) => x.id === 'theme-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
  assert.match(f.problem, /1\.9\d/);
});

test('preflight fails on a bad emblem, a non-hex colour and an over-long tagline', () => {
  for (const bad of [{ emblem: 'banana' }, { accent: 'green' }, { tagline: 'x'.repeat(101) }]) {
    assert.ok(ids(preflight({ plugin: makePlugin({ 'themes/hulk': themeText('hulk', bad) }) })).includes('theme-invalid'), JSON.stringify(bad));
  }
});

test('preflight fails on a theme that has no hero, except fury', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/stranger': themeText('stranger') }) });
  assert.ok(ids(r).includes('theme-orphan'), JSON.stringify(r.failures));
});

test('preflight only warns when two coloured themes are within 12 degrees of hue', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/thor': themeText('thor', { accent: '#b71c1c', accentDark: '#ff8a80' }), 'themes/ironman': themeText('ironman', { accent: '#b71c1c', accentDark: '#ff8a80' }) }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
  assert.ok(r.warnings.some((w) => w.id === 'theme-similar'), JSON.stringify(r.warnings));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/themes.test.mjs tests/preflight.test.mjs`
Expected: FAIL: `ENOENT ... themes/` for the shipped-theme tests; the preflight tests fail because `themeText` is not defined and there are no theme checks.

- [ ] **Step 3: Create the 12 theme files**

One file per theme, exactly this shape (values from spec section 3.3). Create `themes/hulk.md`:

```markdown
---
name: hulk
accent: "#2e7d32"
accentDark: "#7bd88f"
emblem: fist
tagline: "Hulk smash. Here is what breaks."
---
```

Create the other 11 the same way, with these values (every file has the same four keys, no body, and `name` equal to the file name):

| name | accent | accentDark | emblem | tagline |
|---|---|---|---|---|
| thor | `#0d6ea8` | `#7cc4f2` | hammer | `The realms of this repo, mapped.` |
| captainamerica | `#1c3f94` | `#9db7ff` | shield | `Here are the rules, and who they apply to.` |
| drstrange | `#a85a00` | `#ffb454` | portal | `Every path this request can take, followed.` |
| blackwidow | `#a3004f` | `#ff7fb0` | widow | `From the symptom back to the cause.` |
| thanos | `#6a1b9a` | `#d49cff` | gauntlet | `Half of this may not be missed.` |
| antman | `#6d6a00` | `#d8d36a` | ant | `Small enough to read it line by line.` |
| loki | `#00796b` | `#5fdccb` | scepter | `The tricks hiding in plain sight.` |
| ironman | `#b71c1c` | `#ff8a80` | suit | `Full systems scan complete.` |
| hawkeye | `#4a3fa0` | `#b9b0ff` | bow | `Target found.` |
| spiderman | `#c13a14` | `#ff9a73` | web | `Explained in plain words, no jargon.` |
| fury | `#4a4a4a` | `#c4c4c4` | eye | `The team has assembled.` |

- [ ] **Step 4: Change the preflight and its test fixture**

In `engine/check-onboarding.mjs`:
1. Add to the imports: `import { parseFrontmatter, themeProblems, hue, saturation } from './themes.mjs';`
2. Delete the whole `function frontmatter(text) { ... }` and replace its one caller in `heroProblems` (`const fm = frontmatter(text);`) with `const fm = parseFrontmatter(text);`.
3. Add this function above `promptProblems`:

```js
// every hero needs a theme, fury needs one, and a theme must be valid; a theme with no hero is only allowed for fury
function themeProblemsAll() {
  const found = [];
  const dir = join(pluginDir, 'themes');
  const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [];
  const heroes = heroFiles();
  for (const name of [...heroes, 'fury']) {
    if (!have.includes(name)) found.push({ id: 'theme-missing', problem: `themes/${name}.md is missing, so ${name === 'fury' ? 'the /assemble team page' : `/${name}'s reports`} would have no look.`, fix: `Add themes/${name}.md with name, accent, accentDark, emblem and tagline.` });
  }
  for (const name of have) {
    if (name !== 'fury' && !heroes.includes(name)) found.push({ id: 'theme-orphan', problem: `themes/${name}.md has no heroes/${name}.md.`, fix: `Add heroes/${name}.md or remove themes/${name}.md.` });
    const problems = themeProblems(name, readFileSync(join(dir, name + '.md'), 'utf8'));
    if (problems.length) found.push({ id: 'theme-invalid', problem: `themes/${name}.md: ${problems.join('; ')}.`, fix: `Edit themes/${name}.md so every field is valid.` });
  }
  return found;
}
function themeWarnings() {
  const dir = join(pluginDir, 'themes');
  if (!existsSync(dir)) return [];
  const coloured = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [f.slice(0, -3), parseFrontmatter(readFileSync(join(dir, f), 'utf8'))?.accent]).filter(([, c]) => /^#[0-9a-fA-F]{6}$/.test(c ?? '') && saturation(c) >= 0.1);
  const out = [];
  for (let i = 0; i < coloured.length; i++) for (let j = i + 1; j < coloured.length; j++) {
    const d = Math.abs(hue(coloured[i][1]) - hue(coloured[j][1]));
    if (Math.min(d, 360 - d) <= 12) out.push({ id: 'theme-similar', note: `themes ${coloured[i][0]} and ${coloured[j][0]} have accents within 12 degrees of hue, so reports may look alike.` });
  }
  return out;
}
```

4. In the preflight command, after `failures.push(...promptProblems());` add `failures.push(...themeProblemsAll());` and add `warnings.push(...themeWarnings());` next to the other warnings.

In `tests/preflight.test.mjs`: add, after `heroText`, this helper and extend `makePlugin` so every fake plugin has valid themes (otherwise ~25 existing tests fail with `theme-missing`, the same gap `CORE_HEROES` caused in phase 2):

```js
const THEME_COLOURS = { thor: ['#0d6ea8', '#7cc4f2'], captainamerica: ['#1c3f94', '#9db7ff'], drstrange: ['#a85a00', '#ffb454'], blackwidow: ['#a3004f', '#ff7fb0'], hulk: ['#2e7d32', '#7bd88f'], thanos: ['#6a1b9a', '#d49cff'], antman: ['#6d6a00', '#d8d36a'], loki: ['#00796b', '#5fdccb'], ironman: ['#b71c1c', '#ff8a80'], hawkeye: ['#4a3fa0', '#b9b0ff'], spiderman: ['#c13a14', '#ff9a73'], fury: ['#4a4a4a', '#c4c4c4'] };
function themeText(name, over = {}) {
  const [a, d] = THEME_COLOURS[name] ?? ['#2e7d32', '#7bd88f'];
  const f = { name, accent: a, accentDark: d, emblem: 'fist', tagline: 'A short line.', ...over };
  return ['---', `name: ${f.name}`, `accent: ${JSON.stringify(f.accent)}`, `accentDark: ${JSON.stringify(f.accentDark)}`, `emblem: ${f.emblem}`, `tagline: ${JSON.stringify(f.tagline)}`, '---', ''].join('\n');
}
```

and inside `makePlugin`, after the audiences loop, add:

```js
  for (const n of [...HEROES, 'fury']) {
    const tk = `themes/${n}`;
    const tt = tk in overrides ? overrides[tk] : themeText(n);
    if (tt !== null) put(`${tk}.md`, tt);
  }
  for (const k of Object.keys(overrides)) {
    if (k.startsWith('themes/') && ![...HEROES, 'fury'].some((h) => k === `themes/${h}`)) put(`${k}.md`, overrides[k]);
  }
```

Each fixture theme needs its own distinct hue-safe colours only for the warning test, which overrides two of them on purpose; the shipped colours above are already separated, so no extra warnings appear in the other tests.

- [ ] **Step 5: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true` with no `theme-*` entries in `failures` or `warnings`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: twelve report themes and the preflight checks for them" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `build-report.mjs` applies a theme

**Files:**
- Create: `tests/fixtures/report-baseline.html` (captured from the UNCHANGED builder first, see Step 1)
- Modify: `engine/build-report.mjs`
- Test: `tests/build-report.test.mjs`

**Interfaces:**
- Consumes: `themeFor` from `engine/themes.mjs`; the plugin root as `process.env.AVENGERS_PLUGIN_DIR ?? <parent of engine/>`.
- Produces: `build-report.mjs` reads the optional `d.hero`. With a valid theme the page gains the theme `<style>` right after the page's own `</style>`, and the `<h1>` is wrapped by the band. Without one the output is byte-for-byte unchanged.

- [ ] **Step 1: Capture the baseline BEFORE changing the builder**

This step must run first, on the unchanged `engine/build-report.mjs`. Create `tests/fixtures/` and write a fixed input and its current output:

```bash
mkdir -p tests/fixtures
node -e "
const fs=require('fs');
const d={title:'Baseline report',question:'How does X work?',summary:'S',plainSummary:'P',type:'logic',audience:'dev',generated:'2026-10-08',commit:'abc1234',nodes:[{id:'n1',label:'Alpha',lane:'entry',confirmed:true},{id:'n2',label:'Beta',lane:'data',confirmed:false}],edges:[{from:'n1',to:'n2',label:'calls',kind:'ok',step:1}],steps:[{n:1,text:'Alpha calls Beta',cite:'src/a.ts:1'}],rules:[{text:'A rule',cite:'src/a.ts:2'}],sources:['src/a.ts:1'],confidence:{confirmed:['x'],graphOnly:[],unconfirmed:['y']},sections:[{heading:'Decision table',kind:'table',columns:['A','B'],rows:[['1','2']]}]};
fs.writeFileSync('tests/fixtures/report-baseline.json',JSON.stringify(d,null,2)+'\n');
"
node engine/build-report.mjs tests/fixtures/report-baseline.json tests/fixtures/report-baseline.html
```

Expected: both files exist. `report-baseline.html` is the exact bytes the current builder produces. Commit both now so the baseline is in history before the builder changes:

```bash
git add tests/fixtures
git commit -m "test: capture the current report output as a byte-for-byte baseline" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/build-report.test.mjs`:

```js
import { cpSync, mkdirSync as mkdirSyncB } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselineJson = join(root, 'tests', 'fixtures', 'report-baseline.json');
const baselineHtml = readFileSync(join(root, 'tests', 'fixtures', 'report-baseline.html'), 'utf8');

function buildFile(jsonObj, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-themed-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify(jsonObj));
  const r = spawnSync(process.execPath, [script, inPath, outPath], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stderr: r.stderr, html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}
const baseObj = () => JSON.parse(readFileSync(baselineJson, 'utf8'));

test('a report with no hero is byte-for-byte what the builder wrote before themes existed', () => {
  const r = buildFile(baseObj());
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.html, baselineHtml);
});

test('an unknown, unsafe or non-string hero changes nothing and does not crash', () => {
  for (const hero of ['nobody', '../secrets', 'a/b', 'HULK', '', 5, ['hulk'], {}, null]) {
    const r = buildFile({ ...baseObj(), hero });
    assert.equal(r.status, 0, `${JSON.stringify(hero)}: ${r.stderr}`);
    assert.equal(r.html, baselineHtml, JSON.stringify(hero));
  }
});

test('hero hulk adds the band, the emblem, the tagline and the three accent overrides', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="band"/);
  assert.match(r.html, /class="emblem"/);
  assert.match(r.html, /Hulk smash\. Here is what breaks\./);
  assert.match(r.html, /:root\{--accent:#2e7d32\}/);
  assert.match(r.html, /:root:not\(\[data-theme=light\]\)\{--accent:#7bd88f\}/);
  assert.match(r.html, /:root\[data-theme=dark\]\{--accent:#7bd88f\}/);
});

test('the themed title is still a real h1, escaped, and the rest of the page is unchanged', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk', title: '<b>Bold & "quoted"</b>' });
  assert.match(r.html, /<h1>&lt;b&gt;Bold &amp; &quot;quoted&quot;&lt;\/b&gt;<\/h1>/);
  assert.doesNotMatch(r.html, /<h1><b>/);
  assert.ok(r.html.includes('<h2>Summary</h2>'));
  assert.ok(r.html.includes('class="diagram dev-only"'));
});

test('a hero whose theme file is missing or broken renders unthemed, with exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-plug-'));
  mkdirSyncB(join(dir, 'themes'), { recursive: true });
  writeFileSync(join(dir, 'themes', 'hulk.md'), '---\nname: hulk\naccent: "green"\naccentDark: "#7bd88f"\nemblem: fist\ntagline: "x"\n---\n');
  for (const plugin of [dir, mkdtempSync(join(tmpdir(), 'avengers-empty-'))]) {
    const r = buildFile({ ...baseObj(), hero: 'hulk' }, { AVENGERS_PLUGIN_DIR: plugin });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.html, baselineHtml);
  }
});

test('a secret in the tagline-free report JSON is still refused when a hero is set', () => {
  const r = buildFile({ ...baseObj(), hero: 'hulk', summary: 'key AKIAABCDEFGHIJKLMNOP' });
  assert.equal(r.status, 3);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/build-report.test.mjs`
Expected: the baseline test PASSES (the builder is unchanged), the "unknown hero" test PASSES, and the `hero: hulk` test FAILS (no band yet). The "title still a real h1" test also fails. This is the right red: the byte-for-byte guards pass today and must keep passing after the change.

- [ ] **Step 4: Implement**

In `engine/build-report.mjs`:
1. Add to the imports: `import { themeFor, escapeHtml } from './themes.mjs';` and `import { fileURLToPath } from 'node:url';` (if not already imported).
2. After the `startPlain` line add:

```js
// optional per-hero look; null (no hero, unknown hero, missing or invalid theme) leaves the page exactly as it was
const pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url));
const theme = themeFor(d.hero, pluginDir);
```

3. Change `</style></head>` (the end of the page's own style block, line 283) to `</style>${theme ? theme.css : ''}</head>`.
4. Change the line `<h1>${esc(d.title)}</h1>` to `${theme ? theme.bandHtml.replace('{{TITLE}}', () => esc(d.title)) : `<h1>${esc(d.title)}</h1>`}`.

(`replace` with a function avoids `$&` and `$1` in a title being read as replacement patterns.)

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/build-report.test.mjs`
Expected: PASS, including the byte-for-byte test.

- [ ] **Step 6: Mutation-check the guard, then restore**

Edit the builder so the no-theme branch changes one byte (for example `<h1>${esc(d.title)}</h1>` to `<h1> ${esc(d.title)}</h1>`), run `node --test tests/build-report.test.mjs`, confirm the byte-for-byte test fails, then restore. Use a Node script for the edit. Expected: red, which proves the baseline test would catch a regression.

- [ ] **Step 7: Run the whole suite and commit**

Run: `node --test "tests/*.test.mjs"` and `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

```bash
git add -A
git commit -m "feat: reports take their hero's look; unthemed reports are byte-for-byte unchanged" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `build-assemble.mjs` applies Fury's theme and the card looks

**Files:**
- Modify: `engine/build-assemble.mjs`
- Test: `tests/build-assemble.test.mjs`

**Interfaces:**
- Consumes: `themeFor`, `readTheme`, `escapeHtml` from `engine/themes.mjs`.
- Produces: the team page is themed with `fury`; each OK hero card shows that hero's emblem and a left edge in its light accent. A failed hero's card shows no emblem. A page without a `themes/` folder renders exactly as before.

- [ ] **Step 1: Capture the assemble baseline BEFORE changing the builder**

```bash
node -e "
const fs=require('fs');
const ok=(h)=>({hero:h,model:'sonnet',task:'t '+h,status:'ok',title:h+' title',summary:h+' summary',type:'impact',reportPath:'heroes/'+h+'/report.html',sources:['a:1'],confidence:{confirmed:['c'],graphOnly:[],unconfirmed:[]}});
const d={type:'assemble',title:'Team run',question:'the goal',summary:'combined',plainSummary:'plain',plan:[],results:[ok('hulk'),{hero:'loki',model:'sonnet',task:'t',status:'failed',error:'e'}],generated:'2026-10-08',commit:'abc1234'};
fs.writeFileSync('tests/fixtures/assemble-baseline.json',JSON.stringify(d,null,2)+'\n');
"
AVENGERS_PLUGIN_DIR=/nonexistent node engine/build-assemble.mjs tests/fixtures/assemble-baseline.json tests/fixtures/assemble-baseline.html
```

Expected: both files exist. Commit them now, before changing the builder:

```bash
git add tests/fixtures
git commit -m "test: capture the current team page output as a byte-for-byte baseline" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/build-assemble.test.mjs`:

```js
import { mkdirSync as mkdirSyncT } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const asmJson = join(root, 'tests', 'fixtures', 'assemble-baseline.json');
const asmHtml = readFileSync(join(root, 'tests', 'fixtures', 'assemble-baseline.html'), 'utf8');
function buildThemed(obj, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'avengers-assemble-t-'));
  const inPath = join(dir, 'report.json');
  const outPath = join(dir, 'report.html');
  writeFileSync(inPath, JSON.stringify(obj));
  const r = spawnSync(process.execPath, [script, inPath, outPath], { encoding: 'utf8', env: { ...process.env, ...env } });
  return { status: r.status, stderr: r.stderr, html: existsSync(outPath) ? readFileSync(outPath, 'utf8') : '' };
}

test('with no themes folder the team page is byte-for-byte what it was before themes', () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')), { AVENGERS_PLUGIN_DIR: mkdtempSync(join(tmpdir(), 'avengers-empty-')) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.html, asmHtml);
});

test('the team page takes fury\'s look', () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="band"/);
  assert.match(r.html, /The team has assembled\./);
  assert.match(r.html, /:root\{--accent:#4a4a4a\}/);
  assert.match(r.html, /<h1>Team run<\/h1>/);
});

test('a hero card carries that hero\'s emblem and accent, and a failed hero\'s card has no emblem', () => {
  const r = buildThemed(JSON.parse(readFileSync(asmJson, 'utf8')));
  const cards = r.html.split('<li class="item');
  const hulk = cards.find((c) => c.includes('<b>hulk</b>'));
  const loki = cards.find((c) => c.includes('<b>loki</b>'));
  assert.match(hulk, /class="emblem"/);
  assert.match(hulk, /border-left:4px solid #2e7d32/);
  assert.doesNotMatch(loki, /class="emblem"/);
  assert.match(loki, /failed/);
});

test('a hero with no theme still gets its card, plain', () => {
  const obj = JSON.parse(readFileSync(asmJson, 'utf8'));
  obj.results[0].hero = 'nobody';
  const r = buildThemed(obj);
  assert.equal(r.status, 0, r.stderr);
  const card = r.html.split('<li class="item').find((c) => c.includes('<b>nobody</b>'));
  assert.ok(card);
  assert.doesNotMatch(card, /class="emblem"/);
});

test('a hero value that tries to leave themes/ gets a plain card', () => {
  const obj = JSON.parse(readFileSync(asmJson, 'utf8'));
  obj.results[0].hero = '../themes/hulk';
  const r = buildThemed(obj);
  assert.equal(r.status, 0);
  const card = r.html.split('<li class="item').find((c) => c.includes('themes/hulk'));
  assert.doesNotMatch(card, /class="emblem"/);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/build-assemble.test.mjs`
Expected: the no-themes baseline test PASSES; the "fury's look" and "hero card" tests FAIL.

- [ ] **Step 4: Implement**

In `engine/build-assemble.mjs`:
1. Add the imports `import { fileURLToPath } from 'node:url';` (merge with the existing `node:url` import: `import { fileURLToPath, pathToFileURL } from 'node:url';`) and `import { themeFor, readTheme } from './themes.mjs';`.
2. In `render(d)`, before `const card`, add:

```js
  const pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url));
  const fury = themeFor('fury', pluginDir);
```

3. In the OK branch of `card`, change the opening of the returned string to carry the hero's look. Replace `return \`<li class="item"><b>${esc(r.hero)}</b>` with:

```js
    const t = themeFor(r.hero, pluginDir);
    return `<li class="item"${t ? ` style="border-left:4px solid ${t.accent}"` : ''}>${t ? t.emblemSvg + ' ' : ''}<b>${esc(r.hero)}</b>
```

and remove the old `<b>${esc(r.hero)}</b>` that followed on the same line, so the hero name appears once. The failed branch is not changed.
4. Change `</style></head><body><main>` to `</style>${fury ? fury.css : ''}</head><body><main>` and the line `<h1>${esc(d.title)}</h1>` to `${fury ? fury.bandHtml.replace('{{TITLE}}', () => esc(d.title)) : \`<h1>${esc(d.title)}</h1>\`}`.

(`readTheme` is imported but only `themeFor` is used here; drop `readTheme` from the import if lint-clean matters.)

- [ ] **Step 5: Run to verify they pass, then the whole suite**

Run: `node --test tests/build-assemble.test.mjs` then `node --test "tests/*.test.mjs"` and `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: the team page takes fury's look and each hero card its hero's emblem and accent" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The skills write `hero` into the report JSON

**Files:**
- Modify: `skills/ask/SKILL.md`, `skills/assemble/SKILL.md`
- Test: `tests/skills.test.mjs`, `tests/assemble-skill.test.mjs`

**Interfaces:**
- Consumes: the report JSON stamping steps in both skills.
- Produces: `ask` hero mode and `deep` set `hero`; `assemble` sets `hero` on each hero's JSON and `"hero": "fury"` on the combined JSON.

- [ ] **Step 1: Write the failing tests**

Append to `tests/skills.test.mjs`:

```js
test('ask writes the hero name into the report JSON in hero mode, and deep records ironman', () => {
  const step9 = ask.split('### 9. Report')[1].split('Layout:')[0];
  assert.match(step9, /set `hero` to the hero's name in hero mode/);
  assert.match(step9, /`ironman` for `deep`/);
  assert.match(step9, /omit `hero` in plain `\/ask`/);
});
```

Append to `tests/assemble-skill.test.mjs`:

```js
test('each hero JSON gets its hero name and the combined JSON gets fury', () => {
  const collect = section('### 6. Collect, per hero', '### 7.');
  assert.match(collect, /set `hero` to that hero's name \(`hulk` for `hulk-2`\)/);
  const merge = section('### 7. Merge (Fury)', '## Re-run');
  assert.match(merge, /"hero": "fury"/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/skills.test.mjs tests/assemble-skill.test.mjs`
Expected: FAIL: neither skill mentions `hero` in the JSON steps.

- [ ] **Step 3: Edit the two skills (Edit tool; both files are CRLF)**

In `skills/ask/SKILL.md`, in step 9 item 3, after the sentence ending `...omit `commit` if not a git repo).`, add: ` In hero mode set `hero` to the hero's name in hero mode, set it to `ironman` for `deep`, and omit `hero` in plain `/ask`. The report builder uses it to pick the look in `themes/`; an absent or unknown value just means no look.`

In `skills/assemble/SKILL.md`, in step 6 "Valid:", after `set `type` and `audience` to the values you used`, add: `, set `hero` to that hero's name (`hulk` for `hulk-2`)`. In the step 7 combined JSON block, add `"hero": "fury",` as a new line after `"type": "assemble",`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test "tests/*.test.mjs"` and `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: skills record the hero in the report JSON so the builders can pick its look" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and version 1.5.0

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `.claude-plugin/plugin.json`, `tests/plugin.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: version `1.5.0`; a `## 1.5.0` changelog section above 1.4.0.

- [ ] **Step 1: Write the failing tests**

In `tests/plugin.test.mjs`: change the first test's title and expected version to `1.5.0`; replace the changelog test with:

```js
test('the changelog has a 1.5.0 entry on top and keeps every earlier version', () => {
  const c = read('CHANGELOG.md').replace(/\r\n/g, '\n');
  assert.match(c, /^# Changelog\n\n## 1\.5\.0 /);
  for (const v of ['1.4.0', '1.3.0', '1.2.0', '1.1.0', '1.0.0']) assert.ok(c.includes(`\n## ${v} `), `changelog lost ${v}`);
});

test('the README documents report themes, the themes folder and the limits', () => {
  const r = read('README.md');
  for (const needle of ['themes/', 'accent', 'emblem', 'tagline', 'contrast', 'byte-for-byte', 'rebuilt']) {
    assert.ok(r.includes(needle), `README does not mention ${needle}`);
  }
});
```

Run `node --test tests/plugin.test.mjs`. Expected: FAIL on all three.

- [ ] **Step 2: Version, changelog, README**

`.claude-plugin/plugin.json`: `"version": "1.5.0"`.

Insert under `# Changelog` (a Node script with `fs`, keeping CRLF; match the heading `## 1.4.0 - 2026-10-08` and put the new section above it):

```
## 1.5.0 - 2026-10-08

### Added
- Report themes: each hero's report now has a look of its own, and the `/assemble` team page has Fury's. A look is an accent colour (one for light mode, one for dark), a small emblem, a coloured header band and one in-character tagline. Findings, wording, sections, the diagram and the layout are unchanged.
- `themes/`: twelve small files (the 11 heroes and `fury`), each with `accent`, `accentDark`, `emblem` and `tagline`. A theme can only choose an emblem by name from a fixed set of twelve; it never supplies SVG, and colours are accepted only as `#rrggbb`.
- `engine/themes.mjs`: colour checks, WCAG contrast maths, the emblems, and `themeFor`. The front-matter parser moved here from `check-onboarding.mjs` so there is one copy.
- Preflight checks every theme: valid colours, a known emblem, a tagline of at most 100 characters, and contrast of at least 4.5:1 for the accent as text in both modes and for the title on the band. A hero without a theme fails; two coloured themes within 12 degrees of hue only warn.
- Report JSON gains an optional `hero`; the skills write it. `/ask deep` records `ironman`.

### Notes
- A report with no `hero`, an unknown hero or a broken theme renders byte-for-byte as before, so saved reports keep working. A report built before 1.5.0 keeps its old look until it is rebuilt.
- Tests prove the colours are legal and readable and that the markup is present. They cannot tell you whether it looks good: open a themed report in a browser.

```

README: add a `### Report themes` section after "Assemble (Fury)" covering what a look is, the `themes/` folder and its four fields, the fixed emblem set, the contrast rule, that a report built before 1.5.0 keeps its old look until it is rebuilt, and that a missing theme just means no look. Add to `## Limits`: ``- Looks cannot be checked by tests; open a themed report in a browser. The contrast rule guarantees a readable accent, not a good-looking one. Emblems are simple original icons, not Marvel artwork.`` Add a line to the Develop section: ``Report looks live in `themes/` (one file per theme) and `engine/themes.mjs`.``

- [ ] **Step 3: Run the whole suite and the real preflight**

Run: `node --test "tests/*.test.mjs"` then `node engine/check-onboarding.mjs preflight`
Expected: all pass; preflight `"ok": true`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: 1.5.0 report themes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the plan (needs the user)

Tests cannot judge looks, so this part is yours:
1. `/reload-plugins`, then run `/hulk <a question>`; open the new `report.html` in a browser.
2. Check the band: emblem, title readable on the colour, tagline under it. Click "Toggle theme" and check the colour changes with the page, in both modes.
3. Compare two or three heroes side by side (for example `/hulk`, `/ironman`, `/thor`): can you tell them apart at a glance? If two look alike, change the `accent` in that theme file; preflight will tell you if it breaks contrast.
4. Run `/assemble <a goal>`; check Fury's page and that each hero card shows its own emblem and edge colour.
5. Open an old report from before 1.5.0: it should look exactly as it did.

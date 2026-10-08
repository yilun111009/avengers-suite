// Report themes: a look (accent colours, emblem, header band, tagline) per hero. Pure functions plus one file read.
// Nothing here ever puts text from a theme file into the page except the tagline, which is HTML-escaped, and colours,
// which are written only after they match #rrggbb. A theme can only choose an emblem by name from the fixed set below.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// the one front-matter parser (check-onboarding.mjs imports it)
export function parseFrontmatter(text) {
  const m = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
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

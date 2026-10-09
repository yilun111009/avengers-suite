#!/usr/bin/env node
// Usage: node build-assemble.mjs <combined.json> <out.html> [--no-theme]
// Renders the combined /assemble page: Fury's summary, one card per hero with a link to that hero's own report,
// the merged sources and confidence, and any disagreement the heroes themselves reported.
// Refuses (exit 3, nothing written) if any field looks like a credential. Links are only written when they stay inside heroes/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanSecrets } from './secrets.mjs';
import { themeFor } from './themes.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (Array.isArray(a) ? a : []);
const uniq = (a) => [...new Set(a)];

// only objects are results; a null or a string in the list is ignored instead of crashing the page
const onlyResults = (a) => list(a).filter((r) => r && typeof r === 'object');

export function mergeSources(results) {
  return uniq(onlyResults(results).filter((r) => r.status === 'ok').flatMap((r) => list(r.sources)));
}
export function mergeConfidence(results) {
  const ok = onlyResults(results).filter((r) => r.status === 'ok');
  const pick = (k) => uniq(ok.flatMap((r) => list(r.confidence?.[k])));
  return { confirmed: pick('confirmed'), graphOnly: pick('graphOnly'), unconfirmed: pick('unconfirmed') };
}
export function collectDisagreements(results) {
  return onlyResults(results).filter((r) => r.status === 'ok').flatMap((r) => list(r.disagrees).filter((d) => d && typeof d === 'object').map((d) => ({ hero: r.hero, ...d })));
}
// a link is only used when it is a relative path inside heroes/ with no ".." and no scheme
const safeLink = (p) => (typeof p === 'string' && /^heroes\/[A-Za-z0-9_-]+\/report\.html$/.test(p) ? p : null);

// the card edge uses the hero's light accent in light mode and its dark accent in dark mode (the light one is nearly invisible on the dark card)
const CARD_EDGE_CSS = '<style>' +
  '.item[style*="--hero"]{border-left:4px solid var(--hero)}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .item[style*="--hero"]{border-left-color:var(--hero-d)}}' +
  ':root[data-theme=dark] .item[style*="--hero"]{border-left-color:var(--hero-d)}' +
  '</style>';

// plain: no Fury band, no card emblems or edges, and cards link to each hero's report.plain.html
export function render(d, { plain = false } = {}) {
  const results = onlyResults(d.results);
  const pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url));
  const fury = plain ? null : themeFor('fury', pluginDir);
  const done = results.filter((r) => r.status === 'ok');
  const card = (r) => {
    if (r.status !== 'ok') {
      return `<li class="item bad"><b>${esc(r.hero)}</b> <span class="tag">${esc(r.model)}</span> <span class="age bad">failed</span>
<div class="q">${esc(r.task)}</div><p>${esc(r.error || 'no result')}</p><p class="muted">Re-run only this hero with <code>/assemble rerun ${esc(r.hero)}</code>. Nothing is re-run automatically.</p></li>`;
    }
    // the path is validated first; the plain page then points at the plain copy of the same hero folder
    const safe = safeLink(r.reportPath);
    const link = safe && plain ? safe.replace(/report\.html$/, 'report.plain.html') : safe;
    // a repeated hero is named hulk-2, hulk-3 ...; its look is the base hero's
    const t = plain ? null : themeFor(typeof r.hero === 'string' ? r.hero.replace(/-\d+$/, '') : r.hero, pluginDir);
    return `<li class="item"${t ? ` style="--hero:${t.accent};--hero-d:${t.accentDark}"` : ''}>${t ? t.emblemSvg + ' ' : ''}<b>${esc(r.hero)}</b> <span class="tag">${esc(r.model)}</span> <span class="tag">${esc(r.type)}</span>
<div class="q">${esc(r.task)}</div><p>${esc(r.summary)}</p>${link ? `<p><a href="${esc(link)}">Open ${esc(r.hero)}'s full report</a></p>` : ''}</li>`;
  };
  const conf = mergeConfidence(results);
  const confList = (title, items) => (items.length ? `<h3>${title}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const dis = collectDisagreements(results);
  const disHtml = dis.length
    ? `<h2>Where the heroes disagree</h2><p class="muted">Fury's inference from conflicting citations; the heroes' own reports are linked above.</p><ul>${dis.map((x) => `<li><b>${esc(x.hero)}</b> vs <b>${esc(x.with)}</b> about ${esc(x.about)}: <code>${esc(x.mine)}</code> against <code>${esc(x.theirs)}</code></li>`).join('')}</ul>`
    : '';
  const sources = mergeSources(results);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)} - Team report</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6670;--card:#f6f8fa;--line:#d0d7de;--accent:#0b7a3b;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a;--bad:#ff7b72}}
:root[data-theme=dark]{--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a;--bad:#ff7b72}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}h1{margin:0 0 4px;font-size:1.6rem}.muted,.meta{color:var(--muted)}.meta{font-size:.85rem}
ul{list-style:none;padding:0;margin:8px 0;display:grid;gap:10px}.card,.item{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;overflow-wrap:anywhere}
.item.bad{border-color:var(--bad)}.q{font-size:.88rem;color:var(--muted);font-style:italic}.tag{border:1px solid var(--line);border-radius:10px;padding:0 8px;font-size:.72rem}
.age.bad{color:var(--bad);border:1px solid var(--bad);border-radius:10px;padding:0 8px;font-size:.72rem}a{color:var(--accent)}code{font:12.5px ui-monospace,Consolas,monospace}
</style>${fury ? fury.css : ''}${fury ? CARD_EDGE_CSS : ''}</head><body><main>
${fury ? fury.bandHtml.replace('{{TITLE}}', () => esc(d.title)) : `<h1>${esc(d.title)}</h1>`}
<div class="meta">Goal: ${esc(d.question)} &middot; Treated as: Assemble question &middot; Generated ${esc(d.generated ?? '')}${d.commit ? ` &middot; commit <code>${esc(d.commit)}</code>` : ''}</div>
<h2>Summary</h2>
<div class="card"><p>${esc(d.summary)}</p>${d.plainSummary && d.plainSummary !== d.summary ? `<p class="muted">In plain words: ${esc(d.plainSummary)}</p>` : ''}</div>
<h2>The team</h2>
${done.length ? '' : '<div class="card"><p>No hero finished, so there is nothing to merge. See the failures below.</p></div>'}
<ul>${results.map(card).join('')}</ul>
${disHtml}
<h2>Confidence</h2>
${confList('Confirmed in source', conf.confirmed)}${confList('Graph only', conf.graphOnly)}${confList('Not confirmed', conf.unconfirmed)}${conf.confirmed.length + conf.graphOnly.length + conf.unconfirmed.length ? '' : '<p class="muted">No confidence notes were reported.</p>'}
${sources.length ? `<h2>Sources</h2><ul>${sources.map((s) => `<li><code>${esc(s)}</code></li>`).join('')}</ul>` : ''}
</main></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inPath, outPath, ...flags] = process.argv;
  if (!inPath || !outPath) { console.error('usage: node build-assemble.mjs <combined.json> <out.html> [--no-theme]'); process.exit(2); }
  let d;
  try { d = JSON.parse(readFileSync(inPath, 'utf8')); } catch (e) { console.error(`${inPath} is not valid JSON or cannot be read: ${e.code ?? 'parse error'}`); process.exit(2); }
  const hits = scanSecrets(d, '');
  if (hits.length) {
    console.error('REFUSING to write report: possible secrets found (values not shown). Remove or redact them in the JSON, then re-run.');
    hits.forEach((h) => console.error('  - ' + h));
    process.exit(3);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, render(d, { plain: flags.includes('--no-theme') }));
  console.log(`wrote ${outPath}`);
}

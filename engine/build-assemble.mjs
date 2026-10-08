#!/usr/bin/env node
// Usage: node build-assemble.mjs <combined.json> <out.html>
// Renders the combined /assemble page: Fury's summary, one card per hero with a link to that hero's own report,
// the merged sources and confidence, and any disagreement the heroes themselves reported.
// Refuses (exit 3, nothing written) if any field looks like a credential. Links are only written when they stay inside heroes/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanSecrets } from './secrets.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (Array.isArray(a) ? a : []);
const uniq = (a) => [...new Set(a)];

export function mergeSources(results) {
  return uniq(results.filter((r) => r.status === 'ok').flatMap((r) => list(r.sources)));
}
export function mergeConfidence(results) {
  const ok = results.filter((r) => r.status === 'ok');
  const pick = (k) => uniq(ok.flatMap((r) => list(r.confidence?.[k])));
  return { confirmed: pick('confirmed'), graphOnly: pick('graphOnly'), unconfirmed: pick('unconfirmed') };
}
export function collectDisagreements(results) {
  return results.filter((r) => r.status === 'ok').flatMap((r) => list(r.disagrees).map((d) => ({ hero: r.hero, ...d })));
}
// a link is only used when it is a relative path inside heroes/ with no ".." and no scheme
const safeLink = (p) => (typeof p === 'string' && /^heroes\/[A-Za-z0-9_-]+\/report\.html$/.test(p) ? p : null);

export function render(d) {
  const results = list(d.results);
  const done = results.filter((r) => r.status === 'ok');
  const card = (r) => {
    if (r.status !== 'ok') {
      return `<li class="item bad"><b>${esc(r.hero)}</b> <span class="tag">${esc(r.model)}</span> <span class="age bad">failed</span>
<div class="q">${esc(r.task)}</div><p>${esc(r.error || 'no result')}</p><p class="muted">Re-run only this hero: ask Fury to re-run ${esc(r.hero)}. Nothing is re-run automatically.</p></li>`;
    }
    const link = safeLink(r.reportPath);
    return `<li class="item"><b>${esc(r.hero)}</b> <span class="tag">${esc(r.model)}</span> <span class="tag">${esc(r.type)}</span>
<div class="q">${esc(r.task)}</div><p>${esc(r.summary)}</p>${link ? `<p><a href="${esc(link)}">Open ${esc(r.hero)}'s full report</a></p>` : ''}</li>`;
  };
  const conf = mergeConfidence(results);
  const confList = (title, items) => (items.length ? `<h3>${title}</h3><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  const dis = collectDisagreements(results);
  const disHtml = dis.length
    ? `<h2>Where the heroes disagree</h2><p class="muted">Reported by the heroes themselves; Fury's reading of them is his own inference.</p><ul>${dis.map((x) => `<li><b>${esc(x.hero)}</b> vs <b>${esc(x.with)}</b> about ${esc(x.about)}: <code>${esc(x.mine)}</code> against <code>${esc(x.theirs)}</code></li>`).join('')}</ul>`
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
</style></head><body><main>
<h1>${esc(d.title)}</h1>
<div class="meta">Goal: ${esc(d.question)} &middot; Treated as: Assemble question &middot; Generated ${esc(d.generated ?? '')}${d.commit ? ` &middot; commit <code>${esc(d.commit)}</code>` : ''}</div>
<h2>Summary</h2>
<div class="card"><p>${esc(d.summary)}</p></div>
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
  const [, , inPath, outPath] = process.argv;
  if (!inPath || !outPath) { console.error('usage: node build-assemble.mjs <combined.json> <out.html>'); process.exit(2); }
  const d = JSON.parse(readFileSync(inPath, 'utf8'));
  const hits = scanSecrets(d, '');
  if (hits.length) {
    console.error('REFUSING to write report: possible secrets found (values not shown). Remove or redact them in the JSON, then re-run.');
    hits.forEach((h) => console.error('  - ' + h));
    process.exit(3);
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, render(d));
  console.log(`wrote ${outPath}`);
}

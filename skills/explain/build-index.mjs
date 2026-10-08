#!/usr/bin/env node
// Usage: node build-index.mjs [flowsDir]      (default: docs/flows under the current directory)
// Writes <flowsDir>/index.html listing every question folder that contains a report.json.
// Reads only <flowsDir>/*/report.json and writes only <flowsDir>/index.html.
// Runs read-only git commands (rev-parse, rev-list, log) to show how much the code changed since each report; skips that if git is unavailable.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const flows = resolve(process.argv[2] ?? join(process.cwd(), 'docs', 'flows'));
if (!existsSync(flows)) { console.error(`no such folder: ${flows}`); process.exit(2); }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- read-only git: how stale is each report? ----
const repo = resolve(flows, '..', '..');
const git = (...a) => { try { return execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim(); } catch { return null; } };
const inGit = git('rev-parse', '--is-inside-work-tree') === 'true';
const citedFiles = (d) => [...new Set([...(d?.steps ?? []), ...(d?.rules ?? [])].map((x) => String(x?.cite ?? '').replace(/:\d+(-\d+)?$/, '').replaceAll('\\', '/')).filter((f) => f && !f.startsWith('/') && !f.includes('..') && !/[\s*?]/.test(f)))];
function drift(d) {
  if (!inGit || !d?.commit || !/^[0-9a-f]{7,40}$/i.test(d.commit)) return null;
  if (git('cat-file', '-e', d.commit + '^{commit}') === null && git('rev-parse', '--verify', '--quiet', d.commit) === null) return { unknown: true };
  const total = parseInt(git('rev-list', '--count', `${d.commit}..HEAD`) ?? '', 10);
  if (Number.isNaN(total)) return { unknown: true };
  const files = citedFiles(d);
  const touched = files.length ? parseInt(git('rev-list', '--count', `${d.commit}..HEAD`, '--', ...files) ?? '', 10) : NaN;
  return { total, touched: Number.isNaN(touched) ? null : touched, files: files.length };
}

const TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact'];
const rows = [];
for (const name of readdirSync(flows)) {
  const dir = join(flows, name);
  if (name.startsWith('_') || name.startsWith('.') || !statSync(dir).isDirectory()) continue;
  const jsonPath = join(dir, 'report.json');
  if (!existsSync(jsonPath)) continue;
  let d;
  try { d = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch { d = null; }
  const mtime = statSync(jsonPath).mtime;
  rows.push({
    name,
    title: d?.title ?? name,
    question: d?.question ?? '',
    summary: d?.summary ?? (d ? '' : 'report.json could not be read'),
    date: d?.generated ?? mtime.toISOString().slice(0, 10),
    sort: mtime.getTime(),
    hasHtml: existsSync(join(dir, 'report.html')),
    hasAnswer: existsSync(join(dir, 'answer.md')),
    commit: d?.commit ?? null,
    type: TYPES.includes(d?.type) ? d.type : 'workflow',
    drift: drift(d),
  });
}
rows.sort((a, b) => b.sort - a.sort);

const badge = (r) => {
  const dr = r.drift;
  if (!dr) return '';
  if (dr.unknown) return ' &middot; <span class="age warn" title="the commit recorded in this report is not in this repository">commit not found</span>';
  if (dr.touched !== null && dr.touched > 0) return ` &middot; <span class="age bad" title="${dr.touched} commit(s) changed files this report cites, ${dr.total} commit(s) overall since it was written">${dr.touched} commit${dr.touched === 1 ? '' : 's'} touched cited files</span>`;
  if (dr.total > 0) return ` &middot; <span class="age warn" title="cited files unchanged, but the repo moved on">${dr.total} commit${dr.total === 1 ? '' : 's'} since</span>`;
  return ' &middot; <span class="age ok">up to date</span>';
};
const card = (r) => `<li class="item" data-type="${r.type}" data-q="${esc((r.title + ' ' + r.question + ' ' + r.summary + ' ' + r.name + ' ' + r.type).toLowerCase())}">
<a class="title" href="${encodeURI(r.name)}/${r.hasHtml ? 'report.html' : 'report.json'}">${esc(r.title)}</a>
<div class="meta">${esc(r.date)} &middot; <span class="tag">${r.type}</span> &middot; <code>${esc(r.name)}/</code>${r.hasAnswer ? ` &middot; <a href="${encodeURI(r.name)}/answer.md">answer</a>` : ''}${badge(r)}</div>
${r.question ? `<div class="q">${esc(r.question)}</div>` : ''}
${r.summary ? `<p>${esc(r.summary.length > 220 ? r.summary.slice(0, 217) + '...' : r.summary)}</p>` : ''}</li>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flow reports</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6670;--card:#f6f8fa;--line:#d0d7de;--accent:#0b7a3b}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a}}
:root[data-theme=dark]{--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,Segoe UI,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
h1{margin:0 0 4px;font-size:1.6rem}.muted{color:var(--muted)}
input{width:100%;margin:16px 0;padding:9px 12px;font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:6px}
ul{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.item{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px}
.title{font-weight:600;color:var(--accent);text-decoration:none}.title:hover{text-decoration:underline}
.meta{color:var(--muted);font-size:.8rem;margin:2px 0}.q{font-size:.88rem;color:var(--muted);font-style:italic}
.item p{margin:6px 0 0;font-size:.9rem}.item{overflow-wrap:anywhere}ul{min-width:0}
.tag{border:1px solid var(--line);border-radius:10px;padding:0 8px;font-size:.72rem}
select{margin:0 0 12px;padding:6px 10px;font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:6px}
a{color:var(--accent)}.age{border-radius:10px;padding:0 8px;border:1px solid var(--line)}.age.ok{color:var(--accent)}.age.warn{color:#9a6700}.age.bad{color:#b3261e;border-color:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .age.warn{color:#e3b341}:root:not([data-theme=light]) .age.bad{color:#ff7b72;border-color:#ff7b72}}
code{font:12.5px ui-monospace,Consolas,monospace}
a{color:var(--accent)}
</style></head>
<body><main>
<h1>Flow reports</h1>
<div class="muted">${rows.length} report${rows.length === 1 ? '' : 's'} &middot; newest first &middot; generated ${new Date().toISOString().slice(0, 10)}</div>
<input id="f" type="search" placeholder="Filter by title, question or folder" aria-label="Filter reports" ${rows.length ? '' : 'hidden'}>
<select id="t" aria-label="Filter by type" ${rows.length ? '' : 'hidden'}><option value="">All types</option>${TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
<ul id="l">${rows.map(card).join('') || '<li class="item muted">No reports yet. Run <code>/ask &lt;question&gt;</code> to create one.</li>'}</ul>
</main>
<script>
var f=document.getElementById('f'),t=document.getElementById('t');function ap(){var q=f.value.toLowerCase(),ty=t.value;document.querySelectorAll('.item[data-q]').forEach(function(i){i.style.display=(i.dataset.q.indexOf(q)<0||(ty&&i.dataset.type!==ty))?'none':''})}if(f)f.oninput=ap;if(t)t.onchange=ap;
</script></body></html>`;

writeFileSync(join(flows, 'index.html'), html);
console.log(`wrote ${join(flows, 'index.html')} (${rows.length} reports)`);

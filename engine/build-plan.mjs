#!/usr/bin/env node
// Usage: node build-plan.mjs <plan.json> <outDir> --model opus|sonnet|haiku [--slugs a,b] [--checks checks.json] [--commit sha] [--generated YYYY-MM-DD]
// Merges the planner's JSON with the fields only the caller knows, validates it, scans for secrets, and writes
// plan.json, plan.html and plan.md. The model is required and is never defaulted: the user chose it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODELS } from './constants.mjs';
import { isMain } from './cli.mjs';
import { scanSecrets } from './secrets.mjs';
import { validatePlan } from './validate-plan.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = (a) => (Array.isArray(a) ? a : []);
const COUNT_KEYS = ['ok', 'moved', 'missing', 'outside', 'invalid'];
const notOk = (checks) => arr(checks?.results).filter((r) => r.status !== 'ok');
const countsLine = (c) => COUNT_KEYS.map((k) => `${k} ${Number(c.counts?.[k] ?? 0)}`).join(', ');

export function renderMarkdown(p) {
  const L = [
    `# ${p.title}`, '',
    `**Goal:** ${p.goal}`,
    `**Planned by:** ${p.model} · ${p.generated ?? 'undated'} · commit ${p.commit ?? 'unknown'}`,
    `**From reports:** ${p.slugs.join(', ')}`, '',
    p.summary, '',
  ];
  p.stages.forEach((s, i) => {
    L.push(`## Stage ${i + 1}: ${s.name}`, '');
    if (s.purpose) L.push(s.purpose, '');
    s.steps.forEach((st, j) => {
      L.push(`### Step ${i + 1}.${j + 1}`, '', `- [ ] ${st.text}`,
        `  - Files: ${st.files.length ? st.files.map((f) => `\`${f}\``).join(', ') : 'none named'}`,
        `  - Change: ${st.change}`, `  - Verify: ${st.verify}`);
      if (st.risk) L.push(`  - Risk: ${st.risk}`);
      L.push('');
    });
    L.push(`**Go / no-go for stage ${i + 1}**`, '');
    s.goNoGo.forEach((g) => L.push(`- [ ] ${g.check} (go when: ${g.passWhen})`));
    L.push('');
  });
  L.push('## Assumptions from the research', '', ...(p.assumptions.length ? p.assumptions.map((a) => `- ${a}`) : ['- none recorded']), '');
  L.push('## Citation check', '');
  if (p.checks) {
    L.push(countsLine(p.checks), ...notOk(p.checks).map((r) => `- \`${r.cite}\`: ${r.status}`), '');
  } else {
    L.push('The citation check was not run.', '');
  }
  return L.join('\n');
}

const CSS = `:root{--bg:#f6f7f9;--fg:#1b1f24;--muted:#5b6672;--card:#fff;--line:#d9dee4;--accent:#1f5fbf;--ok:#17703a;--warn:#9a6700;--bad:#b42318}
@media (prefers-color-scheme: dark){:root{--bg:#0f1318;--fg:#e6eaee;--muted:#9aa6b2;--card:#171d24;--line:#2a333d;--accent:#6ea8fe;--ok:#4cc38a;--warn:#e3b341;--bad:#ff7b72}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 64px}
h1{margin:.2em 0}h2{margin:1.6em 0 .3em}h3{margin:.6em 0 .3em;font-size:1rem}
.kicker{margin:0;color:var(--muted);font-size:.85rem;letter-spacing:.06em;text-transform:uppercase}
.muted,.meta{color:var(--muted)}.meta{font-size:.9rem}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
nav a{padding:4px 12px;border:1px solid var(--line);border-radius:999px;color:var(--accent);text-decoration:none;background:var(--card)}
details.step{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:10px 0}
summary{cursor:pointer;font-weight:600}.n{color:var(--accent);margin-right:6px}
dl{margin:8px 0 0;display:grid;grid-template-columns:5.5rem 1fr;gap:4px 12px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}
code{font:.85em ui-monospace,Consolas,monospace;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
.risk{color:var(--warn)}
.gate{border-left:4px solid var(--ok);padding:2px 0 2px 14px;margin:14px 0}
.gate ul{margin:0;padding:0;list-style:none}.gate li{margin:6px 0}.gate span{display:block;color:var(--muted);font-size:.9rem}
.badge{display:inline-block;padding:1px 10px;border-radius:999px;border:1px solid var(--line);font-size:.85rem}
.badge.ok{color:var(--ok)}.badge.moved,.badge.invalid{color:var(--warn)}.badge.missing,.badge.outside{color:var(--bad)}
@media (max-width:520px){dl{grid-template-columns:1fr}}
@media print{body{background:#fff;color:#000}nav{display:none}details.step{break-inside:avoid}}`;

export function renderHtml(p) {
  const nav = p.stages.map((s, i) => `<a href="#stage-${i + 1}">${i + 1}. ${esc(s.name)}</a>`).join('');
  const stages = p.stages.map((s, i) => {
    const steps = s.steps.map((st, j) => `<details class="step" open><summary><span class="n">${i + 1}.${j + 1}</span>${esc(st.text)}</summary>
<dl><dt>Files</dt><dd>${st.files.length ? st.files.map((f) => `<code>${esc(f)}</code>`).join(' ') : 'none named'}</dd>
<dt>Change</dt><dd>${esc(st.change)}</dd><dt>Verify</dt><dd>${esc(st.verify)}</dd>${st.risk ? `<dt>Risk</dt><dd class="risk">${esc(st.risk)}</dd>` : ''}</dl></details>`).join('\n');
    const gates = s.goNoGo.map((g) => `<li><b>${esc(g.check)}</b><span>Go when: ${esc(g.passWhen)}</span></li>`).join('');
    return `<section id="stage-${i + 1}"><h2>Stage ${i + 1}: ${esc(s.name)}</h2>${s.purpose ? `<p class="muted">${esc(s.purpose)}</p>` : ''}
${steps}
<div class="gate"><h3>Go / no-go</h3><ul>${gates}</ul></div></section>`;
  }).join('\n');
  const c = p.checks;
  const checks = c
    ? `<p>${COUNT_KEYS.map((k) => `<span class="badge ${k}">${k} ${Number(c.counts?.[k] ?? 0)}</span>`).join(' ')}</p>${notOk(c).length ? `<ul>${notOk(c).map((r) => `<li><code>${esc(r.cite)}</code> ${esc(r.status)}</li>`).join('')}</ul>` : ''}`
    : '<p class="muted">The citation check was not run.</p>';
  const assumptions = p.assumptions.length ? `<ul>${p.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="muted">none recorded</p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><style>${CSS}</style></head><body><main>
<header><p class="kicker">Mission Control · flight plan</p><h1>${esc(p.title)}</h1><p><b>Goal:</b> ${esc(p.goal)}</p>
<p class="meta">Planned by <b>${esc(p.model)}</b> · ${esc(p.generated ?? 'undated')} · commit ${esc(p.commit ?? 'unknown')} · from reports: ${p.slugs.map(esc).join(', ')}</p></header>
<p>${esc(p.summary)}</p>
<nav>${nav}</nav>
${stages}
<section><h2>Assumptions from the research</h2>${assumptions}</section>
<section><h2>Citation check</h2>${checks}</section>
</main></body></html>
`;
}

if (isMain(import.meta.url)) {
  const [, , inPath, outDir, ...rest] = process.argv;
  const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const fail = (code, ...msg) => { console.error(msg.join('\n')); process.exit(code); };
  if (!inPath || !outDir) fail(2, 'usage: node build-plan.mjs <plan.json> <outDir> --model opus|sonnet|haiku [--slugs a,b] [--checks checks.json] [--commit sha] [--generated YYYY-MM-DD]');
  const model = flag('--model');
  if (!MODELS.includes(model)) fail(2, `--model ${MODELS.join('|')} is required: the user chooses the model, there is no default.`);
  let raw;
  let checks;
  try { raw = JSON.parse(readFileSync(inPath, 'utf8')); } catch { fail(2, 'plan.json is not valid JSON.'); }
  if (flag('--checks')) { try { checks = JSON.parse(readFileSync(flag('--checks'), 'utf8')); } catch { fail(2, 'the --checks file is not valid JSON.'); } }
  const plan = {
    ...raw,
    model,
    slugs: (flag('--slugs') ?? '').split(',').filter(Boolean),
    generated: flag('--generated') ?? new Date().toISOString().slice(0, 10),
    commit: flag('--commit') ?? 'unknown',
    ...(checks ? { checks } : {}),
  };
  const v = validatePlan(plan);
  if (!v.ok) fail(2, 'The plan is not valid:', ...v.errors.map((e) => `  - ${e}`));
  const hits = scanSecrets(plan, '');
  if (hits.length) fail(3, 'REFUSING to write the plan: possible secrets found (values not shown). Remove them from the plan, then re-run.', ...hits.map((h) => `  - ${h}`));
  mkdirSync(outDir, { recursive: true });
  const out = { json: join(outDir, 'plan.json'), html: join(outDir, 'plan.html'), md: join(outDir, 'plan.md') };
  writeFileSync(out.json, JSON.stringify(plan, null, 2));
  writeFileSync(out.html, renderHtml(plan));
  writeFileSync(out.md, renderMarkdown(plan));
  console.log(JSON.stringify(out));
}

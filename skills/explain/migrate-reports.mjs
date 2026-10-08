#!/usr/bin/env node
// Usage: node migrate-reports.mjs [flowsDir] [--apply]
// Moves pre-0.3.0 loose reports (docs/flows/<slug>.json + <slug>.html) into docs/flows/<slug>/report.{json,html}.
// Default is a dry run that only prints the plan. --apply performs it. Old loose files are MOVED, not copied (no backup).
// Touches only files directly inside <flowsDir> and the new <slug>/ folders under it. Never overwrites an existing folder.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const flows = resolve(args.find((a) => !a.startsWith('--')) ?? join(process.cwd(), 'docs', 'flows'));
if (!existsSync(flows)) { console.error(`no such folder: ${flows}`); process.exit(2); }
const here = dirname(fileURLToPath(import.meta.url));

const files = readdirSync(flows).filter((f) => statSync(join(flows, f)).isFile());
const slugs = new Set();
for (const f of files) {
  const m = /^(.+)\.(json|html)$/.exec(f);
  if (!m || m[1].startsWith('_') || m[1].startsWith('.') || m[1] === 'index') continue;
  slugs.add(m[1]);
}

const plan = [...slugs].sort().map((slug) => {
  const json = join(flows, `${slug}.json`), html = join(flows, `${slug}.html`), dir = join(flows, slug);
  const hasJson = existsSync(json), hasHtml = existsSync(html);
  let skip = null;
  if (existsSync(dir)) skip = `folder ${slug}/ already exists`;
  else if (hasJson) { try { JSON.parse(readFileSync(json, 'utf8')); } catch { skip = 'JSON is not valid'; } }
  return { slug, json, html, dir, hasJson, hasHtml, skip };
});

if (!plan.length) { console.log('Nothing to migrate: no loose reports in ' + flows); process.exit(0); }

console.log(`${apply ? 'Migrating' : 'Plan (dry run, nothing changed)'} in ${flows}:`);
for (const p of plan) {
  if (p.skip) { console.log(`  SKIP  ${p.slug}: ${p.skip}`); continue; }
  const what = p.hasJson ? (p.hasHtml ? 'json + html moved, html rebuilt' : 'json moved, html built') : 'html moved only (no JSON, cannot rebuild)';
  console.log(`  MOVE  ${p.slug}.* -> ${p.slug}/report.*   (${what})`);
}
if (!apply) {
  console.log('\nOld loose files will be moved, not copied; no backup is kept. Re-run with --apply to do it.');
  process.exit(0);
}

let moved = 0, rebuilt = 0, kept = 0;
for (const p of plan) {
  if (p.skip) continue;
  mkdirSync(p.dir);
  if (p.hasHtml) renameSync(p.html, join(p.dir, 'report.html'));
  if (p.hasJson) {
    const d = JSON.parse(readFileSync(p.json, 'utf8'));
    if (!d.generated) d.generated = statSync(p.json).mtime.toISOString().slice(0, 10);
    writeFileSync(join(p.dir, 'report.json'), JSON.stringify(d, null, 2));
    unlinkSync(p.json);
    const out = join(p.dir, 'report.new.html');
    try {
      execFileSync(process.execPath, [join(here, 'build-report.mjs'), join(p.dir, 'report.json'), out], { stdio: ['ignore', 'ignore', 'pipe'] });
      renameSync(out, join(p.dir, 'report.html'));
      rebuilt++;
    } catch (e) {
      try { unlinkSync(out); } catch { /* no partial file */ }
      kept++;
      const why = e.status === 3 ? 'build refused: possible secret in the JSON' : 'build failed';
      console.log(`  NOTE  ${p.slug}: ${why}; ${p.hasHtml ? 'kept the old HTML as report.html' : 'no HTML written'}`);
    }
  }
  moved++;
}
console.log(`\nMoved ${moved} report(s); rebuilt ${rebuilt} HTML file(s)${kept ? `, ${kept} left as-is (see NOTE above)` : ''}.`);
console.log('Next: run build-index.mjs to refresh docs/flows/index.html.');

#!/usr/bin/env node
// Usage: node read-reports.mjs <repoRoot> <slug>...
// Prints { reports: [{slug, data}], errors: [], cites: [] }. A report text is data: nothing here executes or follows it.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FLOWS_ROOT, SLUG_RE } from './constants.mjs';
import { parseCite } from './cite.mjs';
import { isMain } from './cli.mjs';

const arr = (a) => (Array.isArray(a) ? a : []);

export function loadReports(repoRoot, slugs) {
  const reports = [];
  const errors = [];
  for (const slug of slugs) {
    if (!SLUG_RE.test(slug)) { errors.push(`${slug}: not a valid report folder name`); continue; }
    const dir = join(repoRoot, FLOWS_ROOT, slug);
    if (!existsSync(dir)) { errors.push(`${slug}: no folder ${FLOWS_ROOT}/${slug}`); continue; }
    const files = [];
    if (existsSync(join(dir, 'report.json'))) files.push({ file: join(dir, 'report.json'), label: slug });
    const heroes = join(dir, 'heroes');
    if (existsSync(heroes)) {
      for (const h of readdirSync(heroes).sort()) {
        const f = join(heroes, h, 'report.json');
        if (existsSync(f)) files.push({ file: f, label: `${slug}/heroes/${h}` });
      }
    }
    if (!files.length) { errors.push(`${slug}: no report.json found`); continue; }
    for (const { file, label } of files) {
      let data;
      try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { errors.push(`${label}: report.json is not valid JSON`); continue; }
      const missing = ['title', 'summary'].filter((f) => typeof data?.[f] !== 'string' || !data[f].trim());
      if (missing.length) { errors.push(`${label}: report.json is missing ${missing.join(' and ')}`); continue; }
      reports.push({ slug: label, data });
    }
  }
  return { reports, errors };
}

export function collectCites(reports) {
  const out = new Set();
  const add = (v) => { if (typeof v === 'string' && parseCite(v)) out.add(v.trim()); };
  for (const { data: d } of reports) {
    arr(d.sources).forEach(add);
    arr(d.steps).forEach((s) => add(s?.cite));
    arr(d.rules).forEach((r) => add(r?.cite));
    arr(d.sections).forEach((sec) => arr(sec?.rows).forEach((row) => arr(row).forEach(add)));
    arr(d.results).forEach((r) => arr(r?.sources).forEach(add));
  }
  return [...out];
}

if (isMain(import.meta.url)) {
  const [, , root, ...slugs] = process.argv;
  if (!root || !slugs.length) { console.error('usage: node read-reports.mjs <repoRoot> <slug>...'); process.exit(2); }
  const { reports, errors } = loadReports(root, slugs);
  console.log(JSON.stringify({ reports, errors, cites: collectCites(reports) }));
}

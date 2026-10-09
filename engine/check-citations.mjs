#!/usr/bin/env node
// Usage: node check-citations.mjs <repoRoot>   (JSON array of "path:line" strings on stdin)
// Prints { results: [{cite, status}], counts }. status: ok | moved (line out of range) | missing | outside (leaves the repo) | invalid.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseCite } from './cite.mjs';
import { isMain, readStdin } from './cli.mjs';

const STATUSES = ['ok', 'moved', 'missing', 'outside', 'invalid'];
const escapes = (rel) => rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);

export function checkCitation(repoRoot, cite) {
  const p = parseCite(cite);
  if (!p) return { cite, status: 'invalid' };
  if (isAbsolute(p.path)) return { cite, status: 'outside' };
  const root = realpathSync(repoRoot);
  const target = resolve(root, p.path);
  if (escapes(relative(root, target))) return { cite, status: 'outside' };
  let real;
  try { real = realpathSync(target); } catch { return { cite, status: 'missing' }; }
  if (escapes(relative(root, real))) return { cite, status: 'outside' }; // a symlink pointing out of the repo
  if (!statSync(real).isFile()) return { cite, status: 'missing' };
  const lines = readFileSync(real, 'utf8').replace(/\n$/, '').split('\n').length;
  return { cite, status: p.line >= 1 && p.line <= lines ? 'ok' : 'moved' };
}

export function checkCitations(repoRoot, cites) {
  const results = [...new Set(cites)].map((c) => checkCitation(repoRoot, c));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, results.filter((r) => r.status === s).length]));
  return { results, counts };
}

if (isMain(import.meta.url)) {
  const [, , root] = process.argv;
  let cites;
  try { cites = JSON.parse(readStdin()); } catch { cites = null; }
  if (!root || !Array.isArray(cites) || !cites.every((c) => typeof c === 'string')) {
    console.error('usage: node check-citations.mjs <repoRoot>  (a JSON array of strings on stdin)');
    process.exit(2);
  }
  console.log(JSON.stringify(checkCitations(root, cites)));
}

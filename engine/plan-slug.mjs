#!/usr/bin/env node
// Usage: node plan-slug.mjs <repoRoot>   (the plan title on stdin). Prints a folder name that is free under docs/plans/.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_ROOT } from './constants.mjs';
import { isMain, readStdin } from './cli.mjs';
import { slugify, uniqueSlug } from './slug.mjs';

if (isMain(import.meta.url)) {
  const [, , root] = process.argv;
  if (!root) { console.error('usage: node plan-slug.mjs <repoRoot>  (title on stdin)'); process.exit(2); }
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  console.log(uniqueSlug(slugify(readStdin()), (s) => existsSync(join(root, PLAN_ROOT, s)), today));
}

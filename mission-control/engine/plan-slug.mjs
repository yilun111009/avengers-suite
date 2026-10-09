#!/usr/bin/env node
// Usage: node plan-slug.mjs <repoRoot>   (the plan title on stdin). Prints a folder name that is free under docs/plans/:
// <YYYY-MM-DD>-<topic>, with -2, -3 ... when taken (the naming rule shared with repo-avengers, in naming.mjs).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PLAN_ROOT } from './constants.mjs';
import { isMain, readStdin } from './cli.mjs';
import { folderName, localDate, uniqueName } from './naming.mjs';

if (isMain(import.meta.url)) {
  const [, , root] = process.argv;
  if (!root) { console.error('usage: node plan-slug.mjs <repoRoot>  (title on stdin)'); process.exit(2); }
  const base = folderName({ date: localDate(), text: readStdin(), fallback: 'plan' });
  console.log(uniqueName(base, (s) => existsSync(join(root, PLAN_ROOT, s))));
}

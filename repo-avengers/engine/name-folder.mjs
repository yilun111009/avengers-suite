#!/usr/bin/env node
// Usage: node name-folder.mjs <flowsDir> --type <type>   (the report title on stdin)
// Prints a free folder name under <flowsDir>: <YYYY-MM-DD>-<type>-<topic>, with -2, -3 ... when taken. Creates nothing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_TYPES } from './types.mjs';
import { folderName, localDate, uniqueName } from './naming.mjs';

const args = process.argv.slice(2);
const flows = args[0];
const at = args.indexOf('--type');
const type = at > 0 ? args[at + 1] : undefined;
if (!flows || !REPORT_TYPES.includes(type)) {
  console.error(`usage: node name-folder.mjs <flowsDir> --type ${REPORT_TYPES.join('|')}  (title on stdin)`);
  process.exit(2);
}
const base = folderName({ date: localDate(), tag: type, text: readFileSync(0, 'utf8'), fallback: 'question' });
console.log(uniqueName(base, (n) => existsSync(join(flows, n))));

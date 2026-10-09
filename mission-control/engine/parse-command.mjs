#!/usr/bin/env node
// Usage: node parse-command.mjs <repoRoot>   (the /flightplan arguments on stdin)
// Prints { slugs, model, goal, errors }. Leading words that name folders in docs/flows/ are slugs; the first other word starts the goal.
// A word is a folder's exact name or a short name (`refund-flow` for 2026-10-09-workflow-refund-flow, see naming.mjs);
// slugs are always the full folder names.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FLOWS_ROOT, MODELS, SLUG_RE } from './constants.mjs';
import { isMain, readStdin } from './cli.mjs';
import { resolveName } from './naming.mjs';

// resolve(word) returns the folder name a word stands for, or null when it names no folder
export function parseCommand(text, resolve) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const slugs = [];
  let i = 0;
  for (let name; i < words.length && SLUG_RE.test(words[i]) && (name = resolve(words[i])); i++) {
    if (!slugs.includes(name)) slugs.push(name);
  }
  // only a real model name counts; "on <anything else>" stays in the goal and the user is asked for a model
  let model = null;
  if (words[i]?.toLowerCase() === 'on' && MODELS.includes(words[i + 1]?.toLowerCase())) {
    model = words[i + 1].toLowerCase();
    i += 2;
  }
  const goal = words.slice(i).join(' ');
  const errors = [];
  if (!slugs.length) {
    errors.push(words[0]
      ? `"${words[0]}" is not a folder in ${FLOWS_ROOT}/. Name at least one report folder first.`
      : `Name at least one report folder from ${FLOWS_ROOT}/ first.`);
  }
  if (slugs.length && !goal) errors.push('Say what the plan is for, after the folder names.');
  return { slugs, model, goal, errors };
}

if (isMain(import.meta.url)) {
  const [, , root] = process.argv;
  if (!root) { console.error('usage: node parse-command.mjs <repoRoot>  (arguments on stdin)'); process.exit(2); }
  let names = [];
  try { names = readdirSync(join(root, FLOWS_ROOT), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { /* no docs/flows yet */ }
  console.log(JSON.stringify(parseCommand(readStdin(), (w) => resolveName(w, names))));
}

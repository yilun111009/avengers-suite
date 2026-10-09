#!/usr/bin/env node
// Usage: node parse-command.mjs <repoRoot>   (the /flightplan arguments on stdin)
// Prints { slugs, model, goal, errors }. Leading words that are folders in docs/flows/ are slugs; the first other word starts the goal.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { FLOWS_ROOT, MODELS, SLUG_RE } from './constants.mjs';
import { isMain, readStdin } from './cli.mjs';

export function parseCommand(text, isFolder) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const slugs = [];
  let i = 0;
  while (i < words.length && SLUG_RE.test(words[i]) && isFolder(words[i])) {
    if (!slugs.includes(words[i])) slugs.push(words[i]);
    i++;
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
  const isFolder = (w) => { try { return statSync(join(root, FLOWS_ROOT, w)).isDirectory(); } catch { return false; } };
  console.log(JSON.stringify(parseCommand(readStdin(), isFolder)));
}

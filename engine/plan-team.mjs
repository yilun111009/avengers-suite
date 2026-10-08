#!/usr/bin/env node
// Team plan checks for /assemble. Pure functions plus a small CLI; reads only heroes/*.md file names, writes nothing.
//   node plan-team.mjs validate   plan JSON on stdin -> {ok, errors, plan}
//   node plan-team.mjs show       plan JSON on stdin -> the approval text
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MAX_HEROES = 5;
const MODELS = ['sonnet', 'opus', 'haiku'];
const WEIGHT = { haiku: 0.5, sonnet: 1, opus: 3 };

export function heroNames(pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url))) {
  const dir = join(pluginDir, 'heroes');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort() : [];
}

export function normalizeHero(name, known) {
  const n = String(name ?? '').trim().replace(/^\//, '').trim().toLowerCase();
  return n && known.includes(n) ? n : null;
}

export function validatePlan(plan, known) {
  const errors = [];
  const heroes = Array.isArray(plan?.heroes) ? plan.heroes : [];
  if (!heroes.length) errors.push('the plan needs at least one hero');
  if (heroes.length > MAX_HEROES) errors.push(`the plan has ${heroes.length} heroes; at most ${MAX_HEROES} are allowed`);
  const out = heroes.map((h, i) => {
    const name = normalizeHero(h?.hero, known);
    if (!name) errors.push(`hero ${i + 1}: unknown hero "${h?.hero ?? ''}"`);
    const model = h?.model ?? 'sonnet';
    if (!MODELS.includes(model)) errors.push(`hero ${i + 1} (${h?.hero ?? ''}): unknown model "${model}"`);
    const task = String(h?.task ?? '').trim();
    if (!task) errors.push(`hero ${i + 1} (${h?.hero ?? ''}): the task is empty`);
    return { hero: name ?? String(h?.hero ?? ''), model, task, why: String(h?.why ?? '').trim() };
  });
  return { ok: errors.length === 0, errors, plan: errors.length ? null : { goal: String(plan?.goal ?? '').trim(), heroes: out } };
}

export function costLine(plan) {
  const n = plan.heroes.length;
  const opus = plan.heroes.filter((h) => h.model === 'opus').length;
  const w = Math.max(1, Math.round(plan.heroes.reduce((s, h) => s + (WEIGHT[h.model] ?? 1), 0)));
  return `Rough cost: ${n} agent${n === 1 ? '' : 's'} (${opus} opus), about ${w}x a normal /ask`;
}

export function approvalText(plan) {
  const wName = Math.max(...plan.heroes.map((h) => h.hero.length));
  const lines = plan.heroes.map((h, i) => `${i + 1}. ${h.hero.padEnd(wName)}  ${h.model.padEnd(6)}  ${h.task}`);
  const single = plan.heroes.length === 1 ? ['A single hero is enough for this goal.'] : [];
  return [`Fury's plan for: "${plan.goal}"`, ...lines, ...single, costLine(plan)].join('\n');
}

export function applyChoice(plan, choice) {
  if (choice === 'cancel') return null;
  if (choice === 'sonnet') return { ...plan, heroes: plan.heroes.map((h) => ({ ...h, model: 'sonnet' })) };
  return plan;
}

export function applyEdit(plan, edit, known) {
  const errors = [];
  let heroes = plan.heroes.map((h) => ({ ...h }));
  for (const d of edit?.drop ?? []) {
    const name = normalizeHero(d, known);
    const idx = heroes.findIndex((h) => h.hero === name);
    if (idx < 0) errors.push(`cannot drop "${d}": it is not in the plan`);
    else heroes.splice(idx, 1);
  }
  for (const [who, model] of Object.entries(edit?.models ?? {})) {
    const name = normalizeHero(who, known);
    if (!MODELS.includes(model)) errors.push(`unknown model "${model}" for ${who}`);
    const targets = heroes.filter((h) => h.hero === name);
    if (!targets.length) errors.push(`cannot change the model of "${who}": it is not in the plan`);
    targets.forEach((h) => { h.model = model; });
  }
  for (const a of edit?.add ?? []) {
    heroes.push({ hero: a?.hero, model: a?.model ?? 'sonnet', task: a?.task ?? '', why: a?.why ?? '' });
  }
  if (errors.length) return { ok: false, errors, plan: null };
  return validatePlan({ goal: plan.goal, heroes }, known);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2];
  const input = readFileSync(0, 'utf8');
  let plan;
  try { plan = JSON.parse(input); } catch { console.log(JSON.stringify({ ok: false, errors: ['the plan is not valid JSON'], plan: null })); process.exit(1); }
  const r = validatePlan(plan, heroNames());
  if (cmd === 'show' && r.ok) { console.log(approvalText(r.plan)); process.exit(0); }
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

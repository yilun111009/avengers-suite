#!/usr/bin/env node
// Mechanical onboarding checks for repo-avengers. Prints one JSON object to stdout.
//   node check-onboarding.mjs preflight          hard checks + soft warnings + freshness info
//   node check-onboarding.mjs validate-profile   do the paths named in docs/flows/_repo-profile.md still exist?
//   node check-onboarding.mjs record             write docs/flows/_onboarding.md (the only file this script writes, plus a temp probe)
// Run from the repository root. The only location this script ever writes is <repo>/docs/flows/.
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HERO_TYPES } from './types.mjs';

const cmd = process.argv[2] ?? 'preflight';
const root = process.cwd();
const flows = join(root, 'docs', 'flows');
const profilePath = join(flows, '_repo-profile.md');
const onboardPath = join(flows, '_onboarding.md');
// AVENGERS_AGENT_PATH and AVENGERS_PLUGIN_DIR exist so tests can point the checks at fixture files; the checks still apply in full.
const agentPath = process.env.AVENGERS_AGENT_PATH ?? fileURLToPath(new URL('../agents/repo-avengers.md', import.meta.url));
const pluginDir = process.env.AVENGERS_PLUGIN_DIR ?? fileURLToPath(new URL('../', import.meta.url));
const CORE_HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk'];
const MODELS = ['sonnet', 'opus', 'haiku'];
const NON_HERO_SKILLS = new Set(['ask', 'assemble', 'explain']);
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];
const ALLOWED_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const SRC_EXT = /\.(cs|ts|tsx|js|jsx|mjs|py|java|kt|go|rs|rb|php|swift|scala|c|cc|cpp|h|sql|vue|svelte)$/i;
const SKIP = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', 'build', 'target', 'vendor', '.venv', 'venv', '__pycache__']);

const out = (o) => { console.log(JSON.stringify(o, null, 2)); process.exit(o.ok === false ? 1 : 0); };
const tryRun = (c, a) => { try { return execFileSync(c, a, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

function countSource(dir, depth = 0, acc = { n: 0 }) {
  if (depth > 4 || acc.n >= 20) return acc.n;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc.n; }
  for (const e of entries) {
    if (acc.n >= 20) break;
    if (e.isDirectory()) { if (!SKIP.has(e.name)) countSource(join(dir, e.name), depth + 1, acc); }
    else if (SRC_EXT.test(e.name)) acc.n++;
  }
  return acc.n;
}

function agentTools() {
  if (!existsSync(agentPath)) return { error: `agent file not found at ${agentPath}` };
  const text = readFileSync(agentPath, 'utf8').replace(/\r\n/g, '\n');
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return { error: 'agent file has no frontmatter' };
  const lines = [...fm[1].matchAll(/^tools:\s*(.*)$/gm)];
  if (!lines.length) return { error: 'agent frontmatter has no `tools:` line, so it would inherit ALL tools including Bash/Write/Edit' };
  // every tools line counts: a second line must not be able to add tools after the first one passed
  return { tools: lines.flatMap((l) => l[1].split(',')).map((s) => s.trim()).filter(Boolean) };
}

// Hero and audience files are instructions placed in the agent's prompt. They must exist, and must not name tools
// or tell the agent to run or change anything. Best-effort text scan, like the secret scan in build-report.mjs.
const UNSAFE_PATTERNS = [
  [/\b(Bash|PowerShell|NotebookEdit|WebFetch|WebSearch|Write|Edit)\b/, 'names a tool'],
  [/\b(run|execute|invoke)\s+(a |an |the |any )?(shell|command|script|program|tool)s?\b/i, 'tells the agent to run something'],
  [/\b(create|modify|delete|overwrite|rename)\s+(?:(?:a|an|the|any|this|that|old|new|existing|local|temporary)\s+){0,3}(file|files|folder|folders|director(y|ies))\b/i, 'tells the agent to change files'],
  [/\b(git\s+(commit|push|checkout|reset)|npm\s+(install|run))\b/i, 'names a modifying command'],
];
function frontmatter(text) {
  const m = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const o = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    // a quoted value keeps everything inside the quotes; an unquoted one may end with a `# comment`
    o[kv[1]] = raw.startsWith('"') ? raw.replace(/^"(.*)"\s*(#.*)?$/, '$1') : raw.replace(/\s+#.*$/, '');
  }
  return o;
}

// every hero that must exist (the core five) plus any other file in heroes/
function heroFiles() {
  const dir = join(pluginDir, 'heroes');
  const found = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [];
  return [...new Set([...CORE_HEROES, ...found])];
}

function heroProblems(name, text) {
  const fm = frontmatter(text);
  const file = `heroes/${name}.md`;
  const fix = `Fix the frontmatter of ${file}: name, command, type, audience, model, report, approval and intro are all required.`;
  if (!fm) return [{ id: 'hero-invalid', problem: `${file} has no frontmatter.`, fix }];
  const bad = [];
  if (fm.name !== name) bad.push('name (must equal the file name)');
  if (fm.command !== '/' + name) bad.push('command (must be /' + name + ')');
  if (!HERO_TYPES.includes(fm.type)) bad.push('type (one of ' + HERO_TYPES.join(', ') + ')');
  if (!AUDIENCES.includes(fm.audience)) bad.push('audience (one of ' + AUDIENCES.join(', ') + ')');
  if (!MODELS.includes(fm.model)) bad.push('model (one of ' + MODELS.join(', ') + ')');
  if (!['true', 'false'].includes(fm.report)) bad.push('report (true or false)');
  if (!['none', 'required'].includes(fm.approval)) bad.push('approval (none or required)');
  if (!fm.intro) bad.push('intro (one line)');
  return bad.length ? [{ id: 'hero-invalid', problem: `${file} has invalid frontmatter: ${bad.join('; ')}.`, fix }] : [];
}

// every hero needs a skill (or /<hero> would not exist) and every skill folder except the known non-hero ones needs a hero
function pairingProblems() {
  const found = [];
  const skillsDir = join(pluginDir, 'skills');
  if (!existsSync(skillsDir)) return found;
  const heroes = heroFiles();
  for (const name of heroes) {
    if (!existsSync(join(skillsDir, name, 'SKILL.md'))) found.push({ id: 'hero-unpaired', problem: `heroes/${name}.md has no skills/${name}/SKILL.md, so /${name} would not exist.`, fix: `Add skills/${name}/SKILL.md (copy a thin hero skill) or remove heroes/${name}.md.` });
  }
  for (const d of readdirSync(skillsDir, { withFileTypes: true })) {
    if (d.isDirectory() && !NON_HERO_SKILLS.has(d.name) && !heroes.includes(d.name)) found.push({ id: 'hero-unpaired', problem: `skills/${d.name}/ has no heroes/${d.name}.md.`, fix: `Add heroes/${d.name}.md or remove skills/${d.name}/.` });
  }
  return found;
}

function promptProblems() {
  const found = [];
  const expected = [...heroFiles().map((n) => ['heroes', n]), ...AUDIENCES.map((n) => ['audiences', n])];
  for (const [dir, name] of expected) {
    const p = join(pluginDir, dir, name + '.md');
    if (!existsSync(p)) {
      found.push({ id: 'prompt-missing', problem: 'Missing prompt file: ' + p, fix: 'Restore ' + dir + '/' + name + '.md in the plugin folder.' });
      continue;
    }
    const text = readFileSync(p, 'utf8');
    for (const [re, why] of UNSAFE_PATTERNS) {
      if (re.test(text)) found.push({ id: 'prompt-unsafe', problem: dir + '/' + name + '.md ' + why + '.', fix: 'Edit ' + dir + '/' + name + '.md so it only says what to look for and how to write the answer.' });
    }
    if (dir === 'heroes') found.push(...heroProblems(name, text));
  }
  found.push(...pairingProblems());
  return found;
}

function profilePaths() {
  if (!existsSync(profilePath)) return null;
  const text = readFileSync(profilePath, 'utf8');
  const found = new Set();
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    const t = m[1].replace(/[:#]\d.*$/, '').replace(/[),.;]+$/, '');
    if (/^(https?:|\/\/|-)/.test(t) || /[*<>{}$|]/.test(t) || !/[\\/]/.test(t)) continue;
    if (/^[A-Za-z]:\\/.test(t) || t.startsWith('/')) continue;
    found.add(t.replace(/\\/g, '/'));
  }
  return [...found];
}

if (cmd === 'preflight') {
  const failures = [], warnings = [];

  const srcCount = countSource(root);
  if (srcCount === 0) failures.push({ id: 'source', problem: 'No source files found within 4 levels of the current directory.', fix: 'Run /ask from the repository root (or the sub-project root).' });

  try {
    mkdirSync(flows, { recursive: true });
    const probe = join(flows, '.write-probe');
    writeFileSync(probe, 'x'); unlinkSync(probe);
  } catch (e) { failures.push({ id: 'docs-flows-writable', problem: `Cannot write to docs/flows/: ${e.code ?? e.message}`, fix: 'Make docs/flows/ writable, or run from a directory you can write to.' }); }

  const agentsDir = join(root, '.claude', 'agents');
  if (existsSync(agentsDir)) {
    // Claude Code identifies an agent by the name in its frontmatter, not its file name, so check both
    const nameOf = (f) => { try { return (readFileSync(join(agentsDir, f), 'utf8').replace(/\r\n/g, '\n').match(/^---\n[\s\S]*?^name:\s*(.+)$/m) ?? [])[1]?.trim() ?? ''; } catch { return ''; } };
    const shadows = readdirSync(agentsDir).filter((f) => /(explainer|avengers)/i.test(f) || /(explainer|avengers)/i.test(nameOf(f)));
    if (shadows.length) failures.push({ id: 'shadowing-agent', problem: `Project-level agent file(s) found: ${shadows.map((f) => '.claude/agents/' + f).join(', ')}. A project copy can shadow the plugin agent and may still have Bash.`, fix: 'Delete the project-level copy so only the plugin agent is used.' });
  }

  const t = agentTools();
  if (t.error) failures.push({ id: 'agent-read-only', problem: t.error, fix: 'Restore the `tools: Read, Grep, Glob` line in the plugin agent.' });
  else {
    const bad = t.tools.filter((x) => !ALLOWED_TOOLS.has(x));
    if (bad.length || !t.tools.length) failures.push({ id: 'agent-read-only', problem: `Agent has tools beyond Read/Grep/Glob: ${bad.join(', ') || '(none listed)'}`, fix: 'Edit the plugin agent so `tools:` is exactly `Read, Grep, Glob`.' });
  }

  failures.push(...promptProblems());

  const gi = existsSync(join(root, '.gitignore')) ? readFileSync(join(root, '.gitignore'), 'utf8') : '';
  if (!/^\/?docs\/?(flows\/?)?\s*$/m.test(gi)) warnings.push({ id: 'gitignore', note: 'docs/flows/ is not git-ignored; reports and the repo profile could be committed. Consider adding `docs/flows/` to .gitignore.' });
  if (!['README.md', 'README', 'readme.md', 'CLAUDE.md', 'AGENTS.md'].some((f) => existsSync(join(root, f)))) warnings.push({ id: 'readme', note: 'No README/CLAUDE.md/AGENTS.md; discovery will rely on code alone.' });
  const graphPresent = existsSync(join(root, 'graphify-out', 'graph.json'));
  if (!graphPresent) warnings.push({ id: 'graphify', note: 'No graphify-out/ graph; answers will rely on text search (slower, less structural).' });
  if (!tryRun('git', ['rev-parse', '--is-inside-work-tree'])) warnings.push({ id: 'git', note: 'Not a git repository; freshness checks are unavailable.' });

  let graphDate = null;
  if (graphPresent && existsSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'))) {
    const first = readFileSync(join(root, 'graphify-out', 'GRAPH_REPORT.md'), 'utf8').split('\n')[0];
    graphDate = (first.match(/\((\d{4}-\d{2}-\d{2})\)/) ?? [])[1] ?? null;
  }
  const lastCommit = tryRun('git', ['log', '-1', '--format=%cI']) || null;
  const graphStale = !!(graphDate && lastCommit && lastCommit.slice(0, 10) > graphDate);

  out({
    ok: failures.length === 0,
    failures, warnings,
    info: {
      sourceFilesSeen: srcCount,
      graphPresent, graphDate, lastCommit, graphStale,
      hasProfile: existsSync(profilePath),
      hasOnboardingRecord: existsSync(onboardPath),
      hasHints: ['avengers-hints.md', 'explainer-hints.md'].some((f) => existsSync(join(root, '.claude', f))),
      reportsPossible: true,
    },
  });
}

if (cmd === 'validate-profile') {
  const paths = profilePaths();
  if (paths === null) out({ ok: false, problem: 'docs/flows/_repo-profile.md does not exist.' });
  const missing = paths.filter((p) => !existsSync(join(root, p)));
  const scopeLine = (readFileSync(profilePath, 'utf8').match(/^\s*[-*]?\s*\**Scope\**\s*:\s*(.+)$/im) ?? [])[1] ?? null;
  const tooFew = paths.length < 3;
  const tooMany = paths.length > 0 && missing.length / paths.length > 0.25;
  out({
    ok: !tooFew && !tooMany && !!scopeLine,
    pathsChecked: paths.length, missing, scope: scopeLine,
    problem: !scopeLine ? 'Profile has no "Scope:" line.' : tooFew ? 'Profile names fewer than 3 real paths; it is too thin to trust.' : tooMany ? 'More than 25% of the paths in the profile no longer exist; it is stale.' : null,
  });
}

if (cmd === 'record') {
  const paths = profilePaths();
  if (paths === null) out({ ok: false, problem: 'No repo profile to record against.' });
  const scope = (readFileSync(profilePath, 'utf8').match(/^\s*[-*]?\s*\**Scope\**\s*:\s*(.+)$/im) ?? [])[1] ?? 'unspecified';
  const body = `<!-- generated ${new Date().toISOString().slice(0, 10)} by repo-avengers; delete (or run /ask onboard --force) to redo -->
# Onboarding record

- Preflight: passed (source readable, docs/flows writable, no shadowing agent, agent tools = ${agentTools().tools?.join(', ') ?? 'unknown'})
- Repo profile: docs/flows/_repo-profile.md (${paths.length} paths checked)
- Scope: ${scope}
- Hints file: ${['avengers-hints.md', 'explainer-hints.md'].map((f) => '.claude/' + f).find((f) => existsSync(join(root, f))) ?? 'none'}
`;
  mkdirSync(flows, { recursive: true });
  writeFileSync(onboardPath, body);
  out({ ok: true, wrote: 'docs/flows/_onboarding.md' });
}

out({ ok: false, problem: `unknown command "${cmd}"` });

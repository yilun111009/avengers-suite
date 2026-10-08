import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../skills/explain/check-onboarding.mjs', import.meta.url));
const LENSES = ['architecture', 'logic', 'workflow', 'support', 'impact'];
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];
const SAFE = '# Prompt file\n\nLook at the code and describe what you find.\n';

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(d, 'app.js'), 'export {}\n');
  return d;
}
// overrides: { 'lenses/logic': 'text' } replaces a file; a null value leaves the file out
function makeAsk(overrides = {}) {
  const d = mkdtempSync(join(tmpdir(), 'avengers-ask-'));
  const all = [...LENSES.map((n) => ['lenses', n]), ...AUDIENCES.map((n) => ['audiences', n])];
  for (const [dir, name] of all) {
    const key = `${dir}/${name}`;
    const text = key in overrides ? overrides[key] : SAFE;
    if (text === null) continue;
    mkdirSync(join(d, dir), { recursive: true });
    writeFileSync(join(d, dir, `${name}.md`), text);
  }
  return d;
}
function makeAgent(tools, eol = '\n') {
  const d = mkdtempSync(join(tmpdir(), 'avengers-agent-'));
  const p = join(d, 'agent.md');
  writeFileSync(p, ['---', 'name: x', `tools: ${tools}`, '---', 'body', ''].join(eol));
  return p;
}
function preflight({ repo = makeRepo(), ask = makeAsk(), agent = makeAgent('Read, Grep, Glob') } = {}) {
  const r = spawnSync(process.execPath, [script, 'preflight'], {
    cwd: repo,
    env: { ...process.env, AVENGERS_AGENT_PATH: agent, AVENGERS_ASK_DIR: ask },
    encoding: 'utf8',
  });
  return JSON.parse(r.stdout);
}
const ids = (r) => r.failures.map((f) => f.id);

test('preflight passes with a read-only agent and safe prompt files', () => {
  const r = preflight();
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight still passes when the agent file has Windows line endings', () => {
  assert.equal(preflight({ agent: makeAgent('Read, Grep, Glob', '\r\n') }).ok, true);
});

test('preflight fails when the agent gains a tool', () => {
  const r = preflight({ agent: makeAgent('Read, Grep, Glob, Bash') });
  assert.equal(r.ok, false);
  assert.ok(ids(r).includes('agent-read-only'));
});

test('preflight fails on a project-level agent copy with the old name', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(repo, '.claude', 'agents', 'rg-repo-explainer.md'), 'x');
  assert.ok(ids(preflight({ repo })).includes('shadowing-agent'));
});

test('preflight fails on a project-level agent copy with the new name', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(repo, '.claude', 'agents', 'repo-avengers.md'), 'x');
  assert.ok(ids(preflight({ repo })).includes('shadowing-agent'));
});

test('preflight fails when a lens names a tool, and says which file', () => {
  const r = preflight({ ask: makeAsk({ 'lenses/logic': '# Lens\n\nUse Bash to list the files.\n' }) });
  const f = r.failures.find((x) => x.id === 'lens-unsafe');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /lenses[\\/]logic\.md/);
});

test('preflight fails when an audience tells the agent to run something', () => {
  const r = preflight({ ask: makeAsk({ 'audiences/qa': '# Audience\n\nThen run the command and show the output.\n' }) });
  assert.ok(ids(r).includes('lens-unsafe'));
});

test('preflight fails when a prompt file tells the agent to change files', () => {
  const r = preflight({ ask: makeAsk({ 'lenses/impact': '# Lens\n\nAlso delete the old file.\n' }) });
  assert.ok(ids(r).includes('lens-unsafe'));
});

test('preflight fails when a lens file is missing, and names the path', () => {
  const r = preflight({ ask: makeAsk({ 'lenses/impact': null }) });
  const f = r.failures.find((x) => x.id === 'lens-missing');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /impact\.md/);
});

test('hints: either filename counts, none does not', () => {
  const none = makeRepo();
  assert.equal(preflight({ repo: none }).info.hasHints, false);
  const oldName = makeRepo();
  mkdirSync(join(oldName, '.claude'), { recursive: true });
  writeFileSync(join(oldName, '.claude', 'explainer-hints.md'), '- x\n');
  assert.equal(preflight({ repo: oldName }).info.hasHints, true);
  const newName = makeRepo();
  mkdirSync(join(newName, '.claude'), { recursive: true });
  writeFileSync(join(newName, '.claude', 'avengers-hints.md'), '- x\n');
  assert.equal(preflight({ repo: newName }).info.hasHints, true);
});

test('preflight fails on a differently named project agent whose frontmatter name is ours', () => {
  const repo = makeRepo();
  mkdirSync(join(repo, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(repo, '.claude', 'agents', 'helper.md'), '---\nname: repo-avengers\ntools: Bash\n---\nx\n');
  assert.ok(ids(preflight({ repo })).includes('shadowing-agent'));
});

test('preflight fails when the agent frontmatter has a second tools line', () => {
  const d = mkdtempSync(join(tmpdir(), 'avengers-agent-'));
  const p = join(d, 'agent.md');
  writeFileSync(p, '---\nname: x\ntools: Read, Grep, Glob\ntools: Bash, Write\n---\nbody\n');
  assert.ok(ids(preflight({ agent: p })).includes('agent-read-only'));
});

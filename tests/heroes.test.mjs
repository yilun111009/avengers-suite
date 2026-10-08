import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../engine/check-onboarding.mjs', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki'];
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];

test('each hero file has the three headings the agent relies on', () => {
  for (const n of HEROES) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8');
    for (const h of ['## Looks for', '## Sections', '## Diagram']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('each hero file starts with its own name and command in the frontmatter', () => {
  for (const n of HEROES) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(t.startsWith(`---\nname: ${n}\ncommand: /${n}\ntype: `), `${n}.md frontmatter is wrong`);
  }
});

test('each audience file has the two headings the agent relies on', () => {
  for (const n of AUDIENCES) {
    const t = readFileSync(join(pluginDir, 'audiences', `${n}.md`), 'utf8');
    for (const h of ['## Voice', '## Extra sections']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('the shipped hero and audience files pass the preflight scan', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const agent = join(mkdtempSync(join(tmpdir(), 'avengers-agent-')), 'agent.md');
  writeFileSync(agent, '---\nname: x\ntools: Read, Grep, Glob\n---\nbody\n');
  const env = { ...process.env, AVENGERS_AGENT_PATH: agent };
  delete env.AVENGERS_PLUGIN_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.deepEqual(r.failures.filter((f) => f.id.startsWith('prompt') || f.id.startsWith('hero')), []);
});

test('the thanos lens only lists candidates and never tells the agent to delete', () => {
  const t = readFileSync(join(pluginDir, 'heroes', 'thanos.md'), 'utf8');
  assert.match(t, /candidates for removal/i);
  assert.match(t, /never (delete|remove|change)/i);
});

test('the agent file lists every lens type slug', () => {
  const agent = readFileSync(join(pluginDir, 'agents', 'repo-avengers.md'), 'utf8');
  for (const t of ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk']) {
    assert.ok(agent.includes(t), `agent file does not list ${t}`);
  }
});

const PRESETS = {
  ironman: { model: 'opus', audience: 'dev', report: 'true', approval: 'required' },
  hawkeye: { model: 'haiku', audience: 'dev', report: 'false', approval: 'none' },
  spiderman: { model: 'sonnet', audience: 'pm', report: 'true', approval: 'none' },
};

test('the preset heroes are type auto and carry the settings from the spec', () => {
  for (const [n, want] of Object.entries(PRESETS)) {
    const t = readFileSync(join(pluginDir, 'heroes', `${n}.md`), 'utf8').replace(/\r\n/g, '\n');
    const fm = Object.fromEntries(t.split('---')[1].trim().split('\n').map((l) => [l.split(':')[0], l.slice(l.indexOf(':') + 1).trim()]));
    assert.equal(fm.type, 'auto', `${n} type`);
    assert.equal(fm.name, n, `${n} name`);
    assert.equal(fm.command, '/' + n, `${n} command`);
    for (const [k, v] of Object.entries(want)) assert.equal(fm[k], v, `${n} ${k}`);
  }
});

test('the preset heroes need no lens headings, and the whole shipped set passes preflight', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const agent = join(mkdtempSync(join(tmpdir(), 'avengers-agent-')), 'agent.md');
  writeFileSync(agent, '---\nname: x\ntools: Read, Grep, Glob\n---\nbody\n');
  const env = { ...process.env, AVENGERS_AGENT_PATH: agent };
  delete env.AVENGERS_PLUGIN_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.deepEqual(r.failures, []);
  for (const n of Object.keys(PRESETS)) {
    assert.ok(readFileSync(join(pluginDir, 'skills', n, 'SKILL.md'), 'utf8').includes(`hero: ${n}`), `${n} skill`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = fileURLToPath(new URL('../', import.meta.url));
const script = fileURLToPath(new URL('../engine/check-onboarding.mjs', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk'];
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

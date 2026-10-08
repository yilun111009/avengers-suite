import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const askDir = fileURLToPath(new URL('../skills/ask/', import.meta.url));
const script = fileURLToPath(new URL('../skills/explain/check-onboarding.mjs', import.meta.url));
const LENSES = ['architecture', 'logic', 'workflow', 'support', 'impact'];
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];

test('each lens file has the three headings the agent relies on', () => {
  for (const n of LENSES) {
    const t = readFileSync(join(askDir, 'lenses', `${n}.md`), 'utf8');
    for (const h of ['## Looks for', '## Sections', '## Diagram']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('each audience file has the two headings the agent relies on', () => {
  for (const n of AUDIENCES) {
    const t = readFileSync(join(askDir, 'audiences', `${n}.md`), 'utf8');
    for (const h of ['## Voice', '## Extra sections']) assert.ok(t.includes(h), `${n}.md is missing ${h}`);
  }
});

test('the shipped files pass the preflight scan', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const agent = join(mkdtempSync(join(tmpdir(), 'avengers-agent-')), 'agent.md');
  writeFileSync(agent, '---\nname: x\ntools: Read, Grep, Glob\n---\nbody\n');
  const env = { ...process.env, AVENGERS_AGENT_PATH: agent };
  delete env.AVENGERS_ASK_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.deepEqual(r.failures.filter((f) => f.id.startsWith('lens')), []);
});

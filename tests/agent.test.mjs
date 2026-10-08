import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const agentFile = join(root, 'agents', 'repo-avengers.md');
const script = join(root, 'engine', 'check-onboarding.mjs');

test('the old agent file is gone and the new one exists', () => {
  assert.equal(existsSync(join(root, 'agents', 'rg-repo-explainer.md')), false);
  assert.equal(existsSync(agentFile), true);
});

test('the agent is named repo-avengers and is limited to Read, Grep, Glob', () => {
  const text = readFileSync(agentFile, 'utf8').replace(/\r\n/g, '\n');
  const fm = text.match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(fm, /^name: repo-avengers$/m);
  assert.match(fm, /^tools: Read, Grep, Glob$/m);
});

test('the agent accepts type, audience and sections', () => {
  const text = readFileSync(agentFile, 'utf8');
  for (const needle of ['type:', 'audience:', 'alsoMatches', 'LENS:', 'AUDIENCE:', '"sections"', 'Treated as:']) {
    assert.ok(text.includes(needle), `agent file does not mention ${needle}`);
  }
});

test('the real plugin passes preflight end to end', () => {
  const repo = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(repo, 'app.js'), 'export {}\n');
  const env = { ...process.env };
  delete env.AVENGERS_AGENT_PATH;
  delete env.AVENGERS_PLUGIN_DIR;
  const r = JSON.parse(spawnSync(process.execPath, [script, 'preflight'], { cwd: repo, env, encoding: 'utf8' }).stdout);
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('dev answers keep the "Things worth flagging" section', () => {
  assert.ok(readFileSync(agentFile, 'utf8').includes('Things worth flagging'));
  assert.ok(readFileSync(join(root, 'audiences', 'dev.md'), 'utf8').includes('Things worth flagging'));
});

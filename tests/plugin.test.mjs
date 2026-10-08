import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

test('plugin.json is repo-avengers 1.3.0', () => {
  const p = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(p.name, 'repo-avengers');
  assert.equal(p.version, '1.3.0');
});

test('marketplace keeps the id rg-local and lists repo-avengers', () => {
  const m = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(m.name, 'rg-local');
  assert.deepEqual(m.plugins.map((x) => x.name), ['repo-avengers']);
});

test('no shipped file still uses the old plugin name', () => {
  for (const f of [
    'agents/repo-avengers.md', 'skills/ask/SKILL.md', 'skills/explain/SKILL.md',
    'engine/check-onboarding.mjs', 'engine/build-report.mjs', 'engine/build-index.mjs',
    'engine/migrate-reports.mjs', 'engine/detect-route.mjs', '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json',
  ]) {
    assert.ok(!read(f).includes('rg-repo-explainer'), `${f} still mentions rg-repo-explainer`);
  }
});

test('the README names the new plugin and keeps the upgrade note', () => {
  const r = read('README.md');
  assert.match(r, /^# repo-avengers/);
  assert.ok(r.includes('repo-avengers@rg-local'));
  assert.ok(r.includes('/plugin uninstall rg-repo-explainer@rg-local'));
});

test('the changelog has a 1.3.0 entry on top and keeps 1.2.0, 1.1.0 and 1.0.0', () => {
  const c = read('CHANGELOG.md').replace(/\r\n/g, '\n');
  assert.match(c, /^# Changelog\n\n## 1\.3\.0 /);
  for (const v of ['1.2.0', '1.1.0', '1.0.0']) assert.ok(c.includes(`\n## ${v} `), `changelog lost ${v}`);
});

test('the README documents the hero commands and the new layout', () => {
  const r = read('README.md');
  for (const needle of ['/thor', '/captainamerica', '/drstrange', '/blackwidow', '/hulk', '/thanos', '/antman', '/loki', '/ironman', '/hawkeye', '/spiderman', 'heroes/', 'engine/']) {
    assert.ok(r.includes(needle), `README does not mention ${needle}`);
  }
});

test('the scripts live in engine/, not skills/explain/', () => {
  for (const f of ['check-onboarding', 'detect-route', 'build-report', 'build-index', 'migrate-reports']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../engine/${f}.mjs`, import.meta.url))), `engine/${f}.mjs is missing`);
    assert.ok(!existsSync(fileURLToPath(new URL(`../skills/explain/${f}.mjs`, import.meta.url))), `skills/explain/${f}.mjs should have moved`);
  }
});

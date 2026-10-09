import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

test('plugin.json is repo-avengers 1.5.2', () => {
  const p = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(p.name, 'repo-avengers');
  assert.equal(p.version, '1.5.2');
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

test('the changelog has a 1.5.2 entry on top and keeps every earlier version', () => {
  const c = read('CHANGELOG.md').replace(/\r\n/g, '\n');
  assert.match(c, /^# Changelog\n\n## 1\.5\.2 /);
  for (const v of ['1.5.1', '1.5.0', '1.4.0', '1.3.0', '1.2.0', '1.1.0', '1.0.0']) assert.ok(c.includes(`\n## ${v} `), `changelog lost ${v}`);
});

test('the README documents report themes, the themes folder and the limits', () => {
  const r = read('README.md');
  for (const needle of ['themes/', 'accent', 'emblem', 'tagline', 'contrast', 'byte-for-byte', 'rebuilt']) {
    assert.ok(r.includes(needle), `README does not mention ${needle}`);
  }
});

test('the README documents /assemble, the approval and the cap', () => {
  const r = read('README.md');
  for (const needle of ['/assemble', 'at most 5', 'Approve, all on sonnet', 'plan-team', 'build-assemble']) {
    assert.ok(r.includes(needle), `README does not mention ${needle}`);
  }
});

test('the spec records that /assemble shipped', () => {
  const spec = read('docs/superpowers/specs/2026-10-08-heroes-and-assemble-design.md');
  assert.match(spec, /`\/assemble` shipped in 1\.4\.0/);
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

test('the README gives a ready-to-copy example for every hero command and for /assemble', () => {
  const r = read('README.md').replace(/\r\n/g, '\n');
  const section = r.split('### Try each command')[1]?.split('\n### ')[0] ?? '';
  assert.ok(section, 'README has no "Try each command" section');
  for (const hero of ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman', 'assemble']) {
    assert.match(section, new RegExp('^/' + hero + ' [^ ]', 'm'), 'no example line for /' + hero);
  }
});

test('every hero example in the README is a command that exists, with a question after it', () => {
  const r = read('README.md').replace(/\r\n/g, '\n');
  const section = r.split('### Try each command')[1]?.split('\n### ')[0] ?? '';
  const known = new Set(['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman', 'assemble', 'ask']);
  const lines = section.split('\n').filter((l) => /^\/[a-z]+ /.test(l));
  assert.ok(lines.length >= 12, 'expected at least 12 example lines, got ' + lines.length);
  for (const l of lines) {
    const cmd = l.slice(1).split(' ')[0];
    assert.ok(known.has(cmd), 'unknown command in example: ' + l);
    assert.ok(l.replace(/#.*$/, '').trim().split(' ').length >= 3, 'example has no real question: ' + l);
  }
});

test('the README explains how to name an audience, with the working phrasings', () => {
  const r = read('README.md').replace(/\r\n/g, '\n');
  const section = r.split('### Try each command')[1]?.split('\n### ')[0] ?? '';
  assert.match(section, /\/hulk for qa /);
  assert.match(section, /explain to the PM/);
  assert.match(section, /for support /);
});

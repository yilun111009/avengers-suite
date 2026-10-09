import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

test('plugin.json is mission-control 0.2.0', () => {
  const p = JSON.parse(read('.claude-plugin/plugin.json'));
  assert.equal(p.name, 'mission-control');
  assert.equal(p.version, '0.2.0');
});

test('the marketplace is mc-local and lists only mission-control from ./', () => {
  const m = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(m.name, 'mc-local');
  assert.deepEqual(m.plugins.map((x) => x.name), ['mission-control']);
  assert.equal(m.plugins[0].source, './');
});

test('the manifests do not borrow the Avengers name', () => {
  for (const f of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
    assert.ok(!/avengers/i.test(read(f)), `${f} mentions avengers`);
  }
});

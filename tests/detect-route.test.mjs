import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detect } from '../engine/detect-route.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./routing-fixtures.json', import.meta.url), 'utf8'));
const script = fileURLToPath(new URL('../engine/detect-route.mjs', import.meta.url));

for (const f of fixtures) {
  test(`route: ${JSON.stringify(f.q)}`, () => {
    const r = detect(f.q);
    assert.equal(r.type, f.type);
    assert.equal(r.audience, f.audience);
    if (f.also) assert.equal(r.alsoMatches, f.also);
    if (f.unclear) assert.equal(r.unclear, true);
  });
}

test('route: non-string input does not crash', () => {
  assert.equal(detect(undefined).type, 'workflow');
  assert.equal(detect(null).unclear, true);
});

test('route: CLI prints one line of JSON', () => {
  const r = spawnSync(process.execPath, [script, 'for qa what are the refund rules'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { type: 'logic', alsoMatches: null, unclear: false, audience: 'qa' });
});

test('route: CLI reads the question from stdin, so shell characters in it are inert', () => {
  const q = 'who calls `OrderService.refund` and $(whoami) and "quotes"';
  const r = spawnSync(process.execPath, [script], { input: q, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).type, 'impact');
});

test('route: a leading hero marker is ignored, so a named audience is still found', () => {
  assert.equal(detect('hero: hulk for qa what breaks if I change the Order enum').audience, 'qa');
  assert.equal(detect('hero: hulk for qa what breaks if I change the Order enum').type, 'impact');
  assert.equal(detect('hero: hulk what breaks if I change the Order enum').audience, null);
});

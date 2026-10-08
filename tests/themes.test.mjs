import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, isHex, contrast, bandTextColor, hue, saturation, EMBLEMS, themeProblems, readTheme, themeFor, escapeHtml } from '../engine/themes.mjs';

const GOOD = (extra = {}) => {
  const f = { name: 'demo', accent: '#2e7d32', accentDark: '#7bd88f', emblem: 'fist', tagline: 'Hulk smash.', ...extra };
  return ['---', ...Object.entries(f).map(([k, v]) => `${k}: ${v === undefined ? '' : (typeof v === 'string' && k === 'tagline' ? JSON.stringify(v) : v)}`), '---', ''].join('\n');
};
function plugin(files) {
  const d = mkdtempSync(join(tmpdir(), 'avengers-themes-'));
  mkdirSync(join(d, 'themes'), { recursive: true });
  for (const [n, t] of Object.entries(files)) writeFileSync(join(d, 'themes', `${n}.md`), t);
  return d;
}

test('isHex accepts #rrggbb only', () => {
  for (const ok of ['#000000', '#FFFFFF', '#2e7d32']) assert.equal(isHex(ok), true, ok);
  for (const bad of ['red', '#fff', 'rgb(0,0,0)', '#12345g', '#123456; } body{display:none', '', undefined, 5, '#1234567', ' #123456']) assert.equal(isHex(bad), false, String(bad));
});

test('contrast reproduces known WCAG values', () => {
  assert.equal(contrast('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrast('#ffffff', '#ffffff').toFixed(1), '1.0');
  assert.equal(contrast('#0b7a3b', '#ffffff').toFixed(2), '5.44');
  assert.equal(contrast('#f9a825', '#ffffff').toFixed(2), '1.97');
  assert.equal(contrast('#ffffff', '#0b7a3b'), contrast('#0b7a3b', '#ffffff'));
});

test('the band text colour is whichever of white or near-black scores higher', () => {
  assert.equal(bandTextColor('#2e7d32'), '#ffffff');
  assert.equal(bandTextColor('#f9a825'), '#111111');
  assert.equal(bandTextColor('#ffd54f'), '#111111');
});

test('hue and saturation: a grey has none', () => {
  assert.equal(hue('#ff0000'), 0);
  assert.equal(hue('#00ff00'), 120);
  assert.equal(saturation('#4a4a4a'), 0);
  assert.ok(saturation('#b71c1c') > 0.5);
});

test('there are exactly twelve emblems and each is a small inline svg that uses currentColor and no script', () => {
  const names = Object.keys(EMBLEMS);
  assert.deepEqual(names.sort(), ['ant', 'bow', 'eye', 'fist', 'gauntlet', 'hammer', 'portal', 'scepter', 'shield', 'suit', 'web', 'widow']);
  for (const n of names) {
    const svg = EMBLEMS[n];
    assert.match(svg, /^<svg [^>]*aria-hidden="true"/, n);
    assert.match(svg, /currentColor/, n);
    assert.doesNotMatch(svg, /<script|onload|onerror|href=|<style/i, n);
    assert.ok(svg.length < 1200, `${n} is ${svg.length} bytes`);
  }
});

test('parseFrontmatter: CRLF, BOM, quoted values with a hash, trailing comments', () => {
  const t = '﻿---\r\nname: demo\r\naccent: "#2e7d32"   # light\r\ntagline: "Smash # it"\r\nemblem: fist  # shape\r\n---\r\nbody';
  const f = parseFrontmatter(t);
  assert.equal(f.name, 'demo');
  assert.equal(f.accent, '#2e7d32');
  assert.equal(f.tagline, 'Smash # it');
  assert.equal(f.emblem, 'fist');
  assert.equal(parseFrontmatter('no frontmatter'), null);
});

test('themeProblems: a valid theme has none, and each bad field is named', () => {
  assert.deepEqual(themeProblems('demo', GOOD()), []);
  assert.match(themeProblems('demo', GOOD({ accent: 'green' })).join(' '), /accent/);
  assert.match(themeProblems('demo', GOOD({ accentDark: '#fff' })).join(' '), /accentDark/);
  assert.match(themeProblems('demo', GOOD({ emblem: 'banana' })).join(' '), /emblem/);
  assert.match(themeProblems('demo', GOOD({ tagline: '' })).join(' '), /tagline/);
  assert.match(themeProblems('demo', GOOD({ tagline: 'x'.repeat(101) })).join(' '), /tagline/);
  assert.match(themeProblems('other', GOOD()).join(' '), /name/);
  assert.match(themeProblems('demo', 'plain text').join(' '), /frontmatter/);
});

test('themeProblems: low contrast is named with the ratio', () => {
  const p = themeProblems('demo', GOOD({ accent: '#f9a825' })).join(' ');
  assert.match(p, /accent/);
  assert.match(p, /1\.9\d/);
  assert.match(themeProblems('demo', GOOD({ accentDark: '#222222' })).join(' '), /accentDark/);
});

test('readTheme and themeFor return null for a bad name, a missing file and an invalid theme, without reading outside themes/', () => {
  const dir = plugin({ demo: GOOD(), broken: GOOD({ accent: 'nope' }) });
  assert.ok(readTheme('demo', dir));
  for (const bad of ['../demo', 'a/b', 'a\\b', 'DEMO', '', ' ', 'demo.md', 'missing', 'broken', undefined, null, 5, ['demo'], {}]) {
    assert.equal(readTheme(bad, dir), null, String(bad));
    assert.equal(themeFor(bad, dir), null, String(bad));
  }
});

test('themeFor css overrides --accent in the three places the page declares it, with only validated colours', () => {
  const t = themeFor('demo', plugin({ demo: GOOD() }));
  assert.match(t.css, /^<style>/);
  assert.match(t.css, /:root\{--accent:#2e7d32\}/);
  assert.match(t.css, /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme=light\]\)\{--accent:#7bd88f\}\}/);
  assert.match(t.css, /:root\[data-theme=dark\]\{--accent:#7bd88f\}/);
  const colours = t.css.match(/#[0-9a-fA-F]+/g);
  assert.ok(colours.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)), colours.join(' '));
});

test('themeFor band: a real h1 inside, the emblem, the tagline escaped, and a readable title colour', () => {
  const dir = plugin({ demo: GOOD({ tagline: '<script>alert(1)</script> & co' }) });
  const t = themeFor('demo', dir);
  assert.match(t.bandHtml, /class="band"/);
  assert.match(t.bandHtml, /<h1>\{\{TITLE\}\}<\/h1>/);
  assert.match(t.bandHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; co/);
  assert.doesNotMatch(t.bandHtml, /<script>/);
  assert.match(t.css, /\.band\{[^}]*color:#ffffff/);
});

test('escapeHtml escapes the five characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('a name that points at a real valid theme file outside themes/ is still refused, even if that file claims the traversal name', () => {
  const d = mkdtempSync(join(tmpdir(), 'avengers-traversal-'));
  mkdirSync(join(d, 'themes'), { recursive: true });
  writeFileSync(join(d, 'themes', 'inside.md'), GOOD({ name: 'inside' }));
  assert.ok(readTheme('inside', d), 'control: a theme inside themes/ loads');
  // the file's own name field matches the requested name, so only the name pattern stands between the name and the read
  const sneaky = ['../outside', './../outside', 'inside/../../outside', '..\outside'];
  for (const name of sneaky) {
    // plant a valid file at the path the name would resolve to: <plugin>/outside.md
    writeFileSync(join(d, 'outside.md'), GOOD({ name }));
    assert.equal(readTheme(name, d), null, JSON.stringify(name));
    assert.equal(themeFor(name, d), null, JSON.stringify(name));
  }
  for (const name of ['inside\0', '%2e%2e/outside']) {
    assert.equal(readTheme(name, d), null, JSON.stringify(name));
  }
});

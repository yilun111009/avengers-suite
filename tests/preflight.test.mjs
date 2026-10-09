import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../engine/check-onboarding.mjs', import.meta.url));
const HEROES = ['thor', 'captainamerica', 'drstrange', 'blackwidow', 'hulk', 'thanos', 'antman', 'loki', 'ironman', 'hawkeye', 'spiderman'];
const TYPE_OF = { thor: 'architecture', captainamerica: 'logic', drstrange: 'workflow', blackwidow: 'support', hulk: 'impact', thanos: 'deadcode', antman: 'deepdive', loki: 'risk', ironman: 'auto', hawkeye: 'auto', spiderman: 'auto' };
const AUDIENCES = ['dev', 'qa', 'pm', 'support'];
const SAFE = '# Prompt file\n\nLook at the code and describe what you find.\n';

function makeRepo() {
  const d = mkdtempSync(join(tmpdir(), 'avengers-repo-'));
  writeFileSync(join(d, 'app.js'), 'export {}\n');
  return d;
}
function heroText(name, body = SAFE) {
  return ['---', `name: ${name}`, `command: /${name}`, `type: ${TYPE_OF[name]}`, 'audience: dev', 'model: sonnet', 'report: true', 'approval: none', 'intro: "Ready."', '---', body].join('\n');
}
const THEME_COLOURS = { thor: ['#0d6ea8', '#7cc4f2'], captainamerica: ['#1c3f94', '#9db7ff'], drstrange: ['#a85a00', '#ffb454'], blackwidow: ['#a3004f', '#ff7fb0'], hulk: ['#2e7d32', '#7bd88f'], thanos: ['#6a1b9a', '#d49cff'], antman: ['#6d6a00', '#d8d36a'], loki: ['#00796b', '#5fdccb'], ironman: ['#b71c1c', '#ff8a80'], hawkeye: ['#4a3fa0', '#b9b0ff'], spiderman: ['#c13a14', '#ff9a73'], fury: ['#4a4a4a', '#c4c4c4'] };
function themeText(name, over = {}) {
  const [a, d] = THEME_COLOURS[name] ?? ['#2e7d32', '#7bd88f'];
  const f = { name, accent: a, accentDark: d, emblem: 'fist', tagline: 'A short line.', ...over };
  return ['---', `name: ${f.name}`, `accent: ${JSON.stringify(f.accent)}`, `accentDark: ${JSON.stringify(f.accentDark)}`, `emblem: ${f.emblem}`, `tagline: ${JSON.stringify(f.tagline)}`, '---', ''].join('\n');
}
// overrides: { 'heroes/hulk': 'text' } replaces a file; a null value leaves it out;
// { 'skills/stray': 'text' } adds a skill folder that has no hero.
function makePlugin(overrides = {}) {
  const d = mkdtempSync(join(tmpdir(), 'avengers-plugin-'));
  const put = (rel, text) => { mkdirSync(join(d, dirname(rel)), { recursive: true }); writeFileSync(join(d, rel), text); };
  for (const n of HEROES) {
    const hk = `heroes/${n}`;
    const ht = hk in overrides ? overrides[hk] : heroText(n);
    if (ht !== null) put(`${hk}.md`, ht);
    const sk = `skills/${n}`;
    const st = sk in overrides ? overrides[sk] : '# thin skill\n';
    if (st !== null) put(`${sk}/SKILL.md`, st);
  }
  for (const n of AUDIENCES) {
    const ak = `audiences/${n}`;
    const at = ak in overrides ? overrides[ak] : SAFE;
    if (at !== null) put(`${ak}.md`, at);
  }
  for (const n of [...HEROES, 'fury']) {
    const tk = `themes/${n}`;
    const tt = tk in overrides ? overrides[tk] : themeText(n);
    if (tt !== null) put(`${tk}.md`, tt);
  }
  for (const k of Object.keys(overrides)) {
    if (k.startsWith('themes/') && ![...HEROES, 'fury'].some((h) => k === `themes/${h}`)) put(`${k}.md`, overrides[k]);
  }
  for (const k of Object.keys(overrides)) {
    if (k.startsWith('skills/') && !HEROES.some((h) => k === `skills/${h}`)) put(`${k}/SKILL.md`, overrides[k]);
  }
  return d;
}
function makeAgent(tools, eol = '\n') {
  const d = mkdtempSync(join(tmpdir(), 'avengers-agent-'));
  const p = join(d, 'agent.md');
  writeFileSync(p, ['---', 'name: x', `tools: ${tools}`, '---', 'body', ''].join(eol));
  return p;
}
function preflight({ repo = makeRepo(), plugin = makePlugin(), agent = makeAgent('Read, Grep, Glob') } = {}) {
  const r = spawnSync(process.execPath, [script, 'preflight'], {
    cwd: repo,
    env: { ...process.env, AVENGERS_AGENT_PATH: agent, AVENGERS_PLUGIN_DIR: plugin },
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

test('preflight fails when a hero names a tool, and says which file', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/captainamerica': heroText('captainamerica', '# Lens\n\nUse Bash to list the files.\n') }) });
  const f = r.failures.find((x) => x.id === 'prompt-unsafe');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /heroes[\\/]captainamerica\.md/);
});

test('preflight fails when an audience tells the agent to run something', () => {
  const r = preflight({ plugin: makePlugin({ 'audiences/qa': '# Audience\n\nThen run the command and show the output.\n' }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});

test('preflight fails when a prompt file tells the agent to change files', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk', '# Lens\n\nAlso delete the old file.\n') }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});

test('preflight fails when a core hero file is missing, and names the path', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'prompt-missing');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
});

test('preflight accepts a hero file with Windows line endings', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace(/\n/g, '\r\n') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight accepts a hero intro that contains a colon and a comma', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('intro: "Ready."', 'intro: "Hulk smash: checking, now."') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight fails on a hero with an unknown model, and names the file', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('model: sonnet', 'model: gpt') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
  assert.match(f.problem, /model/);
});

test('preflight fails on a hero with an unknown type', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: nonsense') }) });
  assert.ok(ids(r).includes('hero-invalid'));
});

test('preflight fails when the hero frontmatter name does not match the file name', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('name: hulk', 'name: thanos') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /name/);
});

test('preflight fails when a hero file has no frontmatter', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': '# Lens: impact\n\nNo frontmatter here.\n' }) });
  assert.ok(ids(r).includes('hero-invalid'));
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

test('preflight fails when a hero has no skill, and names it', () => {
  const r = preflight({ plugin: makePlugin({ 'skills/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'hero-unpaired');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /skills\/hulk\/SKILL\.md/);
});

test('preflight fails on a stray skill folder that has no hero file, and names the folder', () => {
  const r = preflight({ plugin: makePlugin({ 'skills/stray': '# half made\n' }) });
  const f = r.failures.find((x) => x.id === 'hero-unpaired');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /skills\/stray/);
});

test('preflight ignores the ask, assemble, explain and plainreport skill folders', () => {
  const plugin = makePlugin({ 'skills/ask': '# ask\n', 'skills/assemble': '# assemble\n', 'skills/explain': '# explain\n', 'skills/plainreport': '# plainreport\n' });
  assert.equal(preflight({ plugin }).ok, true);
});

test('preflight accepts a hero file that starts with a byte-order mark', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': '\uFEFF' + heroText('hulk') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight accepts a trailing comment after an unquoted hero value', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('model: sonnet', 'model: sonnet   # sonnet | opus | haiku') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('the wrong-name failure names the file as well as the field', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('name: hulk', 'name: thanos') }) });
  assert.match(r.failures.find((x) => x.id === 'hero-invalid').problem, /heroes\/hulk\.md/);
});

test('preflight accepts a hero whose type is auto', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: auto') }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
});

test('preflight accepts the three new lens types in a hero file', () => {
  for (const t of ['deadcode', 'deepdive', 'risk']) {
    const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', `type: ${t}`) }) });
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(r.failures)}`);
  }
});

test('preflight still rejects a made-up hero type, and lists auto among the choices', () => {
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': heroText('hulk').replace('type: impact', 'type: banana') }) });
  const f = r.failures.find((x) => x.id === 'hero-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /auto/);
});

test('an auto hero is still scanned for unsafe wording', () => {
  const text = heroText('hulk', '# Preset\n\nThen delete the old file.\n').replace('type: impact', 'type: auto');
  const r = preflight({ plugin: makePlugin({ 'heroes/hulk': text }) });
  assert.ok(ids(r).includes('prompt-unsafe'));
});

test('preflight fails when a hero has no theme, and names the theme file', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/hulk': null }) });
  const f = r.failures.find((x) => x.id === 'theme-missing');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /themes[\\/]hulk\.md/);
});

test('preflight fails when fury has no theme', () => {
  assert.ok(ids(preflight({ plugin: makePlugin({ 'themes/fury': null }) })).includes('theme-missing'));
});

test('preflight fails on a theme with low contrast and says the ratio and the file', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/hulk': themeText('hulk', { accent: '#f9a825' }) }) });
  const f = r.failures.find((x) => x.id === 'theme-invalid');
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /hulk\.md/);
  assert.match(f.problem, /1\.9\d/);
});

test('preflight fails on a bad emblem, a non-hex colour and an over-long tagline', () => {
  for (const bad of [{ emblem: 'banana' }, { accent: 'green' }, { tagline: 'x'.repeat(101) }]) {
    assert.ok(ids(preflight({ plugin: makePlugin({ 'themes/hulk': themeText('hulk', bad) }) })).includes('theme-invalid'), JSON.stringify(bad));
  }
});

test('preflight fails on a theme that has no hero, except fury', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/stranger': themeText('stranger') }) });
  assert.ok(ids(r).includes('theme-orphan'), JSON.stringify(r.failures));
});

test('preflight only warns when two coloured themes are within 12 degrees of hue', () => {
  const r = preflight({ plugin: makePlugin({ 'themes/thor': themeText('thor', { accent: '#b71c1c', accentDark: '#ff8a80' }), 'themes/ironman': themeText('ironman', { accent: '#b71c1c', accentDark: '#ff8a80' }) }) });
  assert.equal(r.ok, true, JSON.stringify(r.failures));
  assert.ok(r.warnings.some((w) => w.id === 'theme-similar'), JSON.stringify(r.warnings));
});

test('preflight reports a directory named like a theme instead of crashing', () => {
  const plugin = makePlugin({});
  mkdirSync(join(plugin, 'themes', 'weird.md'), { recursive: true });
  const r = preflight({ plugin });
  const f = r.failures.find((x) => x.id === 'theme-invalid' && /weird/.test(x.problem));
  assert.ok(f, JSON.stringify(r.failures));
  assert.match(f.problem, /not a readable file/);
});

test('the similar-hue warning fires at 12 degrees and not at 13, and a grey theme is exempt', () => {
  // hue 0 vs hue 12 -> warns; hue 0 vs hue 13 -> does not; a grey next to a red -> does not
  const warn = (a, b) => preflight({ plugin: makePlugin({ 'themes/thor': themeText('thor', { accent: a, accentDark: '#ff8a80' }), 'themes/ironman': themeText('ironman', { accent: b, accentDark: '#ff8a80' }) }) }).warnings.some((w) => w.id === 'theme-similar' && /thor/.test(w.note) && /ironman/.test(w.note));
  assert.equal(warn('#b71c1c', '#b73c1c'), true, 'hue 0 vs hue 12 is exactly on the threshold');
  assert.equal(warn('#b71c1c', '#b73e1c'), false, 'hue 0 vs hue 13 is one past it');
  assert.equal(warn('#b71c1c', '#4a4a4a'), false, 'a grey theme is exempt');
});

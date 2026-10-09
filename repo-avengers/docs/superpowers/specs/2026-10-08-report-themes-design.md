# repo-avengers 1.5.0: report themes, design

Date: 2026-10-08. Status: draft for review. Builds on `2026-10-08-heroes-and-assemble-design.md` (1.0 to 1.4).

## 1. Goal and scope

Give every report a personality: each hero's report, and the `/assemble` team page, carries a look that belongs to that hero. A look is an accent colour, a small emblem, a coloured header band and one in-character tagline.

Success means:
1. A report made by a hero looks like that hero's: its accent colour in both light and dark mode, its emblem, a header band and a tagline under the title.
2. The `/assemble` team page has its own look (Fury's), and each hero card shows that hero's emblem and accent.
3. Nothing gets harder to read: every accent meets WCAG contrast 4.5:1 as text in both modes, and the title on the band meets 4.5:1.
4. Findings, sections, wording, the diagram, the layout and the read-only rules are unchanged. The personality is flavour only, like the hero `intro` lines.
5. A report with no `hero`, an unknown hero or a broken theme renders exactly as it does today, and every saved report keeps working.
6. Reports stay self-contained HTML with no outside requests.

### Out of scope (future)
- A theme chosen by the user, a theme picker in the page, themed diagram node shapes, section icons and background patterns.
- Marvel artwork. Emblems are simple original shapes. The trademark note in the README still applies.
- Changing how the agent writes its JSON beyond one new field the skill adds (`hero`).

## 2. Decisions made with the user

| Decision | Choice |
|---|---|
| What "personality" means | Look plus one short in-character tagline. Wording of findings and sections is unchanged. |
| Where a look is defined | A `themes/` folder, one file per theme. Not in the hero file, and not chosen by the agent. |
| How far the look goes | Accent colour (light and dark), a fixed-set SVG emblem, a header band. Diagram, tables and layout stay identical. |
| Team page | Fury's own look, and each hero card carries that hero's emblem and accent. |
| Approach | The report builders read the theme at build time (approach A). The theme is not copied into each saved report. |

## 3. Structure

```
themes/                one file per theme (12): the 11 heroes and fury
  hulk.md ... fury.md
engine/themes.mjs      hex parsing, contrast maths, the emblem set, themeFor()
engine/build-report.mjs, build-assemble.mjs   apply a theme
```

### 3.1 Theme file format

```markdown
---
name: hulk
accent: "#2e7d32"        # accent in light mode, #rrggbb
accentDark: "#7bd88f"    # accent in dark mode, #rrggbb
emblem: fist             # one name from the fixed emblem set
tagline: "Hulk smash. Here is what breaks."   # one line, at most 100 characters
---
```

- Four fields, all required. `name` must equal the file name and match `^[a-z0-9-]+$`.
- There is no body. A theme file holds no instructions and is never sent to the agent.
- `themes/fury.md` is the team page's theme. It is the only theme without a hero file.

### 3.2 The emblem set

A fixed list of small inline SVG shapes written in `engine/themes.mjs`: `fist`, `hammer`, `shield`, `portal`, `suit`, `bow`, `web`, `widow`, `gauntlet`, `ant`, `scepter`, `eye`. A theme file picks a name; it never supplies SVG. Each emblem is `aria-hidden`, uses `currentColor`, and has no animation.

### 3.3 The 12 themes (tested values)

These values were checked against both rules below: every pair passes the contrast rule (lowest ratio 4.78) and no two coloured themes sit within 12 degrees of hue of each other. Fury is deliberately a neutral grey, so his hue does not compete with Iron Man's red.

| Theme | Emblem | Light accent | Dark accent |
|---|---|---|---|
| thor | hammer | `#0d6ea8` | `#7cc4f2` |
| captainamerica | shield | `#1c3f94` | `#9db7ff` |
| drstrange | portal | `#a85a00` | `#ffb454` |
| blackwidow | widow | `#a3004f` | `#ff7fb0` |
| hulk | fist | `#2e7d32` | `#7bd88f` |
| thanos | gauntlet | `#6a1b9a` | `#d49cff` |
| antman | ant | `#6d6a00` | `#d8d36a` |
| loki | scepter | `#00796b` | `#5fdccb` |
| ironman | suit | `#b71c1c` | `#ff8a80` |
| hawkeye | bow | `#4a3fa0` | `#b9b0ff` |
| spiderman | web | `#c13a14` | `#ff9a73` |
| fury | eye | `#4a4a4a` | `#c4c4c4` |

An earlier draft used a more obvious palette (red for Iron Man, Spider-Man, Ant-Man and Black Widow; blue for Thor and Captain America). It passed contrast but put seven pairs within 12 degrees of hue, and Iron Man and Spider-Man at exactly the same hue, so the themes would have looked alike. Colour alone cannot separate 12 heroes, so the emblem carries identity too, and the colours above are spread out as far as the characters allow. Taglines are written when the themes are created, one per theme, in the same register as the existing `intro` lines.
## 4. How a theme is applied

`themeFor(name, pluginDir)` returns `{ css, bandHtml }` or `null`.
- `css` re-declares `--accent` in the three places the pages declare it: the light default, the dark media query guarded by `:root:not([data-theme=light])`, and `:root[data-theme=dark]`. This is what makes the manual theme toggle show the right colour.
- `bandHtml` is the header band: a strip in the accent colour with the emblem, the `<h1>` title and the tagline under it. The `<h1>` stays, so the page structure and the title text do not change. The band's text colour is chosen by the script (white or near-black, whichever has the higher contrast with the accent).
- `null` means no theme. The page renders as today. This is the result for a missing `hero`, an unknown name, a missing theme file, an invalid theme file, and a name that does not match `^[a-z0-9-]+$`.

`build-report.mjs` reads `d.hero` and applies the theme. `build-assemble.mjs` applies `fury` to the page and, for each hero card, that hero's emblem and a coloured left edge in its accent. A saved report keeps its old look until it is rebuilt; rebuilding the same JSON picks up the current theme.

The report JSON gains one optional field, `hero` (for example `"hero": "hulk"`). The `ask` and hero skills write it when they stamp `generated` and `commit`; the `assemble` skill writes it into each hero's report and writes `"hero": "fury"` into the combined JSON. `/ask deep` and plain `/ask` have no hero, except that `deep` uses `ironman`, as it already shares Ironman's approval.

## 5. Safety

- **Colours:** only `#rrggbb` is accepted (six hex digits). Names, three-digit hex, `rgb()`, `url()`, `;` and `}` are rejected. A value is written into CSS only after it passes the check.
- **Emblems:** a name from the fixed list. An unknown name fails preflight. No SVG or text from a file reaches the page.
- **Tagline:** plain text, one line, at most 100 characters, HTML-escaped when rendered, and covered by the existing unsafe-wording scan.
- **Files:** `themeFor` reads only `themes/<name>.md` with `name` matching `^[a-z0-9-]+$`; `../x` and `a/b` return `null` without reading.
- The theme never enters the agent's prompt. The agent cannot choose or change a theme. The secret scan still runs before any report is written.

## 6. Contrast

Preflight computes, from the hex values, and fails with the file name, the ratio and the fix when either check fails:
1. **Accent as text:** `accent` against `#ffffff` and `#f6f8fa`, and `accentDark` against `#0d1117` and `#161b22`, each at least **4.5:1**. (Reference values: the current green is 5.44 and 5.11 on light; gold `#f9a825` is 1.97, so a gold light accent must be darkened.)
2. **Text on the band:** the title colour is white or near-black, whichever scores higher against the accent, and must reach at least **4.5:1**. The theme does not choose it.

If an installed theme fails at build time, the report falls back to no theme. The band has no motion, and colour is never the only signal because the hero name and tagline are text.

Honest limit: the rule guarantees a readable accent, not a good-looking one. Only a person can judge taste.

## 7. Preflight changes

- Every file in `themes/` is validated: required fields, `name` equals the file name, hex format, emblem in the set, tagline at most 100 characters and one line, contrast.
- Every hero file must have a theme of the same name. A theme without a hero is allowed only for `fury`.
- The tagline goes through the same unsafe-wording scan as the hero text.
- Distinctness: preflight warns (not fails) when two coloured themes have accents within 12 degrees of hue. A grey theme (saturation below 0.1) is exempt, because grey has no meaningful hue. This is a warning because a maintainer may choose similar colours on purpose; contrast is the hard rule.
- Unchanged: the agent tool list check, the shadowing-agent check, the pairing check.

## 8. Rollout

Each step ends with the full suite green (220 tests now).
1. `engine/themes.mjs` (parsing, contrast, emblems, `themeFor`) with unit tests.
2. The 12 theme files and the preflight checks.
3. `build-report.mjs` applies a theme, with a byte-for-byte comparison test for a report with no `hero`.
4. `build-assemble.mjs` applies Fury's theme and the card accents.
5. The skills write `hero` into the report JSON.
6. README, CHANGELOG, `plugin.json` and the version test to **1.5.0**, with its own changelog section.

## 9. Testing

Written first, red then green.
- **Colour and contrast:** accepts `#rrggbb`; rejects `red`, `#fff`, `rgb(0,0,0)`, `#12345g`, `#123456; } body{display:none` and empty. The contrast function reproduces 5.44 (current light accent) and 1.97 (gold).
- **`themeFor`:** `null` for missing, unknown, `../x`, `a/b` and invalid themes. The CSS contains the three accent overrides, including the `:root:not([data-theme=light])` guard, and only values that passed the hex check. The tagline is escaped and an over-long one refused.
- **Report builders:** a report with no `hero` is byte-for-byte what the current builder produces (captured before the change). `hero: hulk` adds the band, emblem, tagline and the three overrides, and the `<h1>` still holds the title. An unknown hero or a broken theme file renders unthemed with exit 0. The team page uses Fury's theme and each card its hero's emblem and accent. Escaping and the secret scan still hold for every new field.
- **Preflight:** each of the 12 shipped themes passes, and no pair of shipped coloured themes is within 12 degrees of hue (a test over the real files, so a future edit cannot quietly reintroduce look-alikes). A theme with a failing contrast, a bad emblem, a long tagline or a hero without a theme fails with the file named.
- **Skills:** the `ask`, hero and `assemble` skills say to write `hero` into the report JSON.
- Tests prove the colours are legal and readable and the markup is present. They cannot tell whether it looks good.

## 10. Known limits (stated in the README)

- Looks cannot be verified by tests; open a themed report in a browser and judge it.
- The contrast rule guarantees readability, not taste.
- Emblems are simple original icons, not Marvel artwork. "Avengers" and the hero names are Marvel trademarks: fine for a private or team plugin, rename before any public publish.
- A report built before 1.5.0 keeps its old look until it is rebuilt.
- Not yet checked in a real browser or a real Claude Code session.

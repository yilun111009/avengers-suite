// COPY of repo-avengers/engine/naming.mjs (1.6.0). tests/slug.test.mjs fails if the two drift apart.
// The one naming rule for saved folders, so every name has the same searchable shape:
//   reports  docs/flows/<YYYY-MM-DD>-<type>-<topic>   2026-10-09-impact-order-status-enum
//   plans    docs/plans/<YYYY-MM-DD>-<topic>          2026-10-09-add-partial-refunds
// A taken name gets -2, -3 ... The date leads so a plain `ls` sorts oldest to newest; `ls docs/flows/*-impact-*` finds a type.
// Folders made before this rule keep their old names: NAME_RE still accepts them and resolveName still finds them by exact name.
export const TOPIC_MAX = 40;
export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const DATED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

// lowercase words joined by hyphens, cut at a word boundary to at most TOPIC_MAX characters; '' when nothing is left
export function topicOf(text) {
  const s = String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length <= TOPIC_MAX) return s;
  const cut = s.slice(0, TOPIC_MAX + 1);
  const i = cut.lastIndexOf('-');
  return (i > 0 ? cut.slice(0, i) : s.slice(0, TOPIC_MAX)).replace(/-+$/, '');
}

// today in the user's own time zone, so a report made in the morning is not dated yesterday
export function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// <date>-<tag>-<topic>, or <date>-<topic> without a tag. `fallback` is the topic when the text has no usable letters.
export function folderName({ date, tag, text, fallback }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new Error(`date must be YYYY-MM-DD, got ${date}`);
  if (tag != null && !/^[a-z0-9]+$/.test(tag)) throw new Error(`tag must be lowercase letters and digits, got ${tag}`);
  return [date, tag, topicOf(text) || fallback].filter(Boolean).join('-');
}

// the name, then name-2, name-3 ...
export function uniqueName(base, exists) {
  if (!exists(base)) return base;
  for (let n = 2; ; n++) if (!exists(`${base}-${n}`)) return `${base}-${n}`;
}

// What the user typed -> a folder name, or null. An exact name always wins (so old folders work as before). Otherwise a
// short name matches a dated folder whose topic is that name, with or without one leading tag word and a -2, -3 suffix:
// `refund-flow` finds 2026-10-09-workflow-refund-flow. Several matches: the newest date, then the highest suffix.
export function resolveName(word, names) {
  if (!NAME_RE.test(word ?? '')) return null;
  if (names.includes(word)) return word;
  const re = new RegExp(`^(?:[a-z0-9]+-)?${word}(?:-(\\d+))?$`);
  let best = null;
  for (const name of names) {
    const d = DATED.exec(name);
    const m = d && re.exec(d[2]);
    if (!m) continue;
    const hit = { name, date: d[1], n: Number(m[1] ?? 1) };
    if (!best || hit.date > best.date || (hit.date === best.date && hit.n > best.n)) best = hit;
  }
  return best?.name ?? null;
}

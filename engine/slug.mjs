export function slugify(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'plan';
}

// name, then name-<date>, then name-<date>-2, -3 ... (same rule as repo-avengers' report folders)
export function uniqueSlug(base, exists, yyyymmdd) {
  if (!exists(base)) return base;
  const dated = `${base}-${yyyymmdd}`;
  if (!exists(dated)) return dated;
  for (let n = 2; ; n++) if (!exists(`${dated}-${n}`)) return `${dated}-${n}`;
}

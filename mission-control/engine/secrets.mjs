// COPY of repo-avengers/engine/secrets.mjs (1.5.6). tests/build-plan.test.mjs fails if the two drift apart.
// The secret patterns shared by build-report.mjs and build-assemble.mjs, so the two scans cannot drift apart.
export const SECRET_PATTERNS = [
  ['AWS access key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~+\/=-]{20,}/],
  ['connection-string credential', /\b(?:Password|Pwd)\s*=\s*[^;\s'"]{4,}/i],
  ['URL with embedded credentials', /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/:@]+:[^\s\/@]{3,}@/i],
  ['assigned secret value', /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|token|client[_-]?secret)\w*["']?\s*[:=]\s*["']?(?=[^\s"',;]{8,})(?=[^\s"',;]*[\d!@#$%^&*])[^\s"',;]+/i],
];

// returns one "<path>: looks like <name>" string per hit; values are never included
export function scanSecrets(value, root = '') {
  const hits = [];
  (function walk(v, path) {
    if (typeof v === 'string') { for (const [name, re] of SECRET_PATTERNS) if (re.test(v)) hits.push(`${path}: looks like ${name}`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  })(value, root);
  return hits;
}

// The one parser for "path:line" citations: "src/a.ts:12", "src/a.ts:12-20", "src/a.ts:12,15". Returns null for anything else.
export function parseCite(s) {
  const m = /^(.+?):(\d+)(?:[-–,]\d+)*$/.exec(String(s ?? '').trim());
  if (!m) return null;
  return { path: m[1].replace(/\\/g, '/'), line: Number(m[2]) };
}

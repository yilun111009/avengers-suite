#!/usr/bin/env node
// Usage: node build-report.mjs <input.json> <output.html> [--plain]
// Renders a self-contained HTML flow report (inline SVG diagram, no external requests).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { REPORT_TYPES, TYPE_LABEL } from './types.mjs';
import { scanSecrets } from './secrets.mjs';

const [, , inPath, outPath, ...flags] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node build-report.mjs <input.json> <output.html> [--plain]');
  process.exit(2);
}
const d = JSON.parse(readFileSync(inPath, 'utf8'));
const KNOWN_TYPES = REPORT_TYPES;
const KNOWN_AUDIENCES = ['dev', 'qa', 'pm', 'support'];
const AUDIENCE_LABEL = { dev: 'Developers', qa: 'QA', pm: 'Product', support: 'Support' };
// reports from before 1.0.0 have neither field: they are workflow questions for developers
const type = KNOWN_TYPES.includes(d.type) ? d.type : 'workflow';
const audience = KNOWN_AUDIENCES.includes(d.audience) ? d.audience : 'dev';
const startPlain = flags.includes('--plain') || audience !== 'dev';

// ---- secret scan: refuse to write a report that appears to contain a credential ----
const secretHits = scanSecrets(d, '');
if (secretHits.length) {
  console.error('REFUSING to write report: possible secrets found (values not shown). Remove or redact them in the JSON, then re-run.');
  secretHits.forEach((h) => console.error('  - ' + h));
  process.exit(3);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (Array.isArray(a) ? a : []);

if (d.type !== undefined && !KNOWN_TYPES.includes(d.type)) console.error('warning: unknown type in the report JSON, treated as workflow');
if (d.audience !== undefined && !KNOWN_AUDIENCES.includes(d.audience)) console.error('warning: unknown audience in the report JSON, treated as dev');

// lens-specific tables and lists arrive as d.sections: [{heading, kind: 'table'|'list'|'text', columns, rows, items, text}]
const sectionHtml = (s) => {
  const head = `<h2>${esc(s?.heading)}</h2>`;
  if (s?.kind === 'table') {
    const cols = list(s.columns);
    const rows = list(s.rows).map((r) => `<tr>${cols.map((_, i) => `<td>${esc(list(r)[i])}</td>`).join('')}</tr>`).join('');
    return `${head}<div class="tbl"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  if (s?.kind === 'list') return `${head}<ul>${list(s.items).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (s?.kind === 'text') return `${head}<div class="card"><p>${esc(s.text)}</p></div>`;
  return '';
};
const sections = list(d.sections).map(sectionHtml).join('');

const DEFAULT_LANES = [
  ['controller', 'Entry point'],
  ['service', 'Logic'],
  ['data', 'Data / Cache'],
  ['external', 'External'],
];
// lanes come from the report JSON so each repo can name its own layers; unknown node lanes are appended
const LANES = (Array.isArray(d.lanes) && d.lanes.length ? d.lanes.map((l) => [String(l.id), String(l.label ?? l.id)]) : DEFAULT_LANES).slice();
for (const n of list(d.nodes)) if (n.lane && !LANES.some(([k]) => k === n.lane)) LANES.push([n.lane, String(n.lane)]);
const laneIdx = (l) => Math.max(0, LANES.findIndex(([k]) => k === l));

// ---- diagram -------------------------------------------------------------
function diagram(nodes, edges) {
  if (!nodes.length) return '<p class="muted">No diagram data.</p>';
  const ids = new Set(nodes.map((n) => n.id));
  const es = edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);

  // find back edges (cycles) with DFS so they don't distort the column layout
  const back = new Set();
  const state = {};
  const adj = {};
  for (const n of nodes) adj[n.id] = [];
  es.forEach((e, i) => adj[e.from].push([e.to, i]));
  const incoming = new Set(es.map((e) => e.to));
  const roots = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
  const visit = (u) => {
    state[u] = 1;
    for (const [v, i] of adj[u]) {
      if (state[v] === 1) back.add(i);
      else if (!state[v]) visit(v);
    }
    state[u] = 2;
  };
  for (const r of roots.length ? roots : [nodes[0].id]) if (!state[r]) visit(r);
  for (const n of nodes) if (!state[n.id]) visit(n.id);
  const fwd = es.filter((_, i) => !back.has(i));

  // column = longest path from a source over forward edges only
  const col = Object.fromEntries(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of fwd) {
      if (col[e.to] < col[e.from] + 1) { col[e.to] = col[e.from] + 1; changed = true; }
    }
    if (!changed) break;
  }
  // nodes sharing a (lane, col) cell are stacked into extra sub-rows
  const cell = new Map();
  const sub = {};
  for (const n of nodes) {
    const k = `${laneIdx(n.lane)}:${col[n.id]}`;
    sub[n.id] = cell.get(k) ?? 0;
    cell.set(k, sub[n.id] + 1);
  }
  const nw = {};
  for (const n of nodes) nw[n.id] = Math.min(300, Math.max(150, Math.ceil(Math.max(String(n.label ?? '').length * 7.6, String(n.sub ?? '').length * 6.2) + 28)));
  const colW = {};
  for (const n of nodes) colW[col[n.id]] = Math.max(colW[col[n.id]] ?? 0, nw[n.id]);
  const isFwd = (i) => !back.has(i) && col[es[i].from] !== col[es[i].to];
  // node height grows with its number of forward connections so endpoints stay >= 16px apart
  const inDeg = {}, outDeg = {};
  es.forEach((e, i) => { if (isFwd(i)) { outDeg[e.from] = (outDeg[e.from] ?? 0) + 1; inDeg[e.to] = (inDeg[e.to] ?? 0) + 1; } });
  const nh = {};
  for (const n of nodes) nh[n.id] = Math.max(52, 16 * Math.max(inDeg[n.id] ?? 0, outDeg[n.id] ?? 0) + 14);
  const laneRows = LANES.map((_, i) => Math.max(1, ...nodes.filter((n) => laneIdx(n.lane) === i).map((n) => sub[n.id] + 1)));
  const pitch = LANES.map((_, i) => Math.max(52, ...nodes.filter((n) => laneIdx(n.lane) === i).map((n) => nh[n.id])) + 26);
  const laneY = []; let y = 10;
  laneRows.forEach((r, i) => { laneY.push(y); y += r * pitch[i] + 20; });
  const H = y + 8;
  const X0 = Math.max(104, Math.ceil(Math.max(...LANES.map(([, l]) => l.length)) * 7 + 28));
  const maxCol = Math.max(...Object.values(col));
  // gap after each column grows with the longest label on an edge leaving it
  const gap = Array(maxCol + 1).fill(44);
  fwd.forEach((e) => { if (e.label && col[e.to] === col[e.from] + 1) gap[col[e.from]] = Math.max(gap[col[e.from]], Math.ceil(e.label.length * 5.8) + 24); });
  const colX = []; let cx = X0;
  for (let c = 0; c <= maxCol; c++) { colX[c] = cx; cx += (colW[c] ?? 150) + gap[c]; }
  const W = cx - gap[maxCol] + 24;
  const pos = {};
  for (const n of nodes) pos[n.id] = { x: colX[col[n.id]] + ((colW[col[n.id]] - nw[n.id]) >> 1), y: laneY[laneIdx(n.lane)] + sub[n.id] * pitch[laneIdx(n.lane)] + 8, w: nw[n.id], h: nh[n.id] };

  // spread edge endpoints along node sides so fan-out/fan-in edges don't bundle
  const outOff = {}, inOff = {};
  const spread = (key, list, store) => {
    const m = {};
    list.forEach(({ i, other }) => { (m[key(i)] ??= []).push({ i, y: pos[other].y }); });
    Object.entries(m).forEach(([id, arr]) => {
      arr.sort((a, b) => a.y - b.y);
      arr.forEach((o, k) => { store[o.i] = arr.length === 1 ? 0 : (k / (arr.length - 1) - 0.5) * (pos[id].h - 14); });
    });
  };
  spread((i) => es[i].from, es.map((e, i) => ({ i, other: e.to })).filter((o) => isFwd(o.i)), outOff);
  spread((i) => es[i].to, es.map((e, i) => ({ i, other: e.from })).filter((o) => isFwd(o.i)), inOff);

  // animation: a "packet" travels edge by edge in column order, one slot per column, then the loop restarts
  const SLOT = 1.1, TRAVEL = 0.9;
  // slot = which animation step an edge fires in. With `step` numbers on edges it follows the Steps table; otherwise the column layout.
  const stepOf = (e) => (e.step !== undefined && e.step !== null && e.step !== '' && Number.isFinite(+e.step) ? +e.step : null);
  const ranks = [...new Set(es.map(stepOf).filter((v) => v !== null))].sort((a, b) => a - b);
  const slotOf = es.map((e, i) => (ranks.length ? (stepOf(e) !== null ? ranks.indexOf(stepOf(e)) : undefined) : col[e.from] + (back.has(i) ? 1 : 0)));
  for (let pass = 0; pass < es.length && slotOf.includes(undefined); pass++) {
    es.forEach((e, i) => {
      if (slotOf[i] !== undefined) return;
      const inc = es.map((_, j) => j).filter((j) => slotOf[j] !== undefined && es[j].to === e.from);
      if (inc.length) slotOf[i] = Math.min(...inc.map((j) => slotOf[j])) + 1;
      else if (pass === es.length - 1) slotOf[i] = 0;
    });
  }
  for (let i = 0; i < slotOf.length; i++) if (slotOf[i] === undefined) slotOf[i] = 0;
  const cycle = +((Math.max(0, ...slotOf) + 1) * SLOT + 1.4).toFixed(2);
  // a node lights up when its first packet arrives (roots when their first packet leaves)
  const arrive = {};
  for (const n of nodes) {
    const inn = es.map((e, i) => (e.to === n.id ? slotOf[i] * SLOT + TRAVEL : null)).filter((v) => v !== null);
    const out = es.map((e, i) => (e.from === n.id ? slotOf[i] * SLOT : null)).filter((v) => v !== null);
    arrive[n.id] = inn.length ? Math.min(...inn) : out.length ? Math.min(...out) : 0;
  }
  const kt = (a, b) => { const e = 0.002, t0 = Math.max(a / cycle, 0.001), t1 = Math.min(b / cycle, 0.998); return { t0, t1, e }; };
  const win = (a, b, from, to) => { const { t0, t1, e } = kt(a, b); return { kt: `0;${t0};${(t0 + e).toFixed(4)};${(t1 - e).toFixed(4)};${t1};1`, vals: `${from};${from};${to};${to};${from};${from}` }; };
  let s = `<svg id="flow-svg" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto" role="img" aria-label="Animated flow diagram" xmlns="http://www.w3.org/2000/svg">`;
  s += `<defs>` + ['ok', 'fail', 'async'].map((k) => `<marker id="ah-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow-${k}"/></marker>`).join('') + `</defs>`;
  LANES.forEach(([, label], i) => {
    const h = laneRows[i] * pitch[i] + 8;
    s += `<rect x="0" y="${laneY[i] - 4}" width="${W}" height="${h + 12}" class="lane lane-${i % 2}"/>`;
    s += `<text x="12" y="${laneY[i] + h / 2}" class="lane-label">${esc(label)}</text>`;
  });
  for (const [ei, e] of es.entries()) {
    const a = pos[e.from], b = pos[e.to], kind = ['fail', 'async'].includes(e.kind) ? e.kind : 'ok';
    let p, lp = null;
    if (back.has(ei)) {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h, dip = Math.max(y1, y2) + 22;
      p = `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`;
    } else if (col[e.from] === col[e.to]) {
      const down = b.y > a.y;
      const x = a.x + a.w / 2, y1 = down ? a.y + a.h : a.y, y2 = down ? b.y : b.y + b.h;
      p = `M${x},${y1} L${x},${y2}`;
    } else {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2 + (outOff[ei] ?? 0), x2 = b.x, y2 = b.y + b.h / 2 + (inOff[ei] ?? 0), mx = (x1 + x2) / 2;
      p = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
      lp = { x: mx, y: (y1 + y2) / 2 };   // exact point at t=0.5 of this bezier
    }
    const stp = stepOf(e);
    s += `<g class="eg" data-from="${esc(e.from)}" data-to="${esc(e.to)}"${stp !== null ? ` data-step="${esc(stp)}"` : ''}><path id="ep${ei}" d="${p}" class="edge edge-${kind}" marker-end="url(#ah-${kind})"/>`;
    s += `<path d="${p}" class="edge-flow flow-${kind}"/>`;
    {
      const c0 = slotOf[ei] * SLOT, w = win(c0, c0 + TRAVEL, 0, 1), o = win(c0, c0 + TRAVEL, 0, 1);
      s += `<circle r="5" class="packet packet-${kind}" opacity="0"><animateMotion dur="${cycle}s" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;0;1;1;1" keyTimes="${w.kt}"><mpath href="#ep${ei}"/></animateMotion>`;
      s += `<animate attributeName="opacity" dur="${cycle}s" repeatCount="indefinite" keyTimes="${o.kt}" values="0;0;1;1;0;0"/></circle>`;
    }
    if (stp !== null) {
      let bx, by;
      if (back.has(ei)) { const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y + b.h, dip = Math.max(y1, y2) + 22; bx = (x1 + x2) / 2; by = (y1 + y2 + 6 * dip) / 8; }
      else if (col[e.from] === col[e.to]) { bx = a.x + a.w / 2; by = (Math.min(a.y, b.y) + Math.max(a.y + a.h, b.y + b.h)) / 2; }
      else { bx = lp.x; by = lp.y; }
      s += `<g class="sbadge"><circle cx="${bx}" cy="${by}" r="8"/><text x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="central">${esc(stp)}</text></g>`;
    }
    s += `</g>`;
    // on crowded fan-in/fan-out the labels cannot be placed unambiguously; the node subtitles carry that meaning instead
    const crowded = Math.max(outDeg[e.from] ?? 0, inDeg[e.to] ?? 0, inDeg[e.from] ?? 0, outDeg[e.to] ?? 0) > 3;
    if (e.label && !crowded) {
      const bk = back.has(ei);
      // forward cross-column edges: label sits on its own curve's midpoint (midpoints are spread, so labels do not collide)
      const lx = lp ? lp.x : bk ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : a.x + a.w / 2 + 6;
      const ly = lp ? lp.y - (stepOf(e) !== null ? 12 : 4) : bk ? Math.max(a.y + a.h, b.y + b.h) + 20 : (a.y + a.h + b.y) / 2;
      s += `<text x="${lx}" y="${ly}" class="edge-label" text-anchor="${lp || bk ? 'middle' : 'start'}">${esc(e.label)}</text>`;
    }
  }
  for (const n of nodes) {
    const { x, y: ny, w: W_, h: Hn } = pos[n.id];
    const cls = n.confirmed === false ? 'node unconfirmed' : 'node';
    const g = win(arrive[n.id] - 0.05, arrive[n.id] - 0.05 + SLOT * 0.95, 0, 1);
    s += `<g class="${cls}" data-id="${esc(n.id)}"><rect class="glow" x="${x - 3}" y="${ny - 3}" width="${W_ + 6}" height="${Hn + 6}" rx="10" opacity="0"><animate attributeName="opacity" dur="${cycle}s" repeatCount="indefinite" keyTimes="${g.kt}" values="0;0;1;1;0;0"/></rect>`;
    s += `<rect class="box" x="${x}" y="${ny}" width="${W_}" height="${Hn}" rx="8"/>`;
    s += `<text x="${x + W_ / 2}" y="${ny + Hn / 2 + (n.sub ? -4 : 5)}" text-anchor="middle" class="n-title">${esc(n.label)}</text>`;
    if (n.sub) s += `<text x="${x + W_ / 2}" y="${ny + Hn / 2 + 14}" text-anchor="middle" class="n-sub">${esc(n.sub)}</text>`;
    s += `<title>${esc(n.label)}${n.confirmed === false ? ' (not confirmed in source)' : ''}</title></g>`;
  }
  return s + '</svg>';
}

// ---- sections ------------------------------------------------------------
const cite = (c) => (c ? `<code>${esc(c)}</code>` : '');
const steps = list(d.steps).map((s, i) => `<tr><td class="num">${esc(s.n ?? i + 1)}</td><td>${esc(s.text)}</td><td>${cite(s.cite)}</td></tr>`).join('');
const rules = list(d.rules).map((r) => `<li>${esc(r.text)} ${cite(r.cite)}</li>`).join('');
const touch = list(d.touchpoints).map((t) => `<li><span class="tag">${esc(t.kind)}</span> ${esc(t.name)}</li>`).join('');
const conf = d.confidence ?? {};
const confBlock = [['confirmed', 'Confirmed in source', 'ok'], ['graphOnly', 'From the graph only', 'warn'], ['unconfirmed', 'Not confirmed', 'bad']]
  .map(([k, label, c]) => list(conf[k]).length ? `<h3 class="${c}">${label}</h3><ul>${list(conf[k]).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '').join('');
const plainSteps = list(d.plainSteps).map((s) => `<li>${esc(s)}</li>`).join('');
const sources = list(d.sources).map((s) => `<li><code>${esc(s)}</code></li>`).join('');
const stale = d.graphStale ? `<div class="banner">Graph may be stale: ${esc(d.graphStale)}. The agent read source directly where noted.</div>` : '';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(d.title)} - Flow report</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#5b6670;--card:#f6f8fa;--line:#d0d7de;--accent:#0b7a3b;--lane0:#f6f8fa;--lane1:#eef2f6;--node:#fff;--nodeline:#57606a;--ok:#2f6f4f;--fail:#b3261e;--async:#6a5acd;--warn:#9a6700;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a;--lane0:#11161d;--lane1:#161b22;--node:#1f2630;--nodeline:#8b949e;--ok:#5fcf8f;--fail:#ff7b72;--async:#a99bff;--warn:#e3b341;--bad:#ff7b72}}
:root[data-theme=dark]{--bg:#0d1117;--fg:#e6edf3;--muted:#9aa5b1;--card:#161b22;--line:#30363d;--accent:#44d17a;--lane0:#11161d;--lane1:#161b22;--node:#1f2630;--nodeline:#8b949e;--ok:#5fcf8f;--fail:#ff7b72;--async:#a99bff;--warn:#e3b341;--bad:#ff7b72}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{margin:0 0 4px;font-size:1.6rem}h2{margin:32px 0 10px;font-size:1.15rem;border-bottom:1px solid var(--line);padding-bottom:6px}h3{margin:14px 0 4px;font-size:.95rem}
.muted{color:var(--muted)}.meta{color:var(--muted);font-size:.85rem}
.bar{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}
button{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font:inherit;cursor:pointer}
button[aria-pressed=true]{border-color:var(--accent);color:var(--accent);font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px}
.diagram{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}
.diagram svg{display:block;margin:0 auto}
.lane-0{fill:var(--lane0)}.lane-1{fill:var(--lane1)}.lane-label{fill:var(--muted);font-size:12px;font-weight:600}
.node rect.box{fill:var(--node);stroke:var(--nodeline);stroke-width:1.2}.node.unconfirmed rect.box{stroke-dasharray:5 4;opacity:.8}
.glow{fill:none;stroke:var(--accent);stroke-width:2.5;pointer-events:none}
.edge-flow{fill:none;stroke-width:2.2;stroke-dasharray:3 13;stroke-linecap:round;opacity:.55;animation:flow 1.1s linear infinite}
.flow-ok{stroke:var(--ok)}.flow-fail{stroke:var(--fail)}.flow-async{stroke:var(--async)}
@keyframes flow{to{stroke-dashoffset:-16}}
.packet-ok{fill:var(--ok)}.packet-fail{fill:var(--fail)}.packet-async{fill:var(--async)}.packet{stroke:var(--bg);stroke-width:1.5}
.paused .edge-flow{animation-play-state:paused}
.sbadge circle{fill:var(--bg);stroke:var(--accent);stroke-width:1.5}.sbadge text{fill:var(--fg);font-size:10px;font-weight:700}
.dim{opacity:.18;transition:opacity .15s}.node,.eg{transition:opacity .15s}
.node{cursor:default}
@media (prefers-reduced-motion:reduce){.edge-flow{animation:none}}
.n-title{fill:var(--fg);font-size:12.5px;font-weight:600}.n-sub{fill:var(--muted);font-size:11px}
.edge{fill:none;stroke-width:1.6}.edge-ok{stroke:var(--ok)}.edge-fail{stroke:var(--fail);stroke-dasharray:6 3}.edge-async{stroke:var(--async);stroke-dasharray:2 4}
.arrow-ok{fill:var(--ok)}.arrow-fail{fill:var(--fail)}.arrow-async{fill:var(--async)}.edge-label{fill:var(--muted);font-size:11px;paint-order:stroke;stroke:var(--lane0);stroke-width:4px;stroke-linejoin:round}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.8rem;color:var(--muted);margin:8px 0}
table{width:100%;border-collapse:collapse}td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}td.num{width:32px;color:var(--muted)}
code{font:12.5px ui-monospace,Consolas,monospace;background:var(--card);padding:1px 5px;border-radius:4px;word-break:break-all}
.tag{display:inline-block;font-size:.72rem;border:1px solid var(--line);border-radius:10px;padding:0 8px;color:var(--muted);margin-right:4px}
.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.banner{background:var(--card);border-left:4px solid var(--warn);padding:8px 12px;margin:12px 0;border-radius:4px}
[data-view=plain] .dev-only,[data-view=dev] .plain-only{display:none}
li{margin:3px 0}
th{text-align:left;padding:7px 8px;border-bottom:2px solid var(--line);font-size:.85rem;color:var(--muted)}.tbl{overflow-x:auto}
</style></head>
<body data-view="${startPlain ? 'plain' : 'dev'}"><main>
<h1>${esc(d.title)}</h1>
<div class="meta">Question: ${esc(d.question)} &middot; Treated as: ${TYPE_LABEL[type]} question &middot; For: ${AUDIENCE_LABEL[audience]} &middot; Generated <span id="gen">${esc(d.generated ?? new Date().toISOString().slice(0, 10))}</span>${d.commit ? ` at commit <code>${esc(d.commit)}</code>` : ''} <span id="ago"></span></div>
<div class="banner" id="age" hidden></div>
${stale}
<div class="bar" role="group" aria-label="View">
<button id="b-dev" aria-pressed="${!startPlain}">Developer view</button>
<button id="b-plain" aria-pressed="${startPlain}">Plain-language view</button>
<button id="b-theme" aria-pressed="false">Toggle theme</button>
</div>

<h2>Summary</h2>
<div class="card"><p class="dev-only">${esc(d.summary)}</p><p class="plain-only">${esc(d.plainSummary || d.summary)}</p></div>
${sections}

<h2><span class="dev-only">Flow diagram</span><span class="plain-only">How it works</span></h2>
<div class="diagram dev-only">${diagram(list(d.nodes), list(d.edges))}</div>
<div class="bar dev-only" id="anim-bar" role="group" aria-label="Animation">
<button id="b-play" aria-pressed="false">Pause</button><button id="b-replay">Replay</button><span class="meta">Packets follow the flow step by step. Hover a box to isolate its connections.</span>
</div>
<div class="legend dev-only"><span><b class="ok">&mdash;</b> normal path</span><span><b class="bad">- - -</b> failure path</span><span><b style="color:var(--async)">&middot;&middot;&middot;</b> async / side effect</span><span>dashed box = not confirmed in source</span></div>
<ol class="plain-only">${plainSteps || '<li>No plain-language steps were provided.</li>'}</ol>

<div class="dev-only">
<h2>Steps</h2>
<table><tbody>${steps}</tbody></table>
<h2>Key rules and branches</h2><ul>${rules}</ul>
<h2>Data and external touchpoints</h2><ul style="list-style:none;padding:0">${touch}</ul>
</div>

<h2>Confidence</h2>
<div class="card">${confBlock || '<p class="muted">Not provided.</p>'}</div>

<div class="plain-only"><h2>Source references (for the developer to verify before forwarding)</h2><ul>${sources}</ul></div>
</main>
<script>
(function(){var g=document.getElementById('gen'),m=g&&/^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(g.textContent);
if(m){var days=Math.floor((Date.now()-Date.UTC(+m[1],+m[2]-1,+m[3]))/864e5);
if(days>=1){var a=document.getElementById('ago');a.textContent='('+(days<14?days+' days ago':days<60?Math.round(days/7)+' weeks ago':Math.round(days/30)+' months ago')+')'}
if(days>=14){var bn=document.getElementById('age');bn.hidden=false;bn.textContent='This report is '+days+' days old. The code may have changed since it was written; re-run /ask to refresh it, and check the cited lines before relying on it.'}}})();
(function(){var b=document.body,d=document.getElementById('b-dev'),p=document.getElementById('b-plain'),t=document.getElementById('b-theme');
function v(x){b.setAttribute('data-view',x);d.setAttribute('aria-pressed',x==='dev');p.setAttribute('aria-pressed',x==='plain')}
d.onclick=function(){v('dev')};p.onclick=function(){v('plain')};
var svg=document.getElementById('flow-svg'),pb=document.getElementById('b-play'),rb=document.getElementById('b-replay');
if(svg&&pb){var paused=false;function setP(x){paused=x;if(x){svg.pauseAnimations();svg.classList.add('paused')}else{svg.unpauseAnimations();svg.classList.remove('paused')}pb.textContent=x?'Play':'Pause';pb.setAttribute('aria-pressed',x)}
pb.onclick=function(){setP(!paused)};rb.onclick=function(){svg.setCurrentTime(0);setP(false)};
if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches){setP(true)}
var nodes=svg.querySelectorAll('.node'),eds=svg.querySelectorAll('.eg');
nodes.forEach(function(n){var id=n.getAttribute('data-id');n.addEventListener('mouseenter',function(){var keep={};keep[id]=1;eds.forEach(function(e){var hit=e.dataset.from===id||e.dataset.to===id;if(hit){keep[e.dataset.from]=1;keep[e.dataset.to]=1}e.classList.toggle('dim',!hit)});nodes.forEach(function(m){m.classList.toggle('dim',!keep[m.getAttribute('data-id')])})});
n.addEventListener('mouseleave',function(){eds.forEach(function(e){e.classList.remove('dim')});nodes.forEach(function(m){m.classList.remove('dim')})})})}
t.onclick=function(){var r=document.documentElement,c=r.getAttribute('data-theme');r.setAttribute('data-theme',c==='dark'?'light':'dark')};})();
</script></body></html>`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`wrote ${outPath} (${html.length} bytes)`);

#!/usr/bin/env node
// Usage: node detect-route.mjs "<question>"
// Prints one JSON object: {type, alsoMatches, unclear, audience}. Pure text rules, reads nothing, writes nothing.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

export const TYPE_ORDER = ['support', 'impact', 'deadcode', 'risk', 'architecture', 'logic', 'deepdive', 'workflow'];
const TYPE_RULES = {
  support: [/\bwhy (would|does|do|did|can't|cannot) (a |the |my )?(user|customer|player|merchant|client)/i, /\berror\b/i, /\bcustomer (says|reports|complain)/i, /\bhow (do|can|should) (i|we) fix\b/i, /\bfailed with\b/i, /\btroubleshoot/i],
  impact: [/\bwhat (breaks|will break|would break|happens if i (change|remove|delete|rename))\b/i, /\bwho (calls|uses|depends on)\b/i, /\bis it safe to (remove|delete|change|rename)\b/i, /\bblast radius\b/i, /\bimpact of\b/i],
  architecture: [/\bhow is .+ (structured|organi[sz]ed|layered)\b/i, /\b(what|which) layers\b/i, /\barchitecture\b/i, /\bhow do .+ (and|&) .+ (connect|talk|communicate|interact)\b/i, /\bhigh[- ]level\b/i],
  logic: [/\brules?\b/i, /\bwhen (does|do|is|are|will)\b/i, /\bwhy does (it|this|the .+) (reject|refuse|fail|block|deny)/i, /\b(validation|eligib|permission)/i],
  workflow: [/\bwhat happens (from|when|after|between)\b/i, /\bwalk me through\b/i, /\bwho does what\b/i, /\bstep[- ]by[- ]step\b/i, /\bflow\b/i, /\bhow does .+ work\b/i],
  deadcode: [/\b(unused (code|files?|exports?|functions?|classes|methods?|variables?|imports?|config|flags?|routes?|modules?)|anything unused|dead code|never called|unreferenced|unreachable (code|branch|branches))\b/i, /\bnot (used|referenced|called) anywhere\b/i],
  risk: [/\bhidden risks?\b/i, /\bwhat could go wrong\b/i, /\bsecurity smell\b/i, /\bunchecked (return|result|error|exception|input|permission)s?\b/i, /\bsilent(ly)? (catch|fail|swallow)/i],
  deepdive: [/\bline[- ]by[- ]line\b/i, /\bwalk through this (function|method|class)\b/i, /\bexplain this (function|method|class)\b/i],
};

const WHO = {
  qa: 'qa|testers?|test team|quality assurance',
  pm: 'pm|pms|product managers?|product owners?|product team',
  support: 'support|tech support|technical support|customer support|helpdesk',
  dev: 'dev|devs|developers?|engineers?|me|myself',
};
const NOT_NOUN = String.raw`(?!\s+(?:tickets?|cases?|requests?|flows?|modules?|pages?|queues?|code)\b)`;
const audienceRes = (who) => [
  new RegExp(String.raw`^\s*for\s+(?:the\s+)?(?:${who})\b${NOT_NOUN}`, 'i'),
  new RegExp(String.raw`\b(?:explain|answer|write|describe|summari[sz]e|tell)\b[^.?]{0,25}\b(?:to|for)\s+(?:the\s+)?(?:${who})\b${NOT_NOUN}`, 'i'),
  new RegExp(String.raw`\b(?:this|it)\s+(?:is|'s)\s+for\s+(?:the\s+)?(?:${who})\b${NOT_NOUN}`, 'i'),
  new RegExp(String.raw`--for\s+(?:${who})\b`, 'i'),
];
const AUDIENCE_RULES = Object.entries(WHO).map(([name, who]) => [name, audienceRes(who)]);

export function detect(question) {
  // a hero skill may put `hero: <name>` in front of the user's words; it is not part of the question
  const q = String(question ?? '').trim().replace(/^hero:\s*\w+\s*/i, '');
  const hits = TYPE_ORDER
    .map((t) => [t, TYPE_RULES[t].filter((re) => re.test(q)).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const audience = AUDIENCE_RULES.find(([, res]) => res.some((re) => re.test(q)))?.[0] ?? null;
  return {
    type: hits[0]?.[0] ?? 'workflow',
    alsoMatches: hits[1]?.[0] ?? null,
    unclear: hits.length === 0,
    audience,
  };
}

// The question comes from the arguments, or from stdin when there are none. The skill uses stdin so that
// backticks, $() and quotes in a pasted question are never seen by a shell.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).join(' ');
  const q = args || (process.stdin.isTTY ? '' : readFileSync(0, 'utf8'));
  console.log(JSON.stringify(detect(q)));
}

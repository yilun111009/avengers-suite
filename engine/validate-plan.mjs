import { MODELS } from './constants.mjs';

const str = (v) => typeof v === 'string' && v.trim() !== '';
const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

// Checks the merged plan (the agent's JSON plus the fields build-plan sets). Returns every problem, each with its path.
export function validatePlan(p) {
  const errors = [];
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, errors: ['the plan is not a JSON object'] };
  for (const f of ['title', 'goal', 'summary']) if (!str(p[f])) errors.push(`${f} must be a non-empty string`);
  if (!MODELS.includes(p.model)) errors.push('model must be opus, sonnet or haiku (build-plan sets it from --model; the agent does not)');
  if (!Array.isArray(p.slugs) || !p.slugs.length || !strArr(p.slugs)) errors.push('slugs must be a non-empty list of report folder names');
  if (!strArr(p.assumptions)) errors.push('assumptions must be a list of strings (an empty list is fine)');
  if (p.checks !== undefined && (typeof p.checks !== 'object' || p.checks === null || Array.isArray(p.checks) || typeof p.checks.counts !== 'object' || !Array.isArray(p.checks.results))) {
    errors.push('checks must be { results: [...], counts: {...} }');
  }
  if (!Array.isArray(p.stages) || !p.stages.length) {
    errors.push('stages must be a non-empty list');
  } else {
    p.stages.forEach((s, i) => {
      const at = `stages[${i}]`;
      if (!str(s?.name)) errors.push(`${at}.name must be a non-empty string`);
      if (s?.purpose !== undefined && typeof s.purpose !== 'string') errors.push(`${at}.purpose must be a string`);
      if (!Array.isArray(s?.steps) || !s.steps.length) errors.push(`${at}.steps must be a non-empty list`);
      else s.steps.forEach((st, j) => {
        const sa = `${at}.steps[${j}]`;
        for (const f of ['text', 'change', 'verify']) if (!str(st?.[f])) errors.push(`${sa}.${f} must be a non-empty string`);
        if (!strArr(st?.files)) errors.push(`${sa}.files must be a list of strings (an empty list is fine)`);
        if (st?.risk !== undefined && typeof st.risk !== 'string') errors.push(`${sa}.risk must be a string`);
      });
      if (!Array.isArray(s?.goNoGo) || !s.goNoGo.length) errors.push(`${at}.goNoGo must be a non-empty list`);
      else s.goNoGo.forEach((g, k) => {
        for (const f of ['check', 'passWhen']) if (!str(g?.[f])) errors.push(`${at}.goNoGo[${k}].${f} must be a non-empty string`);
      });
    });
  }
  return { ok: errors.length === 0, errors };
}

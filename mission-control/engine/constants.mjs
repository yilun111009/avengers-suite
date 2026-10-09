// The one place that names the models, folders and report fields. There is deliberately NO default model here.
export const MODELS = ['opus', 'sonnet', 'haiku'];
export const MODEL_NOTE = {
  opus: 'most thorough, most expensive',
  sonnet: 'balanced',
  haiku: 'cheapest, best for small plans',
};
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const FLOWS_ROOT = 'docs/flows';
export const PLAN_ROOT = 'docs/plans';
// the repo-avengers report.json fields this plugin reads; tests fail if the baseline fixture loses one
export const REPORT_FIELDS_USED = ['title', 'question', 'summary', 'type', 'generated', 'commit', 'steps', 'rules', 'sources', 'confidence', 'sections'];

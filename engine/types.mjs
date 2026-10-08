// The one list of question types. build-report, build-index, check-onboarding and detect-route all import it,
// so adding a type is a change in this file (plus its hero file and routing rule), not four.
export const LENS_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk'];
export const TYPE_LABEL = {
  architecture: 'Architecture', logic: 'Logic', workflow: 'Workflow', support: 'Support', impact: 'Impact',
  deadcode: 'Dead code', deepdive: 'Deep dive', risk: 'Risk',
};
// a hero file may also say `auto`: no lens of its own, the router decides the type like plain /ask
export const HERO_TYPES = [...LENS_TYPES, 'auto'];

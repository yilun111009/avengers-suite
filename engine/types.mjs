// The one list of question types. build-report, build-index and check-onboarding import it, so adding a type is one change
// here for them. detect-route.mjs does NOT import it: it keeps its own TYPE_ORDER and TYPE_RULES. A new type ALSO needs:
// a hero file in heroes/ and a thin skill in skills/, a rule and ordering entry in detect-route.mjs (with fixtures), the
// type list in agents/repo-avengers.md, the mapping sentence in skills/ask/SKILL.md step 5, and a row in the README table.
export const LENS_TYPES = ['architecture', 'logic', 'workflow', 'support', 'impact', 'deadcode', 'deepdive', 'risk'];
export const TYPE_LABEL = {
  architecture: 'Architecture', logic: 'Logic', workflow: 'Workflow', support: 'Support', impact: 'Impact',
  deadcode: 'Dead code', deepdive: 'Deep dive', risk: 'Risk',
  assemble: 'Assemble',
};
// a hero file may also say `auto`: no lens of its own, the router decides the type like plain /ask
export const HERO_TYPES = [...LENS_TYPES, 'auto'];
// what a saved report may say in `type:`. `assemble` is the combined /assemble page; it is not a lens and not a hero type.
export const REPORT_TYPES = [...LENS_TYPES, 'assemble'];

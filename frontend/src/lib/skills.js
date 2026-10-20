// The shared skills list (decision 2026-10-21): the same rules as Core's SkillCatalog, so what the
// picker shows is what is saved. Comparison ignores case and extra spaces.

export function skillKey(skill) {
  return skill.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Map of every list name and alias (by key) to the list name. */
export function makeSkillLookup(list = []) {
  const lookup = new Map();
  for (const skill of list) {
    for (const spelling of [skill.name, ...(skill.aliases ?? [])]) {
      if (!lookup.has(skillKey(spelling))) lookup.set(skillKey(spelling), skill.name);
    }
  }
  return lookup;
}

/** The list name for a known spelling ("ms excel" → "Microsoft Excel"), else the skill as typed. */
export function canonicalSkill(lookup, typed) {
  const clean = typed.trim().replace(/\s+/g, ' ');
  return lookup.get(skillKey(clean)) ?? clean;
}

/**
 * Laravel reports list items as "skills.0"; the form shows them once, on the list itself.
 * Returns a copy of `errors` where each `name.N` message moves to `name` (unless it has its own).
 */
export function collapseItemErrors(errors, names) {
  const result = { ...errors };
  for (const name of names) {
    const itemKey = Object.keys(result).find((key) => key.startsWith(`${name}.`));
    if (itemKey && !result[name]) result[name] = result[itemKey];
    for (const key of Object.keys(result)) if (key.startsWith(`${name}.`)) delete result[key];
  }
  return result;
}

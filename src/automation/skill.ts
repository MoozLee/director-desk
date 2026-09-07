import skill from './builtin-skill.json' with { type: 'json' };

export const BUILTIN_SKILL = skill;
/** The caller only supplies a version whose instructions are still in its context. */
export function readBuiltinSkill(knownVersion?: string) {
    const { name, version, instructions } = skill;
    const unchanged = knownVersion === version;
    return { name, version, unchanged, ...(unchanged ? {} : { instructions }) };
}

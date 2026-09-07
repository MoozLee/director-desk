import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { BUILTIN_SKILL, readBuiltinSkill } from '../src/automation/skill.ts';
import { isDiscussionToolCall } from '../src/automation/contract.ts';

test('bundled skill is fresh and versioned by content rather than the application release', async () => {
    const files = ['skills/director-desk/SKILL.md', 'skills/director-desk/references/online-workflow.md',
        'skills/director-desk/references/project-format.md', 'src/automation/contract.ts', 'src/automation/tool-summaries.ts'];
    const contents = await Promise.all(files.map(file => fs.readFile(file, 'utf8').then(s => s.replace(/\r\n/g, '\n'))));
    assert.equal(BUILTIN_SKILL.version, 'sha256:' + createHash('sha256').update(JSON.stringify(contents)).digest('hex'));
    assert.equal(BUILTIN_SKILL.instructions, contents[1]);
    const first = readBuiltinSkill();
    assert.equal(first.unchanged, false); assert.ok(first.instructions);
    assert.deepEqual(readBuiltinSkill(first.version), { name: first.name, version: first.version, unchanged: true });
    assert.equal(readBuiltinSkill('older-skill').instructions, first.instructions);
    assert.equal(readBuiltinSkill().instructions, first.instructions, 'one caller reading never suppresses another caller');
    assert.equal(isDiscussionToolCall('director_skill', {}), true);
});

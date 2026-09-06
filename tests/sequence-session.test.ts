import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { demoProject } from '../src/model.ts';
import { modelResourceId } from '../src/resources/project-resources.ts';
import { packModelFiles } from '../src/resources/model-package.ts';
import { duplicateDocumentScene, switchDocumentScene } from '../src/scenes/sequence-project.ts';
import { SceneSession } from '../src/scenes/sequence-session.ts';

test('whole-document chronological undo preserves independent scene edits and identifies their owners', () => {
    const session = new SceneSession(demoProject()), initial = session.exportDocument();
    session.editDocument(session.context, '复制第二场', doc => duplicateDocumentScene(doc, 'scene-main', '第二场', 'second'));
    const b = session.begin(); b.project.entities[0].position[0] = 10; session.commit(b, b.project, '第二场站位');
    const afterB = session.exportDocument();
    session.editDocument(session.context, '切换第一场', doc => switchDocumentScene(doc, 'scene-main'));
    const a = session.begin(); a.project.entities[0].position[0] = -10; session.commit(a, a.project, '第一场站位');
    const afterA = session.exportDocument();
    assert.equal(session.project('second').entities[0].position[0], 10);
    assert.equal(session.undoLabel!.sceneId, 'scene-main'); assert.equal(session.undo()!.label, '第一场站位');
    assert.equal(session.project().entities[0].position[0], initial.scenes[0].state.entities[0].position[0]); assert.equal(session.project('second').entities[0].position[0], 10);
    assert.equal(session.undo()!.label, '切换第一场'); assert.deepEqual(session.exportDocument(), afterB); assert.equal(session.context.sceneId, 'second');
    assert.equal(session.undo()!.sceneId, 'second'); assert.equal(session.project('second').entities[0].position[0], initial.scenes[0].state.entities[0].position[0]);
    session.redo(); assert.equal(session.context.sceneId, 'second'); session.redo(); assert.equal(session.context.sceneId, 'scene-main');
    session.redo(); assert.deepEqual(session.exportDocument(), afterA);
    const escaped = session.exportDocument(); escaped.scenes[0].state.entities[0].position[0] = 999; assert.equal(session.project('scene-main').entities[0].position[0], -10);
});

test('pending transactions block navigation/history, failed edits can roll back, and view state stays with its scene', () => {
    const session = new SceneSession(demoProject()), before = session.exportDocument(), context = session.context;
    const selected = session.project().entities[1].id; session.setView({ time: 4, preview: 'program', selected });
    const token = session.begin(); token.project.duration = -1;
    assert.throws(() => session.commit(token), /时长/); assert.equal(session.pending, true);
    assert.throws(() => session.undo(), /完成或取消/); assert.throws(() => session.editDocument(context, '切换', doc => doc), /完成或取消/);
    session.setView({ time: 9, preview: 'program', selected: '' }); session.rollback(token);
    assert.deepEqual(session.exportDocument(), before); assert.deepEqual(session.view(), { time: 4, preview: 'program', selected }); assert.equal(session.pending, false);
    assert.throws(() => session.commit(token), /事务已结束/);
    const noOp = session.begin(); session.commit(noOp); assert.equal(session.context.revision, context.revision); assert.equal(session.undoLabel, null);
    session.editDocument(session.context, '复制', doc => duplicateDocumentScene(doc, 'scene-main', '第二场', 'second'));
    assert.equal(session.view().time, 0); session.setView({ time: 2, preview: 'program', selected: '' });
    session.editDocument(session.context, '回到第一场', doc => switchDocumentScene(doc, 'scene-main'));
    assert.equal(session.view().time, 4); session.undo(); assert.equal(session.context.sceneId, 'second'); assert.deepEqual(session.view(), { time: 2, preview: 'program', selected: '' });
});

test('stale async results, foreign sessions and ended transactions cannot write into the current scene', async () => {
    const session = new SceneSession(demoProject()), context = session.context;
    const proposed = duplicateDocumentScene(session.exportDocument(), 'scene-main', '异步结果', 'async');
    const completedRead = Promise.resolve(proposed);
    session.editDocument(context, '先创建第二场', doc => duplicateDocumentScene(doc, 'scene-main', '第二场', 'second'));
    const current = session.exportDocument();
    assert.throws(() => session.replace(proposed, context, '过期结果'), /REVISION_CONFLICT/);
    await assert.rejects(async () => session.replace(await completedRead, context, '过期异步结果'), /REVISION_CONFLICT/);
    const other = new SceneSession(current); assert.throws(() => session.begin(other.context), /REVISION_CONFLICT/);
    const token = session.begin(); session.rollback(token); assert.throws(() => session.commit(token), /事务已结束/);
    assert.deepEqual(session.exportDocument(), current);
    session.undo(); assert.throws(() => session.begin(context), /REVISION_CONFLICT/, 'Undo must not reuse an old revision');
});

test('explicit edits of an inactive scene preserve the active scene and new edits clear redo history', () => {
    const session = new SceneSession(demoProject());
    session.editDocument(session.context, '复制', doc => duplicateDocumentScene(doc, 'scene-main', '第二场', 'second'));
    const beforeB = session.project('second'), token = session.begin({ ...session.context, sceneId: 'scene-main' });
    token.project.entities[0].position[0] = 5; session.commit(token, token.project, '第一场后台编辑');
    assert.equal(session.context.sceneId, 'second'); assert.deepEqual(session.project('second'), beforeB); assert.equal(session.undoLabel!.sceneId, 'scene-main');
    session.undo(); assert.equal(session.redoLabel!.label, '第一场后台编辑'); assert.equal(session.context.sceneId, 'scene-main');
    const next = session.begin(); next.project.entities[0].position[0] = 7; session.commit(next);
    assert.equal(session.redoLabel, null); assert.equal(session.redo(), null);
});

test('resource retention follows pending edits and both history directions until the bounded history releases them', async () => {
    const bytes = new Uint8Array(await fs.readFile('test-assets/external/kenney-furniture/Models/GLTF format/chair.glb'));
    const data = packModelFiles('chair.glb', [{ path: 'chair.glb', bytes }]), id = await modelResourceId(data);
    const resource = { id, name: '椅子', package: data, source: 'Kenney', copyright: '', license: 'CC0' };
    const session = new SceneSession(demoProject()), draft = session.begin(); draft.project.resources = [resource];
    assert.deepEqual(session.retainedResourceIds(), [id]); session.rollback(draft); assert.deepEqual(session.retainedResourceIds(), []);
    const added = session.begin(); added.project.resources = [resource]; session.commit(added);
    const removed = session.begin(); removed.project.resources = []; session.commit(removed);
    assert.equal(session.exportDocument().resources.length, 0); assert.deepEqual(session.retainedResourceIds(), [id]);
    session.undo(); assert.deepEqual(session.retainedResourceIds(), [id]); session.redo();
    for (let i = 0; i < 36; i++) { const edit = session.begin(); edit.project.duration += 1; session.commit(edit); }
    assert.deepEqual(session.retainedResourceIds(), []);
    let undos = 0; while (session.undo()) undos++; assert.equal(undos, 35);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { demoProject, validateProject } from '../src/model.ts';
import { notesText, productionData, putNote, safeFilename } from '../src/production/notes.ts';
import { blobCrc32, createZip } from '../src/production/zip.ts';
import { productionEntries } from '../src/production/bundle.ts';
import { duplicateDocumentScene, projectForScene, readSceneDocument } from '../src/scenes/sequence-project.ts';
test('production metadata roundtrips without changing legacy projects; bad links and note times rejected', () => {
    const legacy = demoProject(); assert.equal(validateProject(legacy).production, undefined);
    const p = structuredClone(legacy); putNote(p, { id: 'note-1', start: 1, end: 3, actorId: p.entities[0].id, story: '接头', emotion: '警惕', dialogue: '不是说好，一个人来？', action: '抬手' });
    assert.deepEqual(validateProject(p), p); assert.match(notesText(p), /不是说好，一个人来？/);
    const invalid = structuredClone(p); assert.ok(invalid.production); invalid.production.notes[0].actorId = 'missing'; assert.throws(() => validateProject(invalid));
    invalid.production.notes[0].actorId = ''; invalid.production.notes[0].end = 0; assert.throws(() => validateProject(invalid));
    const wrong = structuredClone(p); assert.ok(wrong.production); wrong.production.sceneReferenceIds = ['missing']; assert.throws(() => validateProject(wrong));
    assert.deepEqual(productionData(legacy).notes, []); assert.equal(legacy.production, undefined);
    assert.equal(safeFilename('../CON:*'), '.._CON__'); assert.equal(safeFilename('CON'), '_CON');
    assert.equal(safeFilename('a'.repeat(99) + '.more'), 'a'.repeat(99));
});
test('ZIP uses correct CRC, UTF-8 names, central offsets and cancel semantics', async () => {
    assert.equal(await blobCrc32(new Blob(['123456789'])), 0xcbf43926);
    const files = [{ name: '目录/台词.txt', data: new Blob(['林岚：你好']) }, { name: 'empty.txt', data: new Blob([]) }];
    const zip = new Uint8Array(await (await createZip(files)).arrayBuffer()), view = new DataView(zip.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50); assert.equal(view.getUint16(6, true), 0x800);
    const end = zip.length - 22; assert.equal(view.getUint32(end, true), 0x06054b50); assert.equal(view.getUint16(end + 10, true), 2);
    const central = view.getUint32(end + 16, true); assert.equal(view.getUint32(central, true), 0x02014b50);
    assert.equal(new TextDecoder().decode(zip.slice(30, 30 + view.getUint16(26, true))), files[0].name);
    await assert.rejects(() => createZip([{ name: '../bad', data: new Blob([]) }]));
    for (const name of ['C:/bad', 'file:stream', 'bad\u0000name', 'a\\b'])
        await assert.rejects(() => createZip([{ name, data: new Blob([]) }]));
    await assert.rejects(() => createZip([files[0], files[0]]));
    const a = new AbortController(); a.abort(); await assert.rejects(() => createZip(files, a.signal), { name: 'AbortError' });
});
test('production bundle contains original editable project, references and dialogue exactly once', async () => {
    const p = demoProject(); p.references = [{ id: 'ref-1', name: '角色.png', data: 'data:image/png;base64,aGVsbG8=' }]; p.entities[0].reference = 'ref-1';
    putNote(p, { id: 'note-1', start: 1, end: 7, actorId: p.entities[0].id, story: '', emotion: '', dialogue: '保持完整台词', action: '' });
    const entries = await productionEntries(p); const source = JSON.parse(await entries.find(e => e.name.endsWith('.director'))!.data.text());
    assert.deepEqual(source, p); assert.equal(entries.filter(e => e.name.startsWith('参考图/')).length, 1);
    const text = await entries.find(e => e.name === '剧情与台词.txt')!.data.text(); assert.equal(text.match(/保持完整台词/g)?.length, 1);
    const manifest = JSON.parse(await entries.find(e => e.name === '素材对应关系.json')!.data.text()); assert.equal(manifest.video, null);
    assert.equal(manifest.characters[0].referenceId, 'ref-1');
});

test('multi-scene delivery retains the whole editable document and identifies the active media scene', async () => {
    const document = duplicateDocumentScene(readSceneDocument(demoProject()), 'scene-main', '第二段', 'b');
    const entries = await productionEntries(projectForScene(document), undefined, document);
    assert.deepEqual(JSON.parse(await entries.find(e => e.name.endsWith('.director'))!.data.text()), document);
    const manifest = JSON.parse(await entries.find(e => e.name === '素材对应关系.json')!.data.text());
    assert.equal(manifest.sceneId, 'b'); assert.equal(manifest.sceneName, '第二段'); assert.match(manifest.scope, /全部戏段/);
    assert.match(await entries.find(e => e.name === '使用说明.txt')!.data.text(), /当前戏段/);
});

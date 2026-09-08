const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createFileHost } = require('../desktop/file-host.cjs');

test('separate default directories persist locally; saving confirms actual atomic completion and cancellation', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'director-files-'));
    const defaults = { projects: path.join(root, 'projects'), exports: path.join(root, 'exports') };
    let destination, picked, seenDefault;
    const options = { directory: path.join(root, 'profile'), defaults, chooseDirectory: async () => picked,
        chooseSave: async defaultPath => { seenDefault = defaultPath; return destination; } };
    try {
        const host = createFileHost(options); await host.ready;
        assert.equal(host.defaultPath('film.mp4'), path.join(defaults.exports, 'film.mp4'));
        assert.equal(host.defaultPath('scene.director'), path.join(defaults.projects, 'scene.director'));
        assert.equal(host.defaultPath('../../scene.director'), path.join(defaults.projects, 'scene.director'));
        const content = JSON.stringify({ format: 'director-desk', version: 3, name: 'test' });
        assert.deepEqual(await host.saveProject({ name: 'scene', content }), { saved: false });
        assert.equal(seenDefault, path.join(defaults.projects, 'scene.director'));
        destination = path.join(defaults.projects, 'scene.director');
        await fs.writeFile(destination, 'old content');
        assert.deepEqual(await host.saveProject({ name: 'scene', content }), { saved: true });
        assert.equal(await fs.readFile(destination, 'utf8'), content);
        assert.deepEqual(await fs.readdir(defaults.projects), ['scene.director']);
        const old = await fs.readFile(destination, 'utf8'); destination = defaults.projects + '.txt';
        await assert.rejects(host.saveProject({ name: 'scene', content }), /director/);
        assert.equal(await fs.readFile(path.join(defaults.projects, 'scene.director'), 'utf8'), old);
        destination = path.join(root, 'missing-parent', 'scene.director');
        await assert.rejects(host.saveProject({ name: 'scene', content }));
        picked = path.join(root, 'chosen'); await fs.mkdir(picked);
        await host.choose('projects');
        const reopened = createFileHost(options); await reopened.ready;
        assert.equal(reopened.read().projects, picked); assert.equal(reopened.read().exports, defaults.exports);
        await assert.rejects(host.choose('other'), /未知/);
        picked = null; assert.deepEqual(await host.choose('exports'), reopened.read());
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

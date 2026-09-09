import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';
import { createHash } from 'node:crypto';
import { createUpdateFixtureServer } from '../tests/fixtures/update-download-server.mjs';
const directory = await fs.mkdtemp(path.resolve('tmp/update-desktop-'));
const version = JSON.parse(await fs.readFile('package.json', 'utf8')).version;
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const payload = Buffer.from('Synthetic update bytes; never executed'), installer = 'DirectorDesk-Setup-99.0.0.exe';
await fs.writeFile(path.join(directory, installer), payload);
const writeMetadata = async checksum => fs.writeFile(path.join(directory, 'latest.yml'), `version: 99.0.0\nfiles:\n  - url: ${installer}\n    sha512: ${checksum}\n    size: ${payload.length}\npath: ${installer}\nsha512: ${checksum}\n`);
const digest = createHash('sha512').update(payload).digest('base64'); await writeMetadata(digest);
await fs.writeFile(path.join(directory, 'app-update.yml'), 'updaterCacheDirName: isolated-update-test\n');
const server = createUpdateFixtureServer(directory, installer); await new Promise(r => server.listen(0, '127.0.0.1', r));
const updateURL = `http://127.0.0.1:${server.address().port}/updates/win-x64/`;
const app = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [path.resolve('.audit/desktop-app'), `--director-test-profile=${directory}`], env });
try {
    const page = await app.firstWindow(); await page.waitForSelector('#update-toggle');
    await page.locator('#update-toggle').click(); await page.waitForFunction(version => document.querySelector('#update-version').textContent.includes(version), version);
    await page.locator('#update-check').click(); await page.waitForFunction(() => document.querySelector('#update-message').value.includes('开发预览'));
    assert.equal(await page.locator('#update-install').isDisabled(), true); assert.equal(await page.locator('#update-download').isDisabled(), true);
    await page.locator('#update-panel summary').click();
    assert.equal(await page.locator('#update-source').inputValue(), 'auto');
    await page.locator('#update-source').selectOption('github');
    await page.locator('#update-auto').uncheck(); await page.locator('#update-save').click();
    await page.waitForFunction(() => document.querySelector('#update-message').value.includes('已保存'));
    const result = await page.evaluate(() => window.directorDesktop.update('state')); assert.equal(result.data.config.automatic, false); assert.equal(result.data.config.source, 'github');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 720));
    const overflow = await page.locator('#update-panel').evaluate(p => {
        const b = p.getBoundingClientRect(); return { panel: p.scrollHeight > p.clientHeight + 1, controls: [...p.querySelectorAll('button,input,textarea,select')].filter(e => e.getClientRects().length).some(e => { const r = e.getBoundingClientRect(); return r.bottom > b.bottom || r.right > b.right; }) };
    }); assert.deepEqual(overflow, { panel: false, controls: false });
    await page.screenshot({ path: 'tmp/update-desktop.png' }); await page.reload(); await page.waitForSelector('#update-toggle');
    const again = await page.evaluate(() => window.directorDesktop.update('state')); assert.equal(again.data.config.automatic, false); assert.equal(again.data.config.source, 'github');
    const download = async cache => app.evaluate(async (_electron, { repo, directory, url, cache }) => {
        const req = process.getBuiltinModule('module').createRequire(repo + '/package.json');
        const { NsisUpdater } = req('electron-updater/out/NsisUpdater');
        const u = new NsisUpdater(); u.forceDevUpdateConfig = true; u.updateConfigPath = directory + '/app-update.yml';
        Object.defineProperty(u.app, 'baseCachePath', { value: directory + '/' + cache });
        const events = []; u.on('error', () => events.push('error')); u.on('update-downloaded', () => events.push('downloaded'));
        u.doInstall = () => { throw Error('Tests must never execute an installer'); };
        const host = req('./desktop/update-host.cjs').createUpdateHost({ version: '0.0.1', mode: 'installed',
            config: { ready: Promise.resolve(), read: () => ({ source: 'github' }), page: () => url },
            getGithubRelease: async () => ({ version: '99.0.0', notes: 'QA', page: url, feed: { provider: 'generic', url } }),
            makeUpdater: feed => { u.setFeedURL(feed); return u; }, send() {}, confirmInstall: async () => false,
            install() { throw Error('Tests must never install'); }, openPage() {},
        });
        await host.check(); await host.download(); return { events, downloaded: host.read().phase === 'downloaded' };
    }, { repo: process.cwd(), directory, url: updateURL, cache });
    const valid = await download('valid'); assert.equal(valid.downloaded, true); assert.ok(valid.events.includes('downloaded'));
    await writeMetadata(createHash('sha512').update('corrupt').digest('base64'));
    const invalid = await download('invalid'); assert.equal(invalid.downloaded, false); assert.equal(invalid.events.includes('downloaded'), false);
    console.log('Desktop update IPC, settings persistence, dev guard and small-window layout passed.');
    console.log('Real Electron updater HTTP download and SHA512 corruption rejection passed; installer execution disabled.');
} finally { await app.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }

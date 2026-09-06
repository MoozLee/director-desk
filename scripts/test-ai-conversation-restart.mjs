import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright-core';

await fs.mkdir('tmp', { recursive: true });
const directory = await fs.mkdtemp(path.resolve('tmp/ai-restart-test-'));
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const server = http.createServer((req, res) => { req.resume(); res.writeHead(503); res.end('Local restart test failure'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let application;
async function launch() {
    application = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [path.resolve('.audit/desktop-app'), `--director-test-profile=${directory}`], env });
    const page = await application.firstWindow(); await page.waitForSelector('#ai-toggle');
    await page.waitForFunction(() => Boolean(window.directorDesktop));
    return page;
}
async function close() {
    if (!application) return;
    await application.evaluate(({ app, BrowserWindow }) => { app.removeAllListeners('window-all-closed'); BrowserWindow.getAllWindows().forEach(w => w.destroy()); }).catch(() => {});
    await application.close(); application = undefined;
}
try {
    let page = await launch();
    const configured = await page.evaluate(baseUrl => window.directorDesktop.configure({ name: '重启检查', protocol: 'chat', baseUrl, model: 'mock', maxTokens: 1000, maxRounds: 1, stream: false }), `http://127.0.0.1:${server.address().port}/v1`);
    assert.equal(configured.ok, true);
    const task = await page.evaluate(profileId => window.directorDesktop.run({ profileId, prompt: '重启以后继续保持蓝衣主角', mode: 'execute' }), configured.data[0].id);
    assert.equal(task.ok, true); assert.equal(task.data.stopped, true);
    const previous = (await page.evaluate(() => window.directorDesktop.conversation())).data;
    assert.match(previous.transcript, /蓝衣主角/); assert.match(previous.transcript, /对话已保留/);
    const disk = await fs.readFile(path.join(directory, 'ai-conversation.json'), 'utf8');
    assert.equal(JSON.parse(disk).encrypted, true, 'Windows conversation is encrypted with actual Electron safeStorage');
    assert.ok(!disk.includes('蓝衣主角'));
    await close();
    page = await launch();
    await page.waitForFunction(() => document.querySelector('#ai-transcript').value.includes('蓝衣主角'));
    assert.deepEqual((await page.evaluate(() => window.directorDesktop.conversation())).data, previous);
    await page.locator('#ai-toggle').click(); await page.locator('#ai-new').click();
    await page.waitForFunction(() => document.querySelector('#ai-status').textContent.includes('手动开始新对话'));
    const cleared = (await page.evaluate(() => window.directorDesktop.conversation())).data;
    assert.notEqual(cleared.sessionId, previous.sessionId); assert.equal(cleared.transcript, '');
    console.log('Conversation survives actual Electron process restart with Windows encryption; only manual New Conversation resets it. External requests: 0.');
} finally { await close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

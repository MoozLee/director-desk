const { ipcMain, app, safeStorage, clipboard } = require('electron');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createAIHost } = require('./ai-host.cjs');
const { startMcp } = require('./mcp-server.cjs');
const { TOOL_DEFINITIONS, MCP_TOOL_DEFINITIONS, DISCUSSION_TOOLS, isDiscussionToolCall } = require('./tools-contract.cjs');
function attachIntegration(window) {
    const pending = new Map(); let ready = false, mcp = null, mcpQueue = Promise.resolve();
    const trusted = event => event.sender === window.webContents && event.senderFrame?.url === 'director://app/';
    const callTool = (name, args) => new Promise(resolve => {
        if (!ready || window.isDestroyed()) return resolve({ ok: false, error: '导演台尚未连接或正在重新载入' });
        const id = randomUUID(), timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, execution: 'unknown', error: '工具响应超时，请先查询状态，不要直接重复写入' }); }, 60000);
        pending.set(id, { resolve, timer }); window.webContents.send('director-tool-call', { id, name, args });
    });
    const host = createAIHost({ directory: app.getPath('userData'), safeStorage, definitions: TOOL_DEFINITIONS, discussionTools: DISCUSSION_TOOLS, isDiscussionToolCall, callTool,
        workflow: fs.readFileSync(path.join(app.getAppPath(), 'skills/director-desk/references/online-workflow.md'), 'utf8'),
        send: data => { if (!window.isDestroyed()) window.webContents.send('director-ai-event', data); } });
    const resultHandler = (event, data) => { if (!trusted(event) || !data || !pending.has(data.id)) return; const item = pending.get(data.id); clearTimeout(item.timer); pending.delete(data.id); item.resolve(data.result); };
    const readyHandler = event => { if (trusted(event)) ready = true; };
    ipcMain.on('director-tool-result', resultHandler); ipcMain.on('director-tools-ready', readyHandler);
    ipcMain.handle('director-host', async (event, input) => {
        if (!trusted(event)) throw new Error('拒绝未知页面');
        try {
            const { action, data } = input || {}; let result;
            if (action === 'profiles') result = await host.list();
            else if (action === 'conversation') result = await host.conversation();
            else if (action === 'new-conversation') result = await host.newConversation();
            else if (action === 'configure') result = await host.configure(data);
            else if (action === 'run') result = await host.run(data);
            else if (action === 'stop') { host.stop(); result = true; }
            else if (action === 'test') result = await host.test(data);
            else if (action === 'mcp') {
                const change = mcpQueue.then(async () => {
                    if (data === true && !mcp && !window.isDestroyed()) mcp = await startMcp(MCP_TOOL_DEFINITIONS, callTool, app.getVersion());
                    if ((data === false || window.isDestroyed()) && mcp) { await mcp.close(); mcp = null; }
                }); mcpQueue = change.catch(() => {}); await change;
                result = { enabled: Boolean(mcp), url: mcp?.url };
            } else if (action === 'copy-mcp') {
                if (!mcp) throw new Error('请先开启 MCP');
                clipboard.writeText(JSON.stringify({ mcpServers: { 'director-desk': { url: mcp.url, headers: { Authorization: 'Bearer ' + mcp.token } } } }, null, 2)); result = true;
            } else throw new Error('未知桌面操作');
            return { ok: true, data: result };
        } catch (e) { return { ok: false, error: e.message }; }
    });
    window.webContents.on('did-start-loading', () => { ready = false; host.stop(); for (const task of pending.values()) { clearTimeout(task.timer); task.resolve({ ok: false, execution: 'unknown', error: '页面重新载入，调用结果未确认；请重新读取工程，不要直接重复写入' }); } pending.clear(); });
    window.on('closed', () => { host.stop(); void mcp?.close(); for (const task of pending.values()) { clearTimeout(task.timer); task.resolve({ ok: false, execution: 'unknown', error: '软件已关闭，调用结果未确认；请重新读取工程，不要直接重复写入' }); }
        ipcMain.removeHandler('director-host'); ipcMain.removeListener('director-tool-result', resultHandler); ipcMain.removeListener('director-tools-ready', readyHandler); });
}
module.exports = { attachIntegration };

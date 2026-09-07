const { contextBridge, ipcRenderer } = require('electron');
const invoke = (action, data) => ipcRenderer.invoke('director-host', { action, data });
contextBridge.exposeInMainWorld('directorDesktop', {
    update: (action, data) => ipcRenderer.invoke('director-updates', { action, data }),
    onUpdate: callback => { const fn = (_event, data) => callback(data); ipcRenderer.on('director-update-state', fn); return () => ipcRenderer.removeListener('director-update-state', fn); },
    profiles: () => invoke('profiles'), configure: data => invoke('configure', data), test: id => invoke('test', id),
    conversation: () => invoke('conversation'), newConversation: () => invoke('new-conversation'),
    run: data => invoke('run', data), stop: () => invoke('stop'), mcp: enabled => invoke('mcp', enabled), copyMcp: () => invoke('copy-mcp'),
    resetMcp: () => invoke('reset-mcp'),
    onEvent: callback => { const fn = (_event, data) => callback(data); ipcRenderer.on('director-ai-event', fn); return () => ipcRenderer.removeListener('director-ai-event', fn); },
    onTool: callback => { const fn = async (_event, data) => { let result; try { result = await callback(data.name, data.args); } catch { result = { ok: false, error: '工具执行失败' }; } ipcRenderer.send('director-tool-result', { id: data.id, result }); };
        ipcRenderer.on('director-tool-call', fn); ipcRenderer.send('director-tools-ready'); return () => ipcRenderer.removeListener('director-tool-call', fn); },
});

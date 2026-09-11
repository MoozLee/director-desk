const CLIENTS = new Set(['http', 'claude-code', 'claude-desktop', 'stdio']);
function mcpConnection({ url, token }, client = 'http', runtime) {
    if (!CLIENTS.has(client)) throw Error('未知 MCP 客户端类型');
    let entry;
    if (client === 'stdio' || client === 'claude-desktop') {
        if (!runtime?.command || !runtime?.bridgePath) throw Error('本地桥接程序尚未就绪');
        entry = { command: runtime.command, args: [runtime.bridgePath], env: {
            ELECTRON_RUN_AS_NODE: '1', DIRECTOR_MCP_URL: url, DIRECTOR_MCP_TOKEN: token,
        } };
    } else {
        entry = { ...(client === 'claude-code' ? { type: 'http' } : {}), url, headers: { Authorization: 'Bearer ' + token } };
    }
    return { mcpServers: { 'director-desk': entry } };
}
module.exports = { mcpConnection };

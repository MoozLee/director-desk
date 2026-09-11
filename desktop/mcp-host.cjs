const { createMcpConfig, newToken } = require('./mcp-config.cjs');
const { startMcp } = require('./mcp-server.cjs');
const { mcpConnection } = require('./mcp-connection.cjs');
function createMcpHost({ directory, safeStorage, definitions, call, version, bridgeRuntime }) {
    const config = createMcpConfig(directory, safeStorage);
    let server = null, queue = Promise.resolve(), disposed = false;
    const serial = action => { const next = queue.then(action); queue = next.catch(() => {}); return next; };
    const state = () => ({ enabled: Boolean(server), url: server?.url });
    return {
        change(enabled) { return serial(async () => {
            if (disposed) throw Error('软件已关闭');
            if (enabled === true && !server) {
                const saved = config.read(), token = saved?.token || newToken();
                const next = await startMcp(definitions, call, version, { port: saved?.port ?? 0, token });
                try { if (!saved) config.save({ port: next.port, token }); }
                catch (e) { await next.close(); throw e; }
                server = next;
            }
            if (enabled === false && server) { await server.close(); server = null; }
            return state();
        }); },
        reset() { return serial(() => {
            if (disposed || !server) throw Error('请先开启 MCP');
            const token = newToken();
            config.save({ port: server.port, token });
            server.setToken(token);
            return state();
        }); },
        connection(client) { return serial(() => {
            if (disposed || !server) throw Error('请先开启 MCP');
            return mcpConnection(server, client, bridgeRuntime);
        }); },
        close() { disposed = true; return serial(async () => { if (server) { await server.close(); server = null; } }); },
    };
}
module.exports = { createMcpHost };

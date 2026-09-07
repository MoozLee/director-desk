const fs = require('node:fs/promises');
const path = require('node:path');
const UPDATE_URL = 'https://bigthat.me/updates/win-x64/';
function validateConfig(input) {
    if (!input || typeof input.automatic !== 'boolean' || typeof input.url !== 'string') throw Error('更新设置无效');
    let url; try { url = new URL(input.url.trim()); } catch { throw Error('请填写 HTTPS 更新目录地址'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('更新地址必须为不含凭据或查询参数的 HTTPS 目录');
    return { url: url.href.replace(/\/?$/, '/'), automatic: input.automatic };
}
function createUpdateConfig(directory) {
    const file = path.join(directory, 'updates.json'); let config = { url: UPDATE_URL, automatic: true };
    const ready = (async () => {
        try { config = validateConfig(JSON.parse(await fs.readFile(file, 'utf8'))); }
        catch (error) { if (error.code !== 'ENOENT') throw Error('无法读取本机更新设置，请重新保存'); }
    })(); ready.catch(() => {});
    return { ready, read: () => ({ ...config }), feed: () => ({ provider: 'generic', url: config.url }), page: () => new URL('/', config.url).href,
        async save(input) {
            await ready.catch(() => {}); const next = validateConfig(input); await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(file + '.tmp', JSON.stringify(next), { mode: 0o600 }); await fs.rename(file + '.tmp', file); config = next; return { ...config };
        } };
}
module.exports = { createUpdateConfig, validateConfig, UPDATE_URL };

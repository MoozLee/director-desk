/** Owns update state; Electron transport and local credentials are separate adapters. */
function createUpdateHost({ version, mode, config, makeUpdater, send, confirmInstall, install, openPage }) {
    let updater, flight = null, installing = false;
    let state = { currentVersion: version, mode, phase: 'idle', version: '', notes: '', percent: 0, message: '尚未检查更新', checkedAt: '' };
    const read = () => ({ ...state, config: config.read() });
    const publish = patch => { state = { ...state, ...patch }; send(read()); };
    const fail = error => { // Provider errors may contain Authorization headers, local paths, or signed asset URLs.
        installing = false;
        const detail = String(error?.code || '') + ' ' + String(error?.message || '');
        const message = /401|403|404/.test(detail) ? '更新来源暂不可用，请确认服务器已发布更新文件。'
            : /sha512|checksum|signature/i.test(detail) ? '更新包校验失败，未安装。请重新下载或联系发布者。'
            : '更新请求失败，请检查网络及更新来源后重试。';
        publish({ phase: 'error', message, percent: 0 });
    };
    async function exclusive(fn) {
        if (flight || installing) throw Error('更新操作正在进行，请稍候');
        const task = Promise.resolve().then(fn); flight = task;
        try { await task; return read(); } finally { flight = null; }
    }
    function setup() {
        updater?.removeAllListeners(); updater = makeUpdater(config.feed());
        updater.autoDownload = false; updater.autoInstallOnAppQuit = false; updater.allowDowngrade = false; updater.allowPrerelease = false;
        updater.disableDifferentialDownload = true; updater.disableWebInstaller = true;
        updater.logger = { info() {}, warn() {}, error() {}, debug() {} };
        updater.on('checking-for-update', () => publish({ phase: 'checking', message: '正在检查更新…' }));
        updater.on('update-available', info => {
            const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : Array.isArray(info.releaseNotes) ? info.releaseNotes.map(n => n.note || '').join('\n') : '';
            publish({ phase: 'available', version: info.version, notes, message: `发现新版本 ${info.version}`, checkedAt: new Date().toISOString() });
        });
        updater.on('update-not-available', () => publish({ phase: 'current', message: '当前已是最新版本', checkedAt: new Date().toISOString() }));
        updater.on('download-progress', progress => publish({ phase: 'downloading', percent: Math.max(0, Math.min(100, progress.percent)), message: '正在下载更新…' }));
        updater.on('update-downloaded', () => publish({ phase: 'downloaded', percent: 100, message: '更新已下载并通过校验，可重启安装' }));
        updater.on('error', fail);
    }
    return { read, async initialize() { try { await config.ready; publish({}); } catch { publish({ phase: 'error', message: '本机更新配置无法读取，请重新保存设置' }); } },
        save: input => exclusive(async () => { await config.save(input); updater?.removeAllListeners(); updater = null; publish({ phase: 'idle', version: '', notes: '', percent: 0, message: '更新来源已保存' }); }),
        check: () => exclusive(async () => {
            if (mode === 'development') { publish({ phase: 'idle', message: '开发预览不执行远程更新；请在打包后的软件中检查' }); return; }
            if (state.phase === 'downloaded') return;
            await config.ready.catch(() => {});
            publish({ version: '', notes: '', percent: 0 });
            try { setup(); await updater.checkForUpdates(); } catch (e) { fail(e); }
        }),
        download: () => exclusive(async () => {
            if (mode !== 'installed' || state.phase !== 'available' || !updater) throw Error('请先在安装版中检查到可用更新');
            publish({ phase: 'downloading', percent: 0, message: '正在下载更新…' });
            try { await updater.downloadUpdate(); } catch (e) { fail(e); }
        }),
        install: () => exclusive(async () => {
            if (mode !== 'installed' || state.phase !== 'downloaded' || !updater) throw Error('更新尚未下载并校验完成');
            if (!await confirmInstall()) return;
            installing = true; publish({ phase: 'installing', message: '正在重启安装…' });
            try { install(updater); } catch (e) { fail(e); }
            if (state.phase === 'error') installing = false;
        }),
        openPage: () => openPage(config.page()),
        dispose() { updater?.removeAllListeners(); },
    };
}
module.exports = { createUpdateHost };

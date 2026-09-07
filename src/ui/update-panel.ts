import type { UpdateState } from '../updates/types.ts';
import './update-panel.css';
export function mountUpdates(prepareInstall: (run: () => Promise<void>) => Promise<void>) {
    const bridge = window.directorDesktop; if (!bridge) return;
    const button = document.createElement('button'); button.id = 'update-toggle'; button.className = 'subtle'; button.textContent = '更新';
    document.querySelector('.header-actions')!.prepend(button);
    const dialog = document.createElement('dialog'); dialog.id = 'update-panel'; dialog.setAttribute('aria-label', '软件更新');
    dialog.innerHTML = `<header><strong>软件更新</strong><button id="update-close" aria-label="关闭更新窗口">×</button></header><p id="update-version"></p><textarea id="update-message" readonly aria-label="更新状态"></textarea><progress id="update-progress" max="100" value="0"></progress><textarea id="update-notes" readonly aria-label="版本说明" placeholder="发现新版本后显示更新说明"></textarea><div class="update-actions"><button id="update-check">检查更新</button><button id="update-download">下载更新</button><button id="update-install">重启安装</button></div><button id="update-page">打开下载页</button><details><summary>更新设置</summary><label>更新目录<input id="update-url" type="url"/></label><label class="update-auto"><input id="update-auto" type="checkbox"/>启动后自动检查（不自动下载或安装）</label><button id="update-save">保存设置</button></details><p id="update-mode"></p>`;
    document.body.append(dialog);
    const find = <T extends HTMLElement>(id: string) => dialog.querySelector<T>('#update-' + id)!;
    let state: UpdateState | undefined, working = false;
    const render = (next: UpdateState, fields = false) => {
        state = next;
        find('version').textContent = `当前 ${next.currentVersion}${next.version ? '  →  ' + next.version : ''}`;
        find<HTMLTextAreaElement>('message').value = next.message; find<HTMLTextAreaElement>('notes').value = next.notes;
        find<HTMLProgressElement>('progress').value = next.percent;
        button.textContent = ['available', 'downloaded'].includes(next.phase) ? '更新 · 新版本' : '更新';
        const busy = working || ['checking', 'downloading', 'installing'].includes(next.phase);
        find<HTMLButtonElement>('check').disabled = busy || next.phase === 'downloaded'; find<HTMLButtonElement>('save').disabled = busy;
        find<HTMLButtonElement>('download').disabled = busy || next.phase !== 'available' || next.mode !== 'installed';
        find<HTMLButtonElement>('install').disabled = busy || next.phase !== 'downloaded';
        find('mode').textContent = next.mode === 'portable' ? '免安装版：从下载页获取新版压缩包，解压到新目录后运行。本机工程恢复、对话和渠道配置保留。'
            : next.mode === 'development' ? '开发预览不执行更新；远程更新用于打包后的桌面软件。' : '下载完成后由你决定重启时间。安装前保存当前工程的本机恢复副本。';
        if (fields) { find<HTMLInputElement>('url').value = next.config.url; find<HTMLInputElement>('auto').checked = next.config.automatic; }
    };
    const request = async (action: Parameters<typeof bridge.update>[0], data?: unknown) => {
        const result = await bridge.update(action, data); if (!result.ok || !result.data) throw Error(result.error || '更新请求失败'); render(result.data, action === 'save' || action === 'state');
    };
    const run = async (action: () => Promise<void>) => {
        if (working) return; working = true; if (state) render(state);
        try { await action(); } catch (e) { find<HTMLTextAreaElement>('message').value = e instanceof Error ? e.message : '更新操作失败'; }
        finally { working = false; if (state) { const message = find<HTMLTextAreaElement>('message').value; render(state); find<HTMLTextAreaElement>('message').value = message; } }
    };
    button.onclick = () => { dialog.showModal(); void run(() => request('state')); };
    find('close').onclick = () => dialog.close();
    for (const action of ['check', 'download', 'page'] as const) find(action).onclick = () => { void run(() => request(action)); };
    find('save').onclick = () => { void run(() => request('save', { url: find<HTMLInputElement>('url').value, automatic: find<HTMLInputElement>('auto').checked })); };
    find('install').onclick = () => { void run(() => prepareInstall(() => request('install'))); };
    bridge.onUpdate(next => render(next)); void run(() => request('state'));
}

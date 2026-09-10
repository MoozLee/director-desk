import { addPageBack } from './modal-pages.ts';
import type { AppContext } from '../app-context.ts';
import { icon } from './common.ts';
import './settings-panel.css';

export function mountSettings(ctx:AppContext) {
    const trigger=document.createElement('button');trigger.id='settings-toggle';trigger.className='icon-button subtle';trigger.title='设置';trigger.setAttribute('aria-label','设置');trigger.innerHTML=icon('settings');
    document.querySelector('.header-actions')!.prepend(trigger);
    const locations=document.querySelector<HTMLButtonElement>('#file-locations-open');if(locations)locations.hidden=true;
    trigger.onclick=()=>{
        if(ctx.busy || ctx.history.pending || ctx.draft)return;
        ctx.showModal('设置',`<div class="settings-grid">
            <section><h3>工作区</h3><p>面板边界可拖动调整，布局自动保存在本机。</p><button data-setting="layout">恢复默认布局</button><button data-setting="help">操作与快捷键</button></section>
            <section><h3>文件与保存</h3><p>设置新工程、视频和素材包的默认保存位置。</p><button data-setting="files" ${locations?'':'disabled'}>文件位置</button>${locations?'':'<p>浏览器版在下载或保存时选择位置。</p>'}</section>
            <section><h3>AI 与扩展</h3><p>管理模型渠道、技能和 MCP 连接。</p><button data-setting="ai">AI 设置</button></section>
            <section><h3>软件更新</h3><p>启动后检查新版；发现更新时提示，下载和安装由你决定。</p><button data-setting="updates" ${window.directorDesktop?'':'disabled'}>更新与来源设置</button></section>
        </div>`, '<button data-act="close-modal">完成</button>');
        document.querySelector('.settings-grid')!.addEventListener('click',event=>{
            const action=(event.target as HTMLElement).closest<HTMLElement>('[data-setting]')?.dataset.setting;if(!action)return;
            if(['ai','updates'].includes(action))ctx.closeModal();
            if(action==='layout')document.querySelector<HTMLButtonElement>('#reset-layout')!.click();
            if(action==='files')locations?.click();
            if(action==='updates'){document.querySelector<HTMLButtonElement>('#update-toggle')?.click();const dialog=document.querySelector<HTMLDialogElement>('#update-panel');if(dialog)addPageBack(dialog,'返回设置',()=>{dialog.close();trigger.click();});}
            if(action==='help')ctx.helpDialog();
            if(action==='ai'){const panel=document.querySelector<HTMLElement>('#ai-panel');if(panel?.hidden)document.querySelector<HTMLButtonElement>('#ai-toggle')?.click();document.querySelector<HTMLButtonElement>('#ai-settings-toggle')?.click();if(panel)addPageBack(panel,'返回设置',()=>{document.querySelector<HTMLButtonElement>('#ai-close')?.click();trigger.click();});}
        });
    };
}

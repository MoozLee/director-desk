import { createAssetBrowser } from './asset-browser.ts';
import { bindSidebarTools } from './sidebar-tools.ts';
import { $ } from './common.ts';
import type { AppContext } from '../app-context.ts';
import { createSceneObjectBrowser } from './scene-object-browser.ts';
import { createReferenceBrowser } from './reference-browser.ts';
export function createSidebar(ctx: AppContext) {
    const objects = createSceneObjectBrowser(ctx, renderSidebar);
    const references = createReferenceBrowser(ctx, renderSidebar);
    bindSidebarTools();
    const browser = createAssetBrowser(ctx);
    function renderSidebar() {
        document.querySelectorAll('[data-side]').forEach(el => el.classList.toggle('active', (el as HTMLElement).dataset.side === ctx.sidebarTab));
        const content = $('#sidebar-content');
        content.classList.toggle('asset-mode', ctx.sidebarTab === 'assets');
        content.classList.toggle('object-mode', ctx.sidebarTab === 'scene');
        content.classList.toggle('reference-mode', ctx.sidebarTab === 'refs');
        if (ctx.sidebarTab !== 'assets') browser.leave();
        if (ctx.sidebarTab === 'assets') browser.render(content);
        else if (ctx.sidebarTab === 'refs') content.innerHTML = references.render();
        else content.innerHTML = objects.render();
    }
    return { renderSidebar };
}

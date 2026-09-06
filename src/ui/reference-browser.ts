import type { AppContext } from '../app-context.ts';
import { button, escape, options } from './common.ts';

export function createReferenceBrowser(ctx: AppContext, refresh: () => void) {
    let selected = '';
    document.querySelector('#sidebar-content')!.addEventListener('change', event => {
        const input = event.target as HTMLSelectElement;
        if (input.id !== 'reference-choice') return;
        event.stopPropagation(); selected = input.value; refresh();
    });
    return { render() {
        const references = ctx.project.references.filter(r => r.name.toLowerCase().includes(ctx.query.toLowerCase()));
        if (!references.some(r => r.id === selected)) selected = references[0]?.id ?? '';
        const ref = references.find(r => r.id === selected);
        return `<div class="reference-browser">${button('add-reference', '添加参考图片', 'plus', 'wide subtle')}`
            + (ref ? `<select id="reference-choice" aria-label="选择参考图">${options(references.map((r, i) => [r.id, `${i + 1} / ${references.length} · ${r.name}`]), selected)}</select><div class="reference-preview"><img src="${ref.data}" alt="${escape(ref.name)}"/></div><div class="reference-actions">${button('assign-reference', '关联选中对象', '', 'subtle', `data-id="${ref.id}"`)}${button('delete-reference', '', 'trash', 'icon-button', `data-id="${ref.id}" aria-label="删除参考图"`)}</div>` : '<div class="empty-state">添加项目的人设或场景图<br><small>支持 PNG、JPEG、WebP</small></div>') + '</div>';
    } };
}

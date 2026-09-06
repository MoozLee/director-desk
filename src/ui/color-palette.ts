import type { AppContext } from '../app-context.ts';
import { normalizedColor, setEntityColor } from '../editor/entity-color.ts';
import { $, button, escape, options } from './common.ts';
import './color-palette.css';

const swatches = [
    ['雪白', '#ffffff'], ['浅灰', '#d5d5d0'], ['灰色', '#929292'], ['深灰', '#505050'], ['墨黑', '#202020'], ['暖白', '#eee5d5'],
    ['浅红', '#f3adad'], ['红色', '#d95656'], ['暗红', '#853b43'], ['浅橙', '#f6ceab'], ['橙色', '#e99c51'], ['棕色', '#8e6249'],
    ['浅黄', '#f4e8a2'], ['黄色', '#e6c755'], ['橄榄', '#99964c'], ['浅绿', '#b8dba6'], ['绿色', '#78ae78'], ['深绿', '#3e705b'],
    ['浅青', '#a5ded7'], ['青色', '#57aaa3'], ['深青', '#386e7e'], ['浅蓝', '#b2cee9'], ['蓝色', '#78a6d4'], ['深蓝', '#465c91'],
    ['浅紫', '#d4c1e7'], ['紫色', '#9b7fbd'], ['深紫', '#695180'], ['浅粉', '#ecc6d8'], ['粉色', '#ca89ae'], ['玫红', '#995573'],
];

export function createColorPalette(ctx: AppContext) {
    function open() {
        const entity = ctx.current(); if (!entity || entity.locked) return;
        const targetId = entity.id, scene = ctx.scenes.context, before = JSON.stringify(entity);
        let color = entity.color, appearance = entity.external?.appearance ?? 'color';
        ctx.showModal('模型调色', `<div class="color-palette"><p class="color-target">${escape(entity.name)}</p>
            <div class="color-swatches" role="group" aria-label="常用色板">${swatches.map(([name, value]) => `<button type="button" data-swatch="${value}" style="--swatch:${value}" aria-label="${name} ${value}" title="${name}" aria-pressed="false"></button>`).join('')}</div>
            <div class="color-custom"><label class="field"><span>自定义颜色</span><input id="palette-picker" type="color" value="${color}"/></label><label class="field"><span>HEX 色值</span><input id="palette-hex" type="text" value="${color}" maxlength="7" spellcheck="false" autocomplete="off"/></label></div>
            ${entity.external ? `<label class="field"><span>模型材质</span><select id="palette-appearance">${options([['color', '统一着色'], ['original', '原材质'], ['white', '白模']], appearance)}</select></label>` : ''}
            <p class="color-feedback" id="palette-feedback" aria-live="polite">选择颜色后点击应用。</p></div>`, button('close-modal', '取消', '', 'subtle') + '<button id="palette-apply" class="primary">应用颜色</button>');
        $('.modal').classList.add('color-modal');
        const picker = $<HTMLInputElement>('#palette-picker'), hex = $<HTMLInputElement>('#palette-hex'), apply = $<HTMLButtonElement>('#palette-apply');
        const mode = document.querySelector<HTMLSelectElement>('#palette-appearance');
        const feedback = $('#palette-feedback');
        function refresh() {
            document.querySelectorAll<HTMLButtonElement>('[data-swatch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.swatch === color)));
            picker.value = color; hex.value = color;
            if (mode) mode.value = appearance;
            feedback.textContent = '点击应用后生效，可撤销。'; apply.disabled = false; hex.removeAttribute('aria-invalid');
        }
        function choose(value: string) {
            try { color = normalizedColor(value); appearance = 'color'; refresh(); }
            catch (error) { feedback.textContent = (error as Error).message; hex.setAttribute('aria-invalid', 'true'); apply.disabled = true; }
        }
        $('.color-swatches').addEventListener('click', event => {
            const value = (event.target as HTMLElement).closest<HTMLElement>('[data-swatch]')?.dataset.swatch;
            if (value) choose(value);
        });
        picker.addEventListener('input', () => choose(picker.value));
        hex.addEventListener('input', () => {
            try { color = normalizedColor(hex.value); appearance = 'color'; picker.value = color; if (mode) mode.value = appearance; apply.disabled = false; hex.removeAttribute('aria-invalid'); feedback.textContent = '点击应用后生效，可撤销。';
                document.querySelectorAll<HTMLButtonElement>('[data-swatch]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.swatch === color)));
            } catch { apply.disabled = true; hex.setAttribute('aria-invalid', 'true'); feedback.textContent = '请输入 3 位或 6 位 HEX 色值。'; }
        });
        mode?.addEventListener('change', () => { appearance = mode.value as typeof appearance; });
        apply.addEventListener('click', () => {
            if (ctx.busy || ctx.history.pending || ctx.draft || ctx.engine.exporting) return;
            const current = ctx.project.entities.find(e => e.id === targetId), now = ctx.scenes.context;
            if (!current || current.locked || now.sessionId !== scene.sessionId || now.sceneId !== scene.sceneId || JSON.stringify(current) !== before) {
                feedback.textContent = '对象或戏段已变化，请关闭后重新打开调色板。'; apply.disabled = true; return;
            }
            if (ctx.change(() => setEntityColor(current, color, appearance))) ctx.closeModal();
        });
        refresh();
    }
    return { handle(action: string) { if (action !== 'color-open') return false; open(); return true; } };
}

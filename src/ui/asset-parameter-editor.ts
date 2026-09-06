import type { AppContext } from '../app-context.ts';
import type { AssetDefinition } from '../assets/catalog/types.ts';
import type { Entity } from '../model.ts';
import { assetParameters } from '../assets/parameters.ts';
import { escape, options } from './common.ts';
import { ASSET_PARAMETER_HELP } from './asset-parameter-help.ts';

/** A parameter picker keeps a long shape contract usable in a narrow inspector. */
export function createAssetParameterEditor(ctx: AppContext, refresh: () => void) {
    let key = 'outfit';
    const content = document.querySelector<HTMLElement>('#inspector-content')!;
    content.addEventListener('change', event => {
        const target = event.target as HTMLSelectElement;
        if (target.id !== 'asset-parameter-key') return;
        event.stopPropagation(); key = target.value; refresh();
        content.querySelector<HTMLElement>('#asset-parameter-key')?.focus({ preventScroll: true });
    });
    content.addEventListener('click', event => {
        if (!(event.target as HTMLElement).closest('[data-reset-asset-parameter]')) return;
        event.stopPropagation();
        const entity = ctx.current(); if (!entity || entity.locked) return;
        ctx.change(() => {
            if (entity.assetParameters) {
                delete entity.assetParameters[key];
                if (!Object.keys(entity.assetParameters).length) delete entity.assetParameters;
            }
        });
    });
    return {
        render(entity: Entity, definition: AssetDefinition) {
            const schema = definition.parameters!;
            const values = assetParameters(entity), human = definition.family === 'human-v2';
            const available = Object.keys(schema).filter(id => !human || (id !== 'outfitLength' || values.outfit > 0) && (id !== 'outfitThickness' || values.outfit > 0 || values.headwear > 0 || values.backpack > 0));
            if (!available.includes(key)) key = available[0];
            const field = schema[key], value = values[key], label = field.label + (field.unit ? ` / ${field.unit}` : '');
            const attributes = `data-field="assetParameters.${escape(key)}" aria-label="${escape(label)}"`;
            const control = field.choices ? `<select ${attributes}>${options(Object.entries(field.choices), String(value))}</select>`
                : `<input type="number" ${attributes} value="${value}" min="${field.min}" max="${field.max}" step="${field.step}"/>`;
            const help = ASSET_PARAMETER_HELP[definition.family ?? ''];
            const hint = entity.kind === 'prop' ? help?.detail ?? '参数改变实际白模几何，可通过空间查询核对边界。' : human ? '比例 1 表示当前体型预设，身高在基础页调整。服装、帽盔和背包可组合；裙袍为关节上的简化轮廓，运动时仍可能穿插。' : '比例 1 表示当前物种预设；修改比例后仍保持基础页的总高。动物使用静态姿态和路径位移，不自动生成自然步态。';
            const summary = entity.kind === 'prop' ? help?.summary ?? '参数改变实际白模形状' : `比例与${human ? '身高' : '总高'}分别调整`;
            return `<div class="asset-parameter-editor"><select id="asset-parameter-key" aria-label="选择外形参数">${options(available.map(id => [id, schema[id].label + (schema[id].unit ? ' · ' + schema[id].unit : '')]), key)}</select><div class="parameter-value-row">${control}<button data-reset-asset-parameter aria-label="恢复此项预设值" title="恢复此项预设值 ${field.default}">↺</button></div><p class="parameter-hint" title="${escape(hint)}">${escape(summary)}</p></div>`;
        }
    };
}

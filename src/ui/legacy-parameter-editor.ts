import type { Entity } from '../model.ts';
import { propParameters } from '../parametric-props.ts';
import { num, options, select } from './common.ts';

export function createLegacyParameterEditor(refresh: () => void) {
    let chosen = 'steps';
    document.querySelector('#inspector-content')!.addEventListener('change', event => {
        const input = event.target as HTMLSelectElement;
        if (input.id !== 'legacy-parameter-choice') return;
        event.stopPropagation(); chosen = input.value; refresh();
    });
    return { render(e: Entity) {
        const p = propParameters(e);
        const choices: [Exclude<keyof typeof p, 'layout'>, string][] = e.asset === 'stairs'
            ? [['steps', '每段级数'], ['rise', '单级高度 / 米'], ['tread', '踏步深度 / 米'], ['width', '梯宽 / 米'], ...(p.layout !== 'straight' ? [['landing', '平台进深 / 米'] as [Exclude<keyof typeof p, 'layout'>, string]] : [])]
            : [['length', '长度 / 米'], ['width', e.asset === 'wall' ? '厚度 / 米' : '宽度 / 米'], ['height', e.asset === 'wall' ? '高度 / 米' : '厚度 / 米']];
        const [key, label] = choices.find(([id]) => id === chosen) ?? choices[0]; chosen = key;
        return (e.asset === 'stairs' ? select('楼梯结构', 'parameters.layout', [['straight', '直梯'], ['crest', '上平台后下行'], ['return', '折返上行']], p.layout) : '')
            + `<label class="field"><span>结构参数</span><select id="legacy-parameter-choice">${options(choices, key)}</select></label>`
            + num(label, `parameters.${key}`, p[key], key === 'steps' ? '1' : '.01', key === 'steps' ? 'min="1" max="128"' : 'min=".02" max="500"');
    } };
}

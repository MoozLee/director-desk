import * as T from 'three';
import type { AppContext } from '../app-context.ts';
import type { Entity } from '../model.ts';
import { button, num, select } from './common.ts';
import type { InspectorNavigation } from './inspector-navigation.ts';

export function cameraInspector(ctx: AppContext, e: Entity, navigation: InspectorNavigation) {
    const c = e.camera!;
    const lens = `<div class="button-row">${button('preview-selected', '查看画面', 'eye', 'subtle')}${button('cut-selected', '设为此处镜头', '', 'primary')}</div><div class="field-pair camera-lens-fields">${num('焦距 / mm', 'camera.focal', c.focal, '1', 'min="8" max="300"')}${num('目标高度 / m', 'camera.targetHeight', c.targetHeight, '.05')}</div><div class="section-label">景别辅助构图</div><div class="action-grid">${['全景', '中景', '近景', '特写'].map(s => `<button data-framing="${s}">${s}</button>`).join('')}</div>`;
    const target = select('机位方式', 'camera.mode', [['free', '独立机位 / 路径'], ['follow', '跟随对象'], ['pov', '绑定对象 / POV']], c.mode)
        + select('看向 / 绑定对象', 'camera.targetId', [['', '固定空间目标'], ...ctx.project.entities.filter(x => x.kind !== 'camera').map(x => [x.id, x.name] as [string, string])], c.targetId)
        + (c.mode === 'free' ? select('机位朝向', 'camera.aim', [['target', '看向目标 / 注视点'], ['manual', '手动旋转']], c.aim) : select('继承目标转向', 'camera.inheritRotation', [['true', '继承转向 / 头部动作'], ['false', '跟随位置 / 稳定头部']], String(c.inheritRotation)));
    const coordinate = c.mode === 'free' ? c.aim === 'target'
        ? `<div class="section-label">固定注视点<span>米</span></div><div class="triple">${['X', 'Y', 'Z'].map((a, i) => num(a, 'target.' + i, c.target[i])).join('')}</div><p class="panel-help">选择对象目标后，摄影机会持续看向对象。</p>`
        : `<div class="section-label">机位旋转<span>度</span></div><div class="triple">${['X', 'Y', 'Z'].map((a, i) => num(a, 'rot.' + i, T.MathUtils.radToDeg(e.rotation[i]), '1')).join('')}</div>`
        : `<div class="section-label">机位偏移<span>米</span></div><div class="triple">${['X', 'Y', 'Z'].map((a, i) => num(a, 'offset.' + i, c.offset[i])).join('')}</div><p class="panel-help">偏移相对绑定对象计算，预览与视频使用同一实际机位。</p>`;
    const motion = `<div class="action-grid">${['推近', '拉远', '横移', '升高', '环绕'].map(s => `<button data-motion="${s}">${s}</button>`).join('')}</div><p class="panel-help">运镜预设生成可编辑路径。到“路径”调整途经点、起止时间与路线形状。</p>`;
    const walls = '<p class="panel-help">仅在需要拆墙取景时隐藏。该设置影响本机位画面与导出。</p>' + [['north', '北墙'], ['south', '南墙'], ['east', '东墙'], ['west', '西墙'], ['ceiling', '天花板']].map(([w, l]) => `<label class="check"><input type="checkbox" data-wall="${w}" ${c.hideWalls.includes(w) ? 'checked' : ''}/>拍摄时移除${l}</label>`).join('');
    return navigation.render(`${e.id}:camera`, [{ id: 'lens', label: '镜头', html: lens }, { id: 'target', label: '目标', html: target }, { id: 'coordinates', label: '坐标', html: coordinate }, { id: 'motion', label: '运镜', html: motion }, { id: 'walls', label: '墙体', html: walls }]);
}

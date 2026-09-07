import * as T from 'three';
import type { AppContext } from '../app-context.ts';
import type { Vec3 } from '../model.ts';
import { recordCameraLook } from '../animation/camera-look.ts';
import { options } from './common.ts';
import './native-animation-editor.css';
export function createCameraLookPanel(ctx: AppContext) {
    let index = 0, owner = '';
    function render() {
        const e = ctx.project.entities.find(e => e.id === owner), c = e?.camera;
        if (!e || !c) return;
        const points = c.targetPath?.points ?? [];
        index = Math.max(0, Math.min(index, points.length - 1));
        const point = points[index], at = point?.time ?? ctx.time, position = point?.position ?? ctx.engine.targetPosition(e).toArray();
        const disabled = e.locked || c.mode === 'pov' ? 'disabled' : '';
        ctx.showModal('摄影机 · 视线关键帧', `<div class="native-editor" id="look-editor"><p class="panel-help">机位沿原路径移动，视线按这些世界坐标过渡。取对象位置只记录该时刻坐标，不持续绑定对象。首帧前与末帧后保持端点；POV 使用绑定朝向。</p><label>关键帧<select id="look-choice">${options(points.length ? points.map((p, i) => [String(i), `${i + 1} · ${p.time.toFixed(2)} 秒`]) : [['0', '尚未记录']], String(index))}</select></label><div class="native-values"><label>时间 / 秒<input id="look-time" type="number" min="0" step=".1" value="${at.toFixed(3)}"/></label><label>过渡<select id="look-smooth">${options([['true', '平滑起止'], ['false', '匀速移动注视点']], String(c.targetPath?.smooth ?? true))}</select></label></div><div class="native-values">${position.map((v, axis) => `<label>${'XYZ'[axis]} / 米<input id="look-${axis}" type="number" step=".1" value="${v.toFixed(3)}"/></label>`).join('')}</div><div class="native-row"><label>取对象当前位置<select id="look-source">${options([['', '当前机位注视点'], ...ctx.project.entities.filter(t => t.kind !== 'camera').map(t => [t.id, t.name] as [string, string])], '')}</select></label><button data-act="look-capture" ${disabled}>取当前帧</button></div><div class="button-row"><button data-act="look-save" ${disabled}>保存为关键帧</button><button data-act="look-seek" ${points.length ? '' : 'disabled'}>预览此帧</button><button data-act="look-remove" ${points.length ? disabled : 'disabled'}>删除此帧</button></div><p class="panel-help">同一帧再次保存会更新该点。改变时间会新增一个点，原点保留。可多次记录相同坐标来停留。</p></div>`, `<button data-act="look-clear" ${disabled}>清除视线关键帧</button><button data-act="close-modal">关闭</button>`);
        document.querySelector('#look-choice')!.addEventListener('change', ev => { index = Number((ev.target as HTMLSelectElement).value); render(); });
    }
    const input = (id: string) => document.getElementById(id) as HTMLInputElement;
    return { handle(action: string) {
        if (!['look-open', 'look-save', 'look-remove', 'look-clear', 'look-seek', 'look-capture'].includes(action)) return false;
        if (action === 'look-open') { owner = ctx.selected; index = 0; render(); return true; }
        const e = ctx.project.entities.find(e => e.id === owner); if (!e?.camera) return true;
        if (action === 'look-seek') { ctx.seek(e.camera.targetPath?.points[index]?.time ?? ctx.time); return true; }
        if (e.locked || e.camera.mode === 'pov') { ctx.toast('请先解锁摄影机，并使用独立或跟随机位'); return true; }
        if (action === 'look-capture') {
            const id = input('look-source').value, target = id ? ctx.engine.models.get(id) : null;
            const position = target ? target.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, e.camera.targetHeight, 0)) : ctx.engine.targetPosition(e);
            position.toArray().forEach((v, axis) => { input(`look-${axis}`).value = v.toFixed(3); }); input('look-time').value = String(ctx.time);
            return true;
        }
        ctx.change(() => {
            const c = e.camera!;
            if (action === 'look-clear') { c.target = ctx.engine.targetPosition(e).toArray(); c.targetPath = null; }
            if (action === 'look-remove' && c.targetPath) { c.targetPath.points.splice(index, 1); if (!c.targetPath.points.length) c.targetPath = null; }
            if (action === 'look-save') {
                c.targetPath = recordCameraLook(c.targetPath, Number(input('look-time').value), [0, 1, 2].map(i => Number(input(`look-${i}`).value)) as Vec3, ctx.project.fps);
                c.targetPath.smooth = input('look-smooth').value === 'true'; c.aim = 'target';
                index = c.targetPath.points.findIndex(p => Math.abs(p.time - Math.round(Number(input('look-time').value) * ctx.project.fps) / ctx.project.fps) < 1e-7);
                ctx.extendDuration();
            }
        }, false); render(); return true;
    } };
}

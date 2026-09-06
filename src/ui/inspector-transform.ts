import * as T from 'three';
import type { AppContext } from '../app-context.ts';
import type { Entity } from '../model.ts';
import { entityPosition } from '../timeline.ts';
import { num } from './common.ts';

export function transformInspector(ctx: AppContext, e: Entity) {
    const camera = e.camera ? ctx.engine.getShotCamera(e.id) : null;
    const position = e.handBinding ? new T.Vector3(...e.handBinding.offset) : camera?.position ?? entityPosition(e, ctx.time);
    const rotation = e.handBinding ? e.handBinding.rotation : camera ? [camera.rotation.x, camera.rotation.y, camera.rotation.z] : e.rotation;
    const label = e.handBinding ? '握持偏移 · 随手部旋转' : e.camera && e.camera.mode !== 'free' ? '当前机位位置 · 修改会解除绑定' : e.structureLink ? '连接模块位置 · 修改接缝偏移' : ctx.engine.positionKeying ? '当前帧位置 · 修改即记录关键帧' : e.path ? '整体位置 · 平移整条路径' : '初始位置';
    return `<div class="section-label">${label}<span>米</span></div><div class="triple">${['X', 'Y', 'Z'].map((axis, i) => num(axis, (e.handBinding ? 'handOffset.' : 'pos.') + i, position.getComponent(i))).join('')}</div><div class="section-label">${e.handBinding ? '握持旋转' : '旋转'}<span>度</span></div><div class="triple">${['X', 'Y', 'Z'].map((axis, i) => num(axis, (e.handBinding ? 'handRotation.' : 'rot.') + i, T.MathUtils.radToDeg(rotation[i]), '1')).join('')}</div>`;
}

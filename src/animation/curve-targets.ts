import type { Entity } from '../model.ts';
import type { AnimatedNumber, Easing } from './channels.ts';
import { CAMERA_CHANNELS } from '../cinematography/camera-effects.ts';
export interface CurveKey { time: number; easing?: Easing }
export interface CurveTarget { id: string; label: string; keys: CurveKey[]; repeated?: boolean }
/** References the real editor channels, so curve edits share playback, export and validation. */
export function curveTargets(entity: Entity): CurveTarget[] {
    const targets: CurveTarget[] = [];
    if (entity.path && entity.path.points.length > 1) targets.push({ id: 'path', label: '位置路径', keys: entity.path.points, repeated: !!entity.path.sections });
    if (entity.camera?.targetPath && entity.camera.targetPath.points.length > 1) targets.push({ id: 'look', label: '摄影机视线', keys: entity.camera.targetPath.points });
    const add = (id: string, label: string, value: AnimatedNumber | undefined) => { if (typeof value === 'object' && value.keys.length > 1) targets.push({ id, label, keys: value.keys }); };
    for (const [id, spec] of Object.entries(CAMERA_CHANNELS)) add('camera:' + id, spec.label, entity.camera?.effects?.channels?.[id as keyof typeof CAMERA_CHANNELS]);
    add('light:intensity', '灯光强度', entity.light?.intensity); add('light:temperature', '灯光色温', entity.light?.temperature);
    if (entity.light?.colorKeys && entity.light.colorKeys.length > 1) targets.push({ id: 'light:color', label: '灯光颜色', keys: entity.light.colorKeys });
    return targets;
}
export function insertCurvePause(entity: Entity, channel: string, endIndex: number, seconds = 1) {
    const target = curveTargets(entity).find(t => t.id === channel);
    if (entity.locked || !target || target.repeated || !Number.isFinite(seconds) || seconds <= 0 || !Number.isInteger(endIndex) || endIndex < 1 || endIndex >= target.keys.length) throw Error('此曲线区间不能插入停留');
    const previous = target.keys[endIndex - 1], held = structuredClone(previous);
    held.time += seconds; held.easing = 'linear';
    for (let i = endIndex; i < target.keys.length; i++) target.keys[i].time += seconds;
    target.keys.splice(endIndex, 0, held);
    return target.keys.at(-1)!.time;
}

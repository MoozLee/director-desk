/** Display range in camera-space metres, fixed throughout a scene/export. */
export interface DepthRange { near: number; far: number; invert: boolean }
export interface DepthVideo extends DepthRange { enabled: boolean }
export const DEFAULT_DEPTH_VIDEO: Readonly<DepthVideo> = Object.freeze({ enabled: false, near: .1, far: 30, invert: false });

export function assertDepthRange(value: unknown): asserts value is DepthRange {
    const v = value as DepthRange;
    if (!v || typeof v !== 'object' || !Number.isFinite(v.near) || !Number.isFinite(v.far)
        || v.near < 0 || v.far <= v.near || v.far > 2000 || typeof v.invert !== 'boolean')
        throw Error('深度范围无效：近端须 ≥ 0，远端须大于近端且 ≤ 2000 米');
}
export function assertDepthVideo(value: unknown): asserts value is DepthVideo {
    assertDepthRange(value);
    if (typeof (value as DepthVideo).enabled !== 'boolean'
        || Object.keys(value).some(k => !['enabled', 'near', 'far', 'invert'].includes(k))) throw Error('深度预览设置无效');
}

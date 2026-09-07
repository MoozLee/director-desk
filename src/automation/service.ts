import type { AppContext } from '../app-context.ts';
import { resourceUsage } from '../resources/resource-usage.ts';
import { sceneResourceReport } from '../resources/render-statistics.ts';
import { structurePorts, worldStructurePorts } from '../building/structure-ports.ts';
import { queryAssetCatalog, type AssetQuery } from '../assets/catalog-query.ts';
import { clone, outputSize, uid } from '../model.ts';
import { applyOperationsWithResources, changeSummary, type EditOperation } from './edits.ts';
import { motionPresets } from '../animation/motion-catalog.ts';
import { checkPathSurfaces, pathSurfaceModels } from '../spatial/path-surfaces.ts';
import { scanSpatialRange, type SpatialRangeOptions } from '../spatial/range.ts';
import { download } from '../storage.ts';
import { productionEntries } from '../production/bundle.ts';
import { createZip } from '../production/zip.ts';
import { productionData, safeFilename } from '../production/notes.ts';
import { validateToolInput } from './validate.ts';
import { toolHelp } from './contract.ts';
import { continueScene, continuitySummary } from '../scenes/continue-scene.ts';
import { editIndependentScene, readIndependentScene } from './scene-tools.ts';
import { inheritedPoseAt } from '../scenes/initial-pose.ts';
import { BUILTIN_SKILL, readBuiltinSkill } from './skill.ts';
export function createToolService(ctx: AppContext) {
    // A new renderer must not accept a revision captured before a reload/reconnect.
    let revision = Date.now() * 1000 + Math.floor(Math.random() * 1000), fingerprint = '', sequence = Promise.resolve<unknown>(null);
    const receipts = new Map<string, { args: string; result: unknown }>();
    const previews = new Map<string, { revision: number; operations: EditOperation[] }>();
    const jobs = new Map<string, { id: string; status: string; progress: number; result?: unknown; error?: string; aborter: AbortController }>();
    function currentRevision() { const next = JSON.stringify([ctx.scenes?.context, ctx.project]); if (next !== fingerprint) { fingerprint = next; revision++; } return revision; }
    function idle() { if (ctx.busy || ctx.draft || ctx.history.pending || ctx.engine.exporting) throw new Error('当前正在编辑、绘制或执行长任务，请等待或取消'); }
    function checkRevision(value: unknown) { const actual = currentRevision(); if (value !== actual) throw new Error(`REVISION_CONFLICT：请求版本 ${value}，当前版本 ${actual}；请重新读取工程`); }
    function job(run: (signal: AbortSignal, progress: (p: number) => void) => Promise<unknown>) {
        idle(); ctx.busy = true; ctx.playing = false; ctx.updateTimeUI();
        const id = uid(), task = { id, status: 'running', progress: 0, aborter: new AbortController() } as typeof jobs extends Map<string, infer V> ? V : never;
        jobs.set(id, task);
        void run(task.aborter.signal, p => { task.progress = p; }).then(result => { task.result = result; task.status = 'completed'; task.progress = 1; })
            .catch(e => { task.status = e.name === 'AbortError' ? 'canceled' : 'failed'; task.error = e.message; })
            .finally(() => { ctx.busy = false; ctx.updateTimeUI(); if (jobs.size > 30) jobs.delete(jobs.keys().next().value!); });
        return { jobId: id, status: task.status };
    }
    async function execute(name: string, args: Record<string, unknown>) {
        validateToolInput(name, args);
        if (name === 'director_skill') return readBuiltinSkill(args.knownVersion as string | undefined);
        if (name === 'director_help') return toolHelp(args.names as string[]);
        if (name === 'director_scene') {
            if (args.action === 'list') return { revision: currentRevision(), sceneContext: ctx.scenes.context, scenes: ctx.scenes.list() };
            if (args.action === 'read') return { revision: currentRevision(), ...readIndependentScene(ctx.scenes.document(), args.sceneId as string | undefined) };
            idle();
            if (typeof args.requestId !== 'string' || !args.requestId || args.requestId.length > 200) throw Error('需要唯一 requestId');
            const encoded = JSON.stringify({ name, args }), receipt = receipts.get(args.requestId);
            if (receipt) { if (receipt.args !== encoded) throw Error('requestId 已用于不同操作'); return receipt.result; }
            checkRevision(args.revision);
            const context = ctx.scenes.context, document = ctx.scenes.document();
            ctx.busy = true; ctx.playing = false;
            try {
                if (args.action === 'continue' && args.sceneId !== undefined && args.sceneId !== context.sceneId) throw Error('请先切换到要接拍的来源戏段');
                const next = args.action === 'continue' ? await continueScene(ctx.engine, document, String(args.name ?? ''), args.newSceneId as string | undefined) : editIndependentScene(document, args);
                checkRevision(args.revision);
                ctx.applyDocument(next, context, ({ switch: '切换戏段', create: '新增戏段', copy: '复制戏段', continue: '从末帧接拍', rename: '重命名戏段', reorder: '排序戏段', remove: '删除戏段' } as Record<string, string>)[String(args.action)]);
                const result = { revision: currentRevision(), sceneContext: ctx.scenes.context, scenes: ctx.scenes.list() };
                receipts.set(args.requestId, { args: encoded, result }); if (receipts.size > 200) receipts.delete(receipts.keys().next().value!); return result;
            } finally { ctx.busy = false; ctx.updateTimeUI(); }
        }
        if (name === 'director_continuity') {
            const revision = currentRevision(), document = ctx.scenes.document();
            const data = await continuitySummary(document, args.sceneId as string | undefined);
            if (!data.origin) return { revision, ...data };
            const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 50);
            if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw Error('前情查询分页范围无效');
            const objects = data.origin.objects.filter(o => !args.entityId || o.entityId === args.entityId);
            return { revision, ...data, origin: { ...data.origin, objects: objects.slice(offset, offset + limit), total: objects.length, offset,
                nextOffset: offset + limit < objects.length ? offset + limit : null } };
        }
        if (name === 'director_read') {
            const ids = Array.isArray(args.ids) ? args.ids : null;
            const resource = args.resourceId === undefined ? undefined : ctx.project.resources?.find(r => r.id === args.resourceId);
            if (args.resourceId !== undefined && !resource) throw Error('模型资源不存在');
            return { revision: currentRevision(), sceneContext: ctx.scenes?.context, scenes: ctx.scenes?.list(), name: ctx.project.name, duration: ctx.project.duration, fps: ctx.project.fps, aspect: ctx.project.aspect,
                ...(resource ? { model: ctx.engine.externalModels.inspection(resource) } : {}),
                skill: { name: BUILTIN_SKILL.name, version: BUILTIN_SKILL.version },
                time: ctx.time, cameraId: ctx.preview, selectedId: ctx.selected, room: ctx.project.room, floors: ctx.project.floors ?? [], zones: ctx.project.zones ?? [], editorView: ctx.project.editorView, cuts: ctx.project.cuts,
                references: ctx.project.references.map(({ id, name }) => ({ id, name })), production: productionData(ctx.project),
                resources: (ctx.project.resources ?? []).map(({ package: _package, ...metadata }) => metadata),
                ...(args.details || resource ? { resourceUsage: resourceUsage(ctx.project).filter(r => !resource || r.id === resource.id).map(r => ({ ...r, sceneReferences: ctx.scenes?.resourceScenes(r.id) ?? [], used: ctx.scenes ? ctx.scenes.resourceScenes(r.id).length > 0 : r.used })) } : {}),
                ...(args.details ? { resourceStatistics: sceneResourceReport(ctx.engine) } : {}),
                entities: ctx.project.entities.filter(e => !ids || ids.includes(e.id)).map(e => args.details ? { ...clone(e), ...(e.initialPose ? { initialPose: { active: inheritedPoseAt(e, ctx.time), nodeCount: e.initialPose.nodes.length, description: '接拍姿态；原始节点数组保存在工程文件中，新动作开始后不再保持' } } : {}) } : { id: e.id, name: e.name, asset: e.asset, kind: e.kind, color: e.color, reference: e.reference, locked: e.locked, visible: e.visible, position: e.position }),
                ...(args.details ? { structureModules: ctx.project.entities.filter(e => (!ids || ids.includes(e.id)) && structurePorts(e).length).map(e => ({ id: e.id, localPorts: structurePorts(e), worldPorts: !e.path && !e.handBinding && !e.clips.length ? worldStructurePorts(e) : [], link: e.structureLink ?? null })) } : {}),
                coordinates: '米／秒；工程 rotation 为弧度，世界 +Y 向上，人物 +Z 为前；当前动画位置应查询 spatial。图片字节未发送。' };
        }
        if (name === 'director_nodes') {
            const time = args.time === undefined ? ctx.time : Number(args.time); if (!Number.isFinite(time) || time < 0) throw Error('节点查询时间无效');
            const previous = ctx.engine.time;
            try { ctx.engine.sample(time); return { revision: currentRevision(), time, ...ctx.engine.externalModels.nodes(ctx.project, String(args.entityId), args as { path?: string; query?: string; offset?: number; limit?: number }) }; }
            finally { ctx.engine.sample(previous); }
        }
        if (name === 'director_assets') return queryAssetCatalog(args as AssetQuery);
        if (name === 'director_motions') return { presets: motionPresets(String(args.query ?? '')), note: '内置人形动作，通过 director_apply 的 motion 操作加入人物或群演；duration 可指定持续秒数，省略则使用目录的短默认时长，整场坐姿需显式指定全程时长；素材资源随工程保存；basicAction 基础预设复用程序姿态，无需附加素材，导入人物需完整人形骨架。' };
        if (name === 'director_job') {
            const task = jobs.get(String(args.id)); if (!task) throw new Error('任务不存在'); if (args.cancel) task.aborter.abort();
            const { aborter: _aborter, ...data } = task; return data;
        }
        idle();
        if (name === 'director_path_surface') return { revision: currentRevision(), ...checkPathSurfaces(ctx.project, pathSurfaceModels(ctx.engine), { entityId: String(args.entityId), surfaceId: args.surfaceId as string | undefined, clearance: args.clearance as number | undefined, tolerance: args.tolerance as number | undefined }) };
        if (name === 'director_stride') {
            const entity = ctx.project.entities.find(e => e.id === args.entityId); if (!entity) throw Error('对象不存在');
            return { revision: currentRevision(), ...ctx.engine.externalModels.estimateStride(entity, String(args.clipId)) };
        }
        if (name === 'director_apply') {
            if (typeof args.requestId !== 'string' || !args.requestId || args.requestId.length > 200) throw new Error('需要唯一 requestId');
            const encoded = JSON.stringify(args), receipt = receipts.get(args.requestId);
            if (receipt) { if (receipt.args !== encoded) throw new Error('requestId 已用于不同操作'); return receipt.result; }
            checkRevision(args.revision);
            const savedPreview = typeof args.previewId === 'string' ? previews.get(args.previewId) : undefined;
            if (args.previewId && (!savedPreview || savedPreview.revision !== args.revision)) throw Error('预检已失效，请按当前工程重新预检完整 operations');
            const before = ctx.project;
            ctx.busy = true; ctx.playing = false; ctx.updateTimeUI();
            try {
                const operations = savedPreview?.operations ?? args.operations as EditOperation[], after = await applyOperationsWithResources(before, operations), summary = changeSummary(before, after);
                if (operations.some(op => op.operation === 'motion')) await ctx.engine.externalModels.prepare(after);
                else if (after.resources?.length) ctx.engine.externalModels.assertReady(after);
                checkRevision(args.revision);
                if (ctx.project !== before || ctx.draft || ctx.history.pending || ctx.engine.exporting) throw Error('REVISION_CONFLICT：准备资源期间工程或编辑状态已变化');
                ctx.busy = false;
                if (!args.preview && !ctx.change(() => { ctx.project = after; })) throw new Error('修改提交失败');
                const previewId = args.preview ? uid() : undefined;
                if (previewId) { previews.set(previewId, { revision: currentRevision(), operations: clone(operations) }); if (previews.size > 20) previews.delete(previews.keys().next().value!); }
                const result = { revision: currentRevision(), preview: Boolean(args.preview), committed: !args.preview, summary, ...(previewId ? { previewId } : {}),
                    message: args.preview ? '仅预检通过，未写入工程，added 的 ID 尚不存在。确认提交时传 revision、全新 requestId 和 previewId，省略 operations；需要修改这批内容则重新提交完整 operations。'
                        : '本批已提交，可撤销。后续编辑请使用本次返回的 revision。' };
                if (!args.preview) { receipts.set(args.requestId, { args: encoded, result }); if (receipts.size > 200) receipts.delete(receipts.keys().next().value!); }
                return result;
            } finally { ctx.busy = false; ctx.engine.externalModels.retain([ctx.project, ...ctx.history.undoStack, ...ctx.history.redoStack]); ctx.updateTimeUI(); }
        }
        if (name === 'director_spatial') {
            const report = ctx.engine.spatialReport({ time: args.time as number | undefined, cameraId: args.cameraId as string | undefined, occlusionKeys: args.occlusionKeys as string[] | undefined });
            // Filter only the response: walls and other unrequested objects must still occlude.
            if (!Array.isArray(args.ids)) return report;
            const ids = new Set(args.ids);
            return { ...report, objects: report.objects.filter(o => ids.has(o.entityId)), filter: { ids: args.ids, countsScope: 'entire-scene' } };
        }
        if (name === 'director_scan') return job((signal, progress) => scanSpatialRange(ctx.engine, args as unknown as SpatialRangeOptions, signal, (done, total) => progress(done / total)));
        if (name === 'director_view') {
            if (typeof args.time !== 'number' || !Number.isFinite(args.time) || args.time < 0) throw new Error('无效时间');
            if (args.cameraId && args.cameraId !== 'program' && !ctx.engine.cameras.has(String(args.cameraId))) throw new Error('机位不存在');
            if (args.entityId && !ctx.project.entities.some(e => e.id === args.entityId)) throw new Error('对象不存在');
            ctx.playing = false; ctx.seek(args.time); if (args.cameraId) { ctx.preview = String(args.cameraId); ctx.renderCameras(); }
            if (args.entityId) ctx.selectEntity(String(args.entityId)); return { time: ctx.time, cameraId: ctx.preview };
        }
        if (name === 'director_history') {
            checkRevision(args.revision); if (!['undo', 'redo'].includes(String(args.action))) throw new Error('无效历史操作');
            await ctx.act(String(args.action), document.createElement('button')); return { revision: currentRevision() };
        }
        if (name === 'director_export') {
            const kind = String(args.kind); if (!['project', 'screenshot', 'video', 'bundle'].includes(kind)) throw new Error('未知导出格式');
            if (kind === 'project') { ctx.saveProject(); return { status: 'save-requested' }; }
            if (kind === 'screenshot') { await ctx.snapshot(); return { status: 'save-requested' }; }
            const project = clone(ctx.project);
            return job(async (signal, progress) => {
                if (kind === 'bundle') { const zip = await createZip(await productionEntries(project, undefined, ctx.scenes?.document()), signal, (a, b) => progress(a / b)); download(zip, safeFilename(project.name) + '-制作素材包.zip'); }
                else { const { exportVideo } = await import('../export.ts'); const [width, height] = outputSize(project.aspect, Number(args.size ?? 1280));
                    const blob = await exportVideo(ctx.engine, { start: Number(args.start ?? 0), end: Number(args.end ?? project.duration), fps: project.fps, width, height, cameraId: 'program', format: 'mp4', monochrome: false }, signal, progress);
                    if (blob) download(blob, safeFilename(project.name) + '.mp4'); }
                return { status: 'save-requested', note: '已生成并发起本地保存；最终保存路径由使用者选择。' };
            });
        }
        throw new Error('工具未实现');
    }
    return { call(name: string, args: Record<string, unknown> = {}) {
        const pending = sequence.then(async () => { try { return { ok: true, data: await execute(name, args) }; } catch (error) { return { ok: false, error: (error as Error).message, revision: currentRevision() }; } });
        sequence = pending; return pending;
    } };
}

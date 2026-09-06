import { FRAME_RATES, getFrameCount, outputSize } from '../model.ts';
import { download } from '../storage.ts';
import { $, button, escape, options } from './common.ts';
import type { AppContext } from '../app-context.ts';
export function createVideoPanel(ctx: AppContext) {
    async function snapshot() {
        if(ctx.busy)return;
        const at=ctx.time;
        ctx.playing=false;ctx.busy=true;ctx.engine.exporting=true;
        try {
            const [w,h]=outputSize(ctx.project.aspect,1920);
            const canvas=ctx.engine.renderOutput(at,w,h,ctx.preview);
            const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
            if(!blob)throw new Error('未能生成截图');
            download(blob,`${ctx.project.name}-${at.toFixed(2)}s.png`);
        }catch(error){ctx.toast((error as Error).message,true);}
        finally {ctx.busy=false;ctx.engine.restorePreview(at);ctx.updateTimeUI();}
    }
    function exportDialog() {
        const photo = ctx.engine.shotRenderer.domElement.toDataURL('image/png');
        const fileAPI = 'showSaveFilePicker' in window;
        ctx.showModal('导出参考视频', `<div class="export-layout"><div class="export-fields"><label class="field"><span>输出内容</span><select id="export-camera">${options([['program', '按切镜输出'], ...ctx.project.entities.filter(e => e.kind === 'camera').map(e => [e.id, e.name] as [
                string,
                string
            ])], ctx.preview)}</select></label><div class="range-shortcuts"><button data-range="all">整场</button><button data-range="15">从此处起 15 秒</button><button data-range="30">30 秒</button></div><div class="field-pair"><label class="field"><span>开始 / 秒</span><input id="export-start" type="number" min="0" step=".1" value="0"/></label><label class="field"><span>结束 / 秒</span><input id="export-end" type="number" step=".1" value="${ctx.project.duration}"/></label></div><div class="section-divider"></div><div class="field-pair"><label class="field"><span>画幅 · 与项目一致</span><input value="${ctx.project.aspect}" readonly/></label><label class="field"><span>分辨率</span><select id="export-size">${options([['1920', '1080p 级'], ['1280', '720p 级'], ['640', '360p 级']], '1920')}</select></label><label class="field"><span>帧率</span><select id="export-fps">${options(FRAME_RATES.map(f => [String(f), f + ' fps']), String(ctx.project.fps))}</select></label><label class="field"><span>视频格式</span><select id="export-format"><option value="mp4">MP4 / H.264</option><option value="webm">WebM / VP9</option></select></label></div><div class="field-pair"><label class="field"><span>白模外观</span><select id="export-color"><option value="color">角色区分色</option><option value="white">统一白模色</option></select></label>${fileAPI ? `<label class="field"><span>保存方式</span><select id="export-save"><option value="download">浏览器下载 · 短片</option><option value="disk">直接保存到文件 · 长片</option></select></label>` : ''}</div><p class="panel-help">摄影机、场景和时间与预览一致。网格、路径、控制点不会出现在视频里。</p></div><div class="export-preview"><div class="section-label">当前机位预览<span>${ctx.time.toFixed(2)} s</span></div><img src="${photo}" alt="当前摄影机真实取景"/><p>直接来自三维场景</p><div id="export-summary" class="export-summary"></div><div id="export-progress" hidden><div class="progress-top"><strong>正在逐帧生成视频</strong><span id="progress-percent">0%</span></div><progress value="0" max="1"></progress><p id="progress-detail">请保持页面打开。可以随时取消，项目会保留。</p></div></div></div>`, button('close-modal', '取消', '', 'subtle') + button('export-start', '导出视频', 'download', 'primary'));
        $('.modal').classList.add('export-modal');
        updateExportSummary();
    }
    function exportOptions() { const [width, height] = outputSize(ctx.project.aspect, Number($<HTMLSelectElement>('#export-size').value)); return { start: Number($<HTMLInputElement>('#export-start').value), end: Number($<HTMLInputElement>('#export-end').value), fps: Number($<HTMLSelectElement>('#export-fps').value), width, height, cameraId: $<HTMLSelectElement>('#export-camera').value, format: $<HTMLSelectElement>('#export-format').value as 'mp4' | 'webm', monochrome: $<HTMLSelectElement>('#export-color').value === 'white' }; }
    function updateExportSummary() {
        if (!$('#export-summary') || ctx.busy)
            return;
        const o = exportOptions();
        $('#export-summary').innerHTML = `<strong>${Math.max(0, o.end - o.start).toFixed(2)} 秒 · ${getFrameCount(o.start, o.end, o.fps)} 帧</strong><span>${o.width} × ${o.height} · ${o.fps} fps</span><span>${o.format.toUpperCase()} · ${ctx.project.aspect}</span>`;
        if (!Number.isFinite(o.start) || !Number.isFinite(o.end) || o.end <= o.start)
            return;
        const oldTime = ctx.time, oldMono = ctx.engine.monochrome;
        const sampleTime = Math.max(o.start, Math.min(ctx.time, o.end - 1 / o.fps));
        const [width, height] = outputSize(ctx.project.aspect, 640);
        try {
            ctx.engine.monochrome = o.monochrome;
            const canvas = ctx.engine.renderOutput(sampleTime, width, height, o.cameraId);
            $<HTMLImageElement>('.export-preview img').src = canvas.toDataURL('image/png');
            $('.export-preview .section-label').innerHTML = `${escape(ctx.engine.cameraEntity(o.cameraId).name)}<span>${sampleTime.toFixed(2)} s</span>`;
        }
        finally {
            ctx.engine.monochrome = oldMono;
            ctx.engine.restorePreview(oldTime);
        }
    }
    async function startExport() {
        if (ctx.busy) return;
        const opts = exportOptions();
        if (!Number.isFinite(opts.start) || !Number.isFinite(opts.end) || opts.end <= opts.start || opts.start < 0 || opts.end > ctx.project.duration) {
            ctx.toast('请输入场景范围内的有效起止时间', true);
            return;
        }
        let handle: FileSystemFileHandle | undefined;
        ctx.busy = true; ctx.playing = false; ctx.updateTimeUI();
        try {
            if (($<HTMLSelectElement>('#export-save')?.value) === 'disk') {
                const picker = (window as unknown as {
                    showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle>;
                }).showSaveFilePicker;
            handle = await picker.call(window,{ suggestedName: ctx.project.name + '.' + opts.format, types: [{ description: '参考视频', accept: { [opts.format === 'mp4' ? 'video/mp4' : 'video/webm']: ['.' + opts.format] } }] });
            }
            else if (opts.width * opts.height * opts.fps * .13 / 8 * (opts.end - opts.start) > 250000000) {
                ctx.toast('此规格预计超过 250 MB，请选择“直接保存到文件”或缩小导出范围', true);
                ctx.busy = false;
                return;
            }
        }
        catch (error) {
            ctx.busy = false;
            if ((error as Error).name !== 'AbortError')
                ctx.toast((error as Error).message, true);
            return;
        }
        ctx.aborter = new AbortController();
        $('#export-progress').hidden = false;
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.export-fields input,.export-fields select').forEach(el => el.disabled = true);
        $('.modal-footer').innerHTML = button('cancel-export', '取消导出', '', 'subtle');
        try {
            const { exportVideo } = await import('../export.ts');
            const blob = await exportVideo(ctx.engine, opts, ctx.aborter.signal, p => { $<HTMLProgressElement>('#export-progress progress').value = p; $('#progress-percent').textContent = Math.round(p * 100) + '%'; $('#progress-detail').textContent = `${Math.round(getFrameCount(opts.start, opts.end, opts.fps) * p)} / ${getFrameCount(opts.start, opts.end, opts.fps)} 帧 · 按时间轴生成，不受预览帧率影响`; }, handle);
            if (blob)
                download(blob, `${ctx.project.name}.${opts.format}`);
            ctx.toast('参考视频已导出');
            ctx.busy = false;
            ctx.closeModal();
        }
        catch (error) {
            ctx.toast((error as Error).name === 'AbortError' ? '已取消导出，项目已保留' : (error as Error).message, (error as Error).name !== 'AbortError');
            ctx.busy = false;
            ctx.closeModal();
        }
        finally {
            ctx.busy = false;
            ctx.aborter = null;
            ctx.renderPanels();
        }
    }
    return { snapshot, exportDialog, updateExportSummary, startExport };
}

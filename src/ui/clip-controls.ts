import type { AppContext } from '../app-context.ts';
import { clipRange, splitClip, deleteClip, setClipRange, type TimelineSelection } from '../clip-editing.ts';
import { $ } from './common.ts';
let selected: TimelineSelection | null = null;
export function selectClip(s: TimelineSelection | null) { selected=s; }
export function currentClipSelection() { return selected ? { ...selected } : null; }
export function clipFromBar(bar:HTMLElement):TimelineSelection {
    if(bar.dataset.cut!==undefined) return {kind:'cut',index:Number(bar.dataset.cut)};
    if(bar.dataset.pathId) return {kind:'path',entityId:bar.dataset.pathId,index:Number(bar.dataset.section ?? 0)};
    return {kind:'action',entityId:bar.dataset.entity!,id:bar.dataset.clipId!};
}
export function isSelected(s:TimelineSelection) {
    if(!selected || s.kind!==selected.kind)return false;
    if(s.kind==='cut' && selected.kind==='cut')return s.index===selected.index;
    if(s.kind==='path' && selected.kind==='path')return s.entityId===selected.entityId && s.index===selected.index;
    return s.kind==='action' && selected.kind==='action' && s.entityId===selected.entityId && s.id===selected.id;
}
export function bindClipControls(ctx:AppContext) {
    const run=(fn:()=>void)=>{ if(ctx.busy || ctx.draft || ctx.history.pending) return; try {fn();} catch(e) {ctx.toast((e as Error).message,true);} };
    const split=()=>run(()=>{if(!selected) throw Error('先点击选择动作、路径或切镜片段'); const s=selected; ctx.change(()=>{selected=splitClip(ctx.project,s,ctx.time);},false);});
    const trim=()=>run(()=>{
        if(!selected) throw Error('先点击选择动作、路径或切镜片段');
        const s=selected,{start,end}=clipRange(ctx.project,s);
        ctx.showModal(s.kind==='cut'?'镜头时长':'片段时间',`<div class="field-pair"><label class="field">开始 / 秒<input id="clip-start" type="number" min="0" step="${1/ctx.project.fps}" value="${start}"></label><label class="field">结束 / 秒<input id="clip-end" type="number" min="0" step="${1/ctx.project.fps}" value="${end}"></label></div><label class="field">持续 / 秒<input id="clip-duration" type="number" min="${1/ctx.project.fps}" step="${1/ctx.project.fps}" value="${end-start}"></label><p class="panel-help">${s.kind==='cut'?'修改相邻切镜边界；最后一个镜头的结束时间也是成片结束时间。人物动作和运镜保持各自的时间安排。':'修改该片段的播放时间；路径会按新时长运行。'}</p>`,`<button id="apply-clip-time">应用</button>`);
        const a=$<HTMLInputElement>('#clip-start'),b=$<HTMLInputElement>('#clip-end'),d=$<HTMLInputElement>('#clip-duration');
        if(s.kind==='cut' && s.index===0) a.disabled=true;
        a.oninput=b.oninput=()=>d.value=String(Number(b.value)-Number(a.value));
        d.oninput=()=>b.value=String(Number(a.value)+Number(d.value));
        $('#apply-clip-time').onclick=()=>{
            const frame=(n:number)=>Math.round(n*ctx.project.fps)/ctx.project.fps;
            if(ctx.change(()=>{setClipRange(ctx.project,s,frame(Number(a.value)),frame(Number(b.value)));},false))ctx.closeModal();
        };
    });
    document.addEventListener('click',ev=>{ const el=(ev.target as HTMLElement).closest<HTMLElement>('[data-edit-path-section]'); if(el){selected={kind:'path',entityId:el.dataset.owner!,index:Number(el.dataset.editPathSection)};trim();} });
    $('#timeline-content').addEventListener('edit-selected-clip',trim);
    $('#timeline-split').addEventListener('click',split);
    $('#timeline-trim').addEventListener('click',trim);
    document.addEventListener('keydown',ev=>{
        if(['INPUT','TEXTAREA','SELECT'].includes((ev.target as HTMLElement).tagName) || $('#modal-root').children.length) return;
        if((ev.ctrlKey||ev.metaKey) && ev.code==='KeyB') {ev.preventDefault();ev.stopImmediatePropagation();split();}
        if(ev.key==='Delete' && $('#timeline-content').contains(document.activeElement) && selected) {ev.preventDefault();ev.stopImmediatePropagation();run(()=>{if(ctx.change(()=>deleteClip(ctx.project,selected!),false)){selected=null;ctx.renderTimeline();}});}
    },true);
}

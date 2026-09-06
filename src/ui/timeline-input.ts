import type { AppContext } from '../app-context.ts';
import { clone, assertProject } from '../model.ts';
import { clipRange, setClipRange } from '../clip-editing.ts';
import { $ } from './common.ts';
import { bindTimelineZoom, timelineTimeAt, pixelsPerSecond, extendTimelineView } from './timeline-zoom.ts';
import { bindClipControls, clipFromBar, selectClip } from './clip-controls.ts';
export function bindTimelineInput(ctx: AppContext) {
    const timeline=$('#timeline-content'), mode=$<HTMLSelectElement>('#timeline-mode');
    timeline.tabIndex=0;
    bindTimelineZoom(ctx); bindClipControls(ctx);
    let lastClick={key:'',at:0};
    let cleanup:((cancel?:boolean)=>void)|undefined;
    const seekAt=(x:number)=>{ctx.playing=false;ctx.seek(Math.round(timelineTimeAt(x)*ctx.project.fps)/ctx.project.fps);};
    mode.addEventListener('change',()=>{cleanup?.(true);timeline.classList.toggle('hover-preview',mode.value==='preview');});
    timeline.addEventListener('pointermove',ev=>{
        if(mode.value==='preview' && !cleanup && !ctx.busy && !ctx.draft && !ctx.playing && !ev.buttons && !$('#modal-root').children.length && (ev.target as HTMLElement).closest('.ruler,.track-lane')) seekAt(ev.clientX);
    });
    timeline.addEventListener('pointerdown',ev=>{
        if(ev.button!==0 || ctx.busy || ctx.draft || ctx.history.pending || cleanup) return;
        const target=ev.target as HTMLElement;
        if(target.closest('button') || !target.closest('.ruler,.track-lane')) return;
        const bar=mode.value==='preview'?null:target.closest<HTMLElement>('[data-clip-id],[data-path-id],[data-cut]');
        const selection=bar?clipFromBar(bar):null;
        if(selection && selection.kind!=='cut' && ctx.project.entities.find(e=>e.id===selection.entityId)?.locked) {ctx.toast('对象已锁定');return;}
        ev.preventDefault(); timeline.focus({preventScroll:true}); ctx.playing=false;
        const before=clone(ctx.project), startX=ev.clientX, startScroll=timeline.scrollLeft, pps=pixelsPerSecond();
        const range=selection?{...clipRange(before,selection)}:null;
        const resize=!!target.dataset.resize;
        let x=startX,moved=false,raf=0,last=performance.now();
        if(selection){selectClip(selection);ctx.history.begin(ctx.project);} else seekAt(x);
        timeline.setPointerCapture(ev.pointerId);
        const apply=()=>{
            if(!selection){seekAt(x);return;}
            const distance=x-startX+timeline.scrollLeft-startScroll;
            if(Math.abs(distance)>3) moved=true;
            if(!moved)return;
            const delta=Math.round(distance/pps*before.fps)/before.fps;
            ctx.project=clone(before);
            try {
                const a=range!.start,b=range!.end,frame=1/before.fps;
                if(selection.kind==='cut') {
                    if(resize) {
                        const limit=before.cuts[selection.index+1] ? (before.cuts[selection.index+2]?.time ?? before.duration) : Infinity;
                        setClipRange(ctx.project,selection,a,Math.min(limit-frame,Math.max(a+frame,b+delta)));
                    } else if(selection.index>0) {
                        ctx.project.cuts[selection.index].time=Math.max(before.cuts[selection.index-1].time+frame,Math.min(b-frame,a+delta));
                    }
                } else setClipRange(ctx.project,selection,resize?a:a+Math.max(delta,-a),resize?Math.max(a+frame,b+delta):b+Math.max(delta,-a));
                ctx.engine.project=ctx.project;ctx.engine.sample(ctx.time);ctx.renderTimeline();
            } catch { ctx.project=clone(before); }
        };
        const tick=(now:number)=>{
            const dt=Math.min(.05,(now-last)/1000);last=now;
            const rect=timeline.getBoundingClientRect(), label=timeline.querySelector('.track-label')!.getBoundingClientRect().width;
            const left=rect.left+label,right=rect.right-12;
            const speed=x>right-42?Math.min(1,(x-right+42)/42)*850:x<left+42?-Math.min(1,(left+42-x)/42)*850:0;
            if(speed){extendTimelineView(ctx,timelineTimeAt(right)+30); const old=timeline.scrollLeft;timeline.scrollLeft+=speed*dt;if(old!==timeline.scrollLeft)apply();}
            raf=requestAnimationFrame(tick);
        };
        const move=(e:PointerEvent)=>{if(e.pointerId===ev.pointerId){x=e.clientX;apply();}};
        const up=(e:PointerEvent)=>{if(e.pointerId===ev.pointerId)cleanup?.(e.type==='pointercancel');};
        cleanup=(cancel=false)=>{
            cancelAnimationFrame(raf); document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);
            if(timeline.hasPointerCapture(ev.pointerId))timeline.releasePointerCapture(ev.pointerId);
            cleanup=undefined;
            if(!selection)return;
            try {
                if(cancel)throw Error('已取消拖动');
                assertProject(ctx.project);ctx.history.commit(ctx.project);
                if(moved)ctx.changed(false);
                else {
                    if(selection.kind==='cut'){ctx.seek(ctx.project.cuts[selection.index].time);ctx.preview='program';ctx.selectEntity(ctx.project.cuts[selection.index].cameraId);}
                    else {ctx.inspectorTab=selection.kind==='path'?'path':'actions';ctx.selectEntity(selection.entityId);}
                    ctx.renderTimeline();
                    const key=JSON.stringify(selection),now=performance.now();
                    if(lastClick.key===key && now-lastClick.at<450) {timeline.dispatchEvent(new Event('edit-selected-clip'));lastClick={key:'',at:0};}
                    else lastClick={key,at:now};
                }
            }catch(e){ctx.project=ctx.history.rollback()??before;ctx.engine.rebuild(ctx.project);ctx.renderPanels();if(!cancel)ctx.toast((e as Error).message,true);}
        };
        document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);raf=requestAnimationFrame(tick);
    });
    window.addEventListener('blur',()=>cleanup?.(true));
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape')cleanup?.(true);},true);
}

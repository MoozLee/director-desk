import type { AppContext } from '../app-context.ts';
import { assertProject } from '../model.ts';
import { createTimelineDrag } from '../editor/timeline-drag.ts';
import { createTimelineDragPreview } from './timeline-preview.ts';
import { $ } from './common.ts';
import { bindTimelineZoom, timelineTimeAt, pixelsPerSecond, extendTimelineView } from './timeline-zoom.ts';
import { bindClipControls, clipFromBar, selectClip } from './clip-controls.ts';
export function bindTimelineInput(ctx: AppContext) {
    const timeline=$('#timeline-content'), mode=$<HTMLSelectElement>('#timeline-mode');
    timeline.tabIndex=0;
    bindTimelineZoom(ctx); bindClipControls(ctx);
    let lastClick={key:'',at:0};
    let cleanup:((cancel?:boolean)=>void)|undefined;
    const seekAt=(x:number)=>{ctx.playing=false;const time=Math.round(timelineTimeAt(x)*ctx.project.fps)/ctx.project.fps;if(time!==ctx.time)ctx.seek(time,true);};
    mode.addEventListener('change',()=>{cleanup?.(true);timeline.classList.toggle('hover-preview',mode.value==='preview');});
    timeline.addEventListener('pointermove',ev=>{
        if(mode.value==='preview' && !cleanup && !ctx.busy && !ctx.draft && !ctx.playing && !ev.buttons && !$('#modal-root').children.length && (ev.target as HTMLElement).closest('.ruler,.track-lane')) {
            seekAt(ev.clientX);
        }
    });
    timeline.addEventListener('pointerdown',ev=>{
        if(ev.button!==0 || ctx.busy || ctx.draft || ctx.history.pending || cleanup) return;
        const target=ev.target as HTMLElement;
        if(target.closest('button') || !target.closest('.ruler,.track-lane')) return;
        const bar=mode.value==='preview'?null:target.closest<HTMLElement>('[data-clip-id],[data-path-id],[data-cut]');
        const selection=bar?clipFromBar(bar):null;
        if(selection && selection.kind!=='cut' && ctx.project.entities.find(e=>e.id===selection.entityId)?.locked) {ctx.toast('对象已锁定');return;}
        ev.preventDefault(); timeline.focus({preventScroll:true}); ctx.playing=false;
        const before=ctx.project, startX=ev.clientX, startScroll=timeline.scrollLeft, pps=pixelsPerSecond();
        const drag=selection?createTimelineDrag(ctx.project,selection):null;
        const previewDrag=selection?createTimelineDragPreview(ctx,selection):null;
        const resize=!!bar && !!target.closest('[data-resize]');
        let x=startX,moved=false,raf=0,last=performance.now();
        const rect=timeline.getBoundingClientRect(), label=timeline.querySelector('.track-label')!.getBoundingClientRect().width;
        const left=Math.max(0,rect.left)+label,right=Math.min(window.innerWidth,rect.left+timeline.clientWidth)-12;
        let appliedDelta:number|undefined;
        let resultSelection=selection;
        if(selection){selectClip(selection);ctx.history.begin(ctx.project);} else seekAt(x);
        document.documentElement.dataset.timelineDrag=selection?(resize?'resize':'move'):'seek';
        timeline.setPointerCapture(ev.pointerId);
        const apply=()=>{
            if(!selection){seekAt(x);return;}
            const distance=x-startX+timeline.scrollLeft-startScroll;
            if(Math.abs(distance)>3) moved=true;
            if(!moved)return;
            const delta=Math.round(distance/pps*before.fps)/before.fps;
            if(delta===appliedDelta)return;
            appliedDelta=delta;
            try {
                resultSelection=drag!.apply(delta,resize);
                selectClip(resultSelection);
                previewDrag!(resultSelection);
            } catch { resultSelection=selection;selectClip(selection);previewDrag!(selection); }
        };
        const tick=(now:number)=>{
            const dt=Math.min(.05,(now-last)/1000);last=now;
            const speed=x>right-42?Math.min(1,(x-right+42)/42)*850:x<left+42?-Math.min(1,(left+42-x)/42)*850:0;
            if(speed){if(speed>0)extendTimelineView(ctx,timelineTimeAt(right)+30); const old=timeline.scrollLeft;timeline.scrollLeft+=speed*dt;if(old!==timeline.scrollLeft)apply();}
            raf=requestAnimationFrame(tick);
        };
        // Apply input before the render loop; a second RAF here adds a frame of latency.
        const move=(e:PointerEvent)=>{if(e.pointerId===ev.pointerId){if(!(e.buttons&1)){cleanup?.();return;}x=e.clientX;apply();}};
        const scroll=()=>apply();
        const up=(e:PointerEvent)=>{if(e.pointerId===ev.pointerId){if(e.type==='pointerup'){x=e.clientX;apply();}cleanup?.(e.type==='pointercancel');}};
        const lostCapture=(e:PointerEvent)=>{if(e.pointerId===ev.pointerId)cleanup?.();};
        const mouseUp=(e:MouseEvent)=>{if(e.button===0)cleanup?.();};
        cleanup=(cancel=false)=>{
            cleanup=undefined;
            cancelAnimationFrame(raf); document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);
            timeline.removeEventListener('scroll',scroll);
            timeline.removeEventListener('lostpointercapture',lostCapture);window.removeEventListener('mouseup',mouseUp,true);
            delete document.documentElement.dataset.timelineDrag;
            if(timeline.hasPointerCapture(ev.pointerId))timeline.releasePointerCapture(ev.pointerId);
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
            }catch(e){selectClip(selection);ctx.project=ctx.history.rollback()??before;ctx.engine.rebuild(ctx.project);ctx.renderPanels();if(!cancel)ctx.toast((e as Error).message,true);}
        };
        timeline.addEventListener('scroll',scroll);timeline.addEventListener('lostpointercapture',lostCapture);window.addEventListener('mouseup',mouseUp,true);document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);raf=requestAnimationFrame(tick);
    });
    window.addEventListener('blur',()=>cleanup?.(true));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup?.(true);});
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape')cleanup?.(true);},true);
}

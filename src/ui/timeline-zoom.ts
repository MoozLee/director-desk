import type { AppContext } from '../app-context.ts';
import { $ } from './common.ts';
let extent = 60;
export const pixelsPerSecond = () => 60 * Number($<HTMLSelectElement>('#timeline-zoom').value);
export function timelineExtent(duration = 0, time = 0) {
    const visible = Math.max(1, ($('#timeline-content')?.clientWidth ?? 1600) - 192) / pixelsPerSecond();
    extent = Math.max(extent, Math.ceil((Math.max(duration, time, visible) + 30) / 30) * 30);
    return extent;
}
export function timelineTimeAt(clientX: number) {
    const ruler = $('.ruler'), rect = ruler.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / rect.width * Number(ruler.dataset.duration));
}
export function sizeTimeline() {
    const container = $('#timeline-content'), tracks = container.querySelector<HTMLElement>('.timeline-tracks'), ruler = container.querySelector<HTMLElement>('.ruler');
    if (!tracks || !ruler) return;
    const label = container.querySelector('.track-label')!.getBoundingClientRect().width;
    tracks.style.width = label + Number(ruler.dataset.duration) * pixelsPerSecond() + 'px';
    drawTicks();
}
function drawTicks() {
    const container = $('#timeline-content'), ruler = container.querySelector<HTMLElement>('.ruler'); if (!ruler) return;
    const duration = Number(ruler.dataset.duration), fps = Number(ruler.dataset.fps), px = ruler.clientWidth / duration;
    const desired = 85 / px, magnitude = 10 ** Math.floor(Math.log10(desired));
    const step = Math.max(1 / fps, [1,2,5,10].map(n => n * magnitude).find(n => n >= desired)!);
    const rect = ruler.getBoundingClientRect(), viewport = container.getBoundingClientRect();
    const start = Math.max(0, Math.floor((viewport.left - rect.left) / px / step) * step);
    const end = Math.min(duration, (viewport.right - rect.left) / px + step);
    ruler.querySelectorAll('[data-tick]').forEach(tick => tick.remove());
    for (let t = start, i = 0; t <= end + 1e-8 && i < 100; t = start + ++i * step) {
        const tick = document.createElement('span'); tick.dataset.tick = ''; tick.style.left = t / duration * 100 + '%'; tick.textContent = String(Number(t.toFixed(3))); ruler.append(tick);
    }
}
export function extendTimelineView(ctx: AppContext, time: number) {
    const old = extent; timelineExtent(ctx.project.duration, time);
    if (extent !== old) ctx.renderTimeline();
}
export function bindTimelineZoom(ctx: AppContext) {
    const container = $('#timeline-content'), zoom = $<HTMLSelectElement>('#timeline-zoom');
    const center = () => {
        extendTimelineView(ctx, ctx.time); const rect = $('.ruler').getBoundingClientRect(), viewport = container.getBoundingClientRect();
        container.scrollLeft += rect.left + ctx.time * pixelsPerSecond() - viewport.left - viewport.width / 2;
    };
    const change = (direction: number, x?: number) => {
        if (ctx.history.pending) return;
        const at = x === undefined ? ctx.time : timelineTimeAt(x);
        zoom.selectedIndex = Math.max(0, Math.min(zoom.options.length - 1, zoom.selectedIndex + direction));
        extendTimelineView(ctx, at); sizeTimeline();
        if (x === undefined) center();
        else container.scrollLeft += $('.ruler').getBoundingClientRect().left + at * pixelsPerSecond() - x;
    };
    zoom.addEventListener('change', () => { extendTimelineView(ctx, ctx.time); sizeTimeline(); center(); });
    $('#timeline-center').addEventListener('click', center);
    $('#timeline-zoom-in').addEventListener('click', () => change(1)); $('#timeline-zoom-out').addEventListener('click', () => change(-1));
    container.addEventListener('wheel', event => {
        if (ctx.history.pending) return;
        if (event.ctrlKey || event.metaKey) { event.preventDefault(); change(event.deltaY < 0 ? 1 : -1, event.clientX); }
        else if (event.shiftKey || (event.target as HTMLElement).closest('.ruler')) { event.preventDefault(); container.scrollLeft += event.deltaX || event.deltaY; }
    }, { passive:false });
    container.addEventListener('scroll', () => {
        drawTicks();
        if (container.scrollLeft + container.clientWidth >= container.scrollWidth - 100) extendTimelineView(ctx, timelineTimeAt(container.getBoundingClientRect().right) + 30);
    });
    new ResizeObserver(() => { extendTimelineView(ctx, ctx.time); sizeTimeline(); }).observe(container);
}

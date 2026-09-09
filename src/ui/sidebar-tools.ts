import { icon } from './common.ts';

/** Keep scene tools in one menu while retaining their existing command handlers. */
export function bindSidebarTools() {
    const sidebar = document.querySelector<HTMLElement>('.sidebar')!;
    const footer = sidebar.querySelector<HTMLElement>('.side-bottom')!;
    const menu = document.createElement('div');
    menu.id = 'sidebar-tools-menu'; menu.className = 'sidebar-tools';
    menu.setAttribute('aria-label', '场景工具');
    menu.append(...footer.childNodes);
    const lighting = document.createElement('button'); lighting.dataset.act = 'lighting-open'; lighting.textContent = '灯光与环境'; menu.append(lighting);
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = 'wide sidebar-tools-trigger';
    trigger.innerHTML = `${icon('grid')}场景工具 <span aria-hidden="true">⌃</span>`;
    trigger.setAttribute('popovertarget', menu.id);
    trigger.setAttribute('aria-expanded', 'false'); trigger.hidden = true;
    footer.append(trigger, menu);

    const place = () => {
        if (!menu.matches(':popover-open')) return;
        const anchor = trigger.getBoundingClientRect(), bounds = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8)) + 'px';
        menu.style.top = Math.max(8, anchor.top - bounds.height - 6) + 'px';
    };
    menu.addEventListener('toggle', () => {
        const open = menu.matches(':popover-open'); trigger.setAttribute('aria-expanded', String(open));
        if (open) place();
    });
    menu.addEventListener('click', event => {
        if ((event.target as HTMLElement).closest('[data-act]') && menu.matches(':popover-open')) menu.hidePopover();
    });
    menu.setAttribute('popover', 'auto'); trigger.hidden = false;
    new ResizeObserver(place).observe(sidebar);
}

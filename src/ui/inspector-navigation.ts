import { escape } from './common.ts';

export interface InspectorSection { id: string; label: string; html: string }
/** UI-only section state. Project data and edit handlers remain with their owning modules. */
export function createInspectorNavigation(refresh: () => void) {
    const selected = new Map<string, string>();
    const content = document.querySelector<HTMLElement>('#inspector-content')!;
    content.addEventListener('click', event => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-inspector-section]');
        if (!button) return;
        event.stopPropagation();
        selected.set(button.dataset.sectionOwner!, button.dataset.inspectorSection!);
        refresh();
        content.querySelector<HTMLElement>('[data-inspector-section][aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    return {
        select(key: string, section: string) { selected.set(key, section); },
        render(key: string, sections: InspectorSection[]) {
            const current = sections.find(section => section.id === selected.get(key)) ?? sections[0];
            selected.set(key, current.id);
            if (selected.size > 200) selected.delete(selected.keys().next().value!);
            return `<nav class="inspector-section-tabs" aria-label="属性分组">${sections.map(section => `<button type="button" data-section-owner="${escape(key)}" data-inspector-section="${section.id}" aria-pressed="${section === current}">${escape(section.label)}</button>`).join('')}</nav><div class="inspector-page" data-section="${current.id}">${current.html}</div>`;
        },
    };
}
export type InspectorNavigation = ReturnType<typeof createInspectorNavigation>;

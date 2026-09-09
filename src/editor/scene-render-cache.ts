import type { Entity } from '../model.ts';

/** Retain only live instances. Capture values, since editor entities may be mutated in place. */
export class SceneRenderCache {
    private keys = new Map<string, string>();
    invalidate() { this.keys.clear(); }
    reconcile(entities: Entity[], liveIds: Iterable<string>) {
        const next = new Map(entities.map(entity => [entity.id, JSON.stringify(entity)]));
        const live = new Set(liveIds);
        const removed = [...live].filter(id => !next.has(id) || this.keys.get(id) !== next.get(id));
        const added = entities.filter(entity => !live.has(entity.id) || this.keys.get(entity.id) !== next.get(entity.id));
        return { removed, added, commit: () => { this.keys = next; } };
    }
}

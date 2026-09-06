import { clone, type Project } from './model.ts';
import { readSceneDocument, type SceneDocument } from './scenes/sequence-project.ts';
import type { SceneView } from './scenes/sequence-session.ts';
export interface ResourceOwner { resources?: readonly { id: string }[] }
export interface EditorHistory {
    readonly undoStack: readonly ResourceOwner[];
    readonly redoStack: readonly ResourceOwner[];
    readonly pending: Project | null;
    readonly restoredSelection: string | undefined;
    readonly restoredView?: SceneView;
    begin(project: Project): void;
    commit(project: Project): void;
    rollback(): Project | null;
    undo(project: Project): Project | null;
    redo(project: Project): Project | null;
}
const DB_NAME = 'director-desk-v1';
async function database() { return await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function autosave(project: Project | SceneDocument) { const data = clone(project); const db = await database(); try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(data, 'recovery'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
finally {
    db.close();
} }
export async function recover(): Promise<SceneDocument | null> { const db = await database(); try {
    const data = await new Promise<unknown>((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('recovery'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return data ? readSceneDocument(data) : null;
}
finally {
    db.close();
} }
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
export class History {
    private selections = new WeakMap<Project, string>();
    restoredSelection: string | undefined;
    private selection: () => string;
    constructor(selection: () => string = () => '') { this.selection = selection; }
    private snapshot(p: Project) { const snapshot = clone(p); this.selections.set(snapshot, this.selection()); return snapshot; }
    undoStack: Project[] = [];
    redoStack: Project[] = [];
    pending: Project | null = null;
    begin(p: Project) { if (!this.pending)
        this.pending = this.snapshot(p); }
    commit(p: Project) { if (this.pending && JSON.stringify(this.pending) !== JSON.stringify(p)) {
        this.undoStack.push(this.pending);
        if (this.undoStack.length > 35)
            this.undoStack.shift();
        this.redoStack = [];
    } this.pending = null; }
    rollback() { const p = this.pending; this.restoredSelection = p ? this.selections.get(p) : undefined; this.pending = null; return p; }
    undo(p: Project) { const old = this.undoStack.pop(); if (old) {
        this.redoStack.push(this.snapshot(p));
        this.restoredSelection = this.selections.get(old);
        return old;
    } return null; }
    redo(p: Project) { const next = this.redoStack.pop(); if (next) {
        this.undoStack.push(this.snapshot(p));
        this.restoredSelection = this.selections.get(next);
        return next;
    } return null; }
}

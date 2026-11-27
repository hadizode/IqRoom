import { findObject } from '../../shared/view-tree';
import type { Scene, SceneObject, Sprite } from '../../shared/types';
import { nowIso } from '../../shared/utils';
import type { StudioState } from './state';
import { recompute } from './migration';
import { getContext, setObjectsIn } from './context';

export type StudioSet = (partial: Partial<StudioState> | ((s: StudioState) => Partial<StudioState>)) => void;
export type StudioGet = () => StudioState;

export interface StudioHelpers {
  addSprites: (list: Sprite[]) => void;
  pushHistory: (sceneId: string, key?: string) => void;
  commitScene: (sceneId: string, scene: Scene) => void;
  edit: (key: string | undefined, fn: (scene: Scene) => Scene) => boolean;
  editObjects: (key: string | undefined, fn: (o: SceneObject[]) => SceneObject[]) => boolean;
  restore: (from: 'past' | 'future') => void;
}

let lastKey: string | undefined;
let lastTime = 0;

export function createStudioHelpers(set: StudioSet, get: StudioGet): StudioHelpers {
  /** Merge extra sprites into the registry + current project's sprite list. */
  const addSprites = (list: Sprite[]) => {
    if (!list.length) return;
    set((s) => ({
      sprites: { ...s.sprites, ...Object.fromEntries(list.map((sp) => [sp.id, sp])) },
      projects: s.projects.map((p) =>
        p.id === s.currentProjectId ? { ...p, sprites: [...new Set([...p.sprites, ...list.map((sp) => sp.id)])] } : p
      ),
    }));
  };

  /** Saves the current scene to the undo stack. Same `key` within 800ms = one undo step. */
  const pushHistory = (sceneId: string, key?: string) => {
    const t = Date.now();
    if (key && key === lastKey && t - lastTime < 800) {
      lastTime = t;
      return;
    }
    lastKey = key;
    lastTime = t;
    set((s) => ({
      past: [...s.past.slice(-99), { sceneId, scene: s.scenes[sceneId] }],
      future: [],
    }));
  };

  const commitScene = (sceneId: string, scene: Scene) =>
    set((s) => {
      const scenes = { ...s.scenes, [sceneId]: scene };
      return {
        scenes,
        projects: s.projects.map((p) =>
          p.id === scene.projectId ? { ...recompute(p, scenes), updatedAt: nowIso() } : p
        ),
      };
    });

  const edit = (key: string | undefined, fn: (scene: Scene) => Scene): boolean => {
    const id = get().currentSceneId;
    const scene = id ? get().scenes[id] : undefined;
    if (!id || !scene) return false;
    const next = fn(scene);
    if (next === scene) return false;
    pushHistory(id, key);
    commitScene(id, next);
    return true;
  };

  const editObjects = (key: string | undefined, fn: (o: SceneObject[]) => SceneObject[]) =>
    edit(key, (scene) => {
      const viewOf = get().editingViewOf;
      const cur = getContext(scene, viewOf)?.objects ?? scene.objects;
      const next = fn(cur);
      return next === cur ? scene : setObjectsIn(scene, viewOf, next);
    });

  const restore = (from: 'past' | 'future') => {
    const s = get();
    const stack = s[from];
    const snap = stack[stack.length - 1];
    if (!snap) return;
    const cur = s.scenes[snap.sceneId];
    lastKey = undefined;
    if (!cur) {
      set({ [from]: stack.slice(0, -1) } as Partial<StudioState>);
      return;
    }
    const other = from === 'past' ? 'future' : 'past';
    const scenes = { ...s.scenes, [snap.sceneId]: snap.scene };
    set({
      [from]: stack.slice(0, -1),
      [other]: [...s[other], { sceneId: snap.sceneId, scene: cur }],
      scenes,
      projects: s.projects.map((p) => (p.id === snap.scene.projectId ? recompute(p, scenes) : p)),
      currentSceneId: snap.sceneId,
      selectedObjectIds: [],
      editingViewOf:
        s.editingViewOf &&
        s.currentSceneId === snap.sceneId &&
        findObject(snap.scene.objects, s.editingViewOf)?.view
          ? s.editingViewOf
          : null,
    } as Partial<StudioState>);
  };

  return { addSprites, pushHistory, commitScene, edit, editObjects, restore };
}

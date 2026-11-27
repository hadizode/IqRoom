import { cloneScene, createScene, assetRef, type Scene } from '../../shared/types';
import { mapObject } from '../../shared/view-tree';
import { nowIso } from '../../shared/utils';
import type { StudioGet, StudioSet } from './helpers';
import { recompute } from './migration';

export const createSceneSlice = (set: StudioSet, get: StudioGet) => ({
  // ---------- scenes ----------
  selectScene: (id: string) => set({ currentSceneId: id, editingViewOf: null, selectedObjectIds: [] }),

  addScene: (title?: string) => {
    const pid = get().currentProjectId;
    const project = get().projects.find((p) => p.id === pid);
    if (!pid || !project) return;
    const scene = createScene(pid, title || `Room ${project.scenes.length + 1}`);
    set((s) => {
      const scenes = { ...s.scenes, [scene.id]: scene };
      return {
        scenes,
        projects: s.projects.map((p) =>
          p.id === pid ? recompute({ ...p, scenes: [...p.scenes, scene.id], updatedAt: nowIso() }, scenes) : p
        ),
        currentSceneId: scene.id,
        editingViewOf: null,
        selectedObjectIds: [],
      };
    });
  },

  deleteScene: (id: string) =>
    set((s) => {
      const scene = s.scenes[id];
      if (!scene) return {};
      const project = s.projects.find((p) => p.id === scene.projectId);
      if (!project) return {};
      const idx = project.scenes.indexOf(id);
      const remaining = project.scenes.filter((x) => x !== id);
      const scenes = { ...s.scenes };
      delete scenes[id];
      return {
        scenes,
        projects: s.projects.map((p) => (p.id === project.id ? recompute({ ...p, scenes: remaining, updatedAt: nowIso() }, scenes) : p)),
        currentSceneId: s.currentSceneId === id ? remaining[Math.min(idx, remaining.length - 1)] ?? null : s.currentSceneId,
        editingViewOf: null,
        selectedObjectIds: [],
        past: s.past.filter((x) => x.sceneId !== id),
        future: s.future.filter((x) => x.sceneId !== id),
      };
    }),

  moveScene: (id: string, dir: -1 | 1) =>
    set((s) => ({
      projects: s.projects.map((p) => {
        const i = p.scenes.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.scenes.length) return p;
        const list = [...p.scenes];
        [list[i], list[j]] = [list[j], list[i]];
        return recompute({ ...p, scenes: list, updatedAt: nowIso() }, s.scenes);
      }),
    })),

  duplicateScene: (id: string) =>
    set((s) => {
      const src = s.scenes[id];
      if (!src) return {};
      const copy = cloneScene(src, src.projectId, `${src.title} (copy)`);
      const scenes = { ...s.scenes, [copy.id]: copy };
      return {
        scenes,
        projects: s.projects.map((p) => {
          if (p.id !== src.projectId) return p;
          const list = [...p.scenes];
          list.splice(list.indexOf(id) + 1, 0, copy.id);
          return recompute({ ...p, scenes: list, updatedAt: nowIso() }, scenes);
        }),
        currentSceneId: copy.id,
        editingViewOf: null,
        selectedObjectIds: [],
      };
    }),

  updateScene: (patch: Partial<Scene>, key?: string) => {
    get().edit(key, (scene) => ({ ...scene, ...patch }));
  },

  setBackground: (assetIdOrRef: string, w: number, h: number) => {
    // Accept a raw asset id or ref and turn it into a reusable sprite ref.
    const ref = assetIdOrRef.startsWith('asset:') || assetIdOrRef.startsWith('sprite:') || assetIdOrRef.startsWith('data:') || assetIdOrRef.startsWith('http')
      ? assetIdOrRef.startsWith('data:') || assetIdOrRef.startsWith('http')
        ? get().useAssetSprite(assetIdOrRef)
        : assetIdOrRef.startsWith('sprite:')
          ? assetIdOrRef
          : get().useAssetSprite(assetIdOrRef)
      : assetIdOrRef === ''
        ? ''
        : get().useAssetSprite(assetRef(assetIdOrRef));
    const url = ref;
    const viewOf = get().editingViewOf;
    get().edit(undefined, (scene) =>
      viewOf
        ? {
            ...scene,
            objects: mapObject(scene.objects, viewOf, (o) =>
              o.view ? { ...o, view: { ...o.view, backgroundUrl: url, width: w, height: h } } : o
            ),
          }
        : { ...scene, backgroundUrl: url, width: w, height: h }
    );
  },
});

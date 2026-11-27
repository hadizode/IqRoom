import { cloneObject, createObject, type SceneObject } from '../../shared/types';
import { MAX_VIEW_DEPTH, findObject, mapObject, objectPath } from '../../shared/view-tree';
import { uid } from '../../shared/utils';
import type { AlignMode, OrderMode } from './migration';
import type { StudioGet, StudioSet } from './helpers';
import { getContext, setObjectsIn } from './context';

export const createObjectSlice = (set: StudioSet, get: StudioGet) => {
  const edit = get().edit;
  const editObjects = get().editObjects;
  const ctx = () => getContext(get().currentSceneId ? get().scenes[get().currentSceneId!] : undefined, get().editingViewOf);

  return {
    // ---------- objects ----------
    addObject: (patch?: Partial<SceneObject>) => {
      const count = ctx()?.objects.length ?? 0;
      const obj = createObject({
        x: 60 + ((count * 24) % 300),
        y: 60 + ((count * 24) % 300),
        ...patch,
      });
      if (editObjects(undefined, (o) => [...o, obj])) set({ selectedObjectIds: [obj.id] });
      return obj.id;
    },

    addObjectFromAsset: (assetId: string, cx?: number, cy?: number) => {
      const s = get();
      const a = s.assets[assetId];
      const c = ctx();
      if (!a || !c) return;
      const k = Math.min(1, 160 / Math.max(a.width, a.height, 1));
      const w = Math.max(10, Math.round(a.width * k));
      const h = Math.max(10, Math.round(a.height * k));
      const x = Math.round((cx ?? c.width / 2) - w / 2);
      const y = Math.round((cy ?? c.height / 2) - h / 2);
      const obj = createObject({ name: a.name, spriteRef: s.useAssetSprite(`asset:${assetId}`, a.name), x, y, width: w, height: h });
      if (editObjects(undefined, (o) => [...o, obj])) set({ selectedObjectIds: [obj.id] });
    },

    updateObjects: (patches: Record<string, Partial<SceneObject>>, key?: string) => {
      editObjects(key, (objs) =>
        objs.some((o) => patches[o.id]) ? objs.map((o) => (patches[o.id] ? { ...o, ...patches[o.id] } : o)) : objs
      );
    },
    updateObject: (id: string, patch: Partial<SceneObject>, key?: string) => {
      get().updateObjects({ [id]: patch }, key);
    },

    deleteObjects: (ids: string[]) => {
      if (!ids.length) return;
      const set_ = new Set(ids);
      const viewOf = get().editingViewOf;
      const ok = edit(undefined, (scene) => {
        const cur = getContext(scene, viewOf)?.objects ?? scene.objects;
        const next = cur.filter((o) => !set_.has(o.id));
        if (next.length === cur.length) return scene;
        const updated = setObjectsIn(scene, viewOf, next);
        return viewOf ? updated : { ...updated, clueChain: updated.clueChain.filter((c) => !set_.has(c)) };
      });
      if (ok) set((s) => ({ selectedObjectIds: s.selectedObjectIds.filter((i) => !set_.has(i)) }));
    },

    selectObject: (id: string, multi = false) =>
      set((s) => ({
        selectedObjectIds: multi
          ? s.selectedObjectIds.includes(id)
            ? s.selectedObjectIds.filter((x) => x !== id)
            : [...s.selectedObjectIds, id]
          : [id],
      })),
    selectObjects: (ids: string[]) => set({ selectedObjectIds: ids }),
    selectAll: () => set({ selectedObjectIds: ctx()?.objects.map((o) => o.id) ?? [] }),
    clearSelection: () => set({ selectedObjectIds: [] }),

    copySelected: () => {
      const s = get();
      const sel = ctx()?.objects.filter((o) => s.selectedObjectIds.includes(o.id)) ?? [];
      if (sel.length) set({ clipboard: sel });
    },
    paste: () => {
      const clip = get().clipboard;
      if (!clip.length) return;
      const pasted = clip.map((o) => ({ ...cloneObject(o), x: o.x + 20, y: o.y + 20 }));
      if (editObjects(undefined, (objs) => [...objs, ...pasted])) {
        set({ selectedObjectIds: pasted.map((o) => o.id), clipboard: pasted });
      }
    },
    duplicateSelected: () => {
      get().copySelected();
      get().paste();
    },

    nudge: (dx: number, dy: number) => {
      const ids = new Set(get().selectedObjectIds);
      editObjects('nudge', (objs) =>
        objs.map((o) => (ids.has(o.id) && !o.locked ? { ...o, x: o.x + dx, y: o.y + dy } : o))
      );
    },

    orderObjects: (ids: string[], mode: OrderMode) => {
      const sel = new Set(ids);
      editObjects(undefined, (objs) => {
        let arr = [...objs];
        if (mode === 'top') arr = [...arr.filter((o) => !sel.has(o.id)), ...arr.filter((o) => sel.has(o.id))];
        else if (mode === 'bottom') arr = [...arr.filter((o) => sel.has(o.id)), ...arr.filter((o) => !sel.has(o.id))];
        else if (mode === 'up') {
          for (let i = arr.length - 2; i >= 0; i--)
            if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        } else {
          for (let i = 1; i < arr.length; i++)
            if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
        }
        return arr.every((o, i) => o === objs[i]) ? objs : arr;
      });
    },

    alignObjects: (mode: AlignMode) => {
      const ids = new Set(get().selectedObjectIds);
      editObjects(undefined, (objs) => {
        const sel = objs.filter((o) => ids.has(o.id) && !o.locked);
        if (sel.length < 2) return objs;
        const minX = Math.min(...sel.map((o) => o.x));
        const maxX = Math.max(...sel.map((o) => o.x + o.width));
        const minY = Math.min(...sel.map((o) => o.y));
        const maxY = Math.max(...sel.map((o) => o.y + o.height));
        const patch = new Map<string, Partial<SceneObject>>();
        const r = Math.round;
        if (mode === 'left') sel.forEach((o) => patch.set(o.id, { x: r(minX) }));
        if (mode === 'right') sel.forEach((o) => patch.set(o.id, { x: r(maxX - o.width) }));
        if (mode === 'hcenter') sel.forEach((o) => patch.set(o.id, { x: r((minX + maxX) / 2 - o.width / 2) }));
        if (mode === 'top') sel.forEach((o) => patch.set(o.id, { y: r(minY) }));
        if (mode === 'bottom') sel.forEach((o) => patch.set(o.id, { y: r(maxY - o.height) }));
        if (mode === 'vmiddle') sel.forEach((o) => patch.set(o.id, { y: r((minY + maxY) / 2 - o.height / 2) }));
        if (mode === 'hdist' || mode === 'vdist') {
          if (sel.length < 3) return objs;
          const h = mode === 'hdist';
          const sorted = [...sel].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
          const total = sorted.reduce((acc, o) => acc + (h ? o.width : o.height), 0);
          const gap = ((h ? maxX - minX : maxY - minY) - total) / (sorted.length - 1);
          let pos = h ? minX : minY;
          sorted.forEach((o) => {
            patch.set(o.id, h ? { x: r(pos) } : { y: r(pos) });
            pos += (h ? o.width : o.height) + gap;
          });
        }
        return objs.map((o) => (patch.has(o.id) ? { ...o, ...patch.get(o.id) } : o));
      });
    },

    // ---------- views ----------
    enterView: (objectId: string) => {
      const s = get();
      const scene = s.currentSceneId ? s.scenes[s.currentSceneId] : undefined;
      if (scene && findObject(scene.objects, objectId)?.view) set({ editingViewOf: objectId, selectedObjectIds: [] });
    },
    exitView: () =>
      set((s) => {
        const cur = s.editingViewOf;
        if (!cur) return { editingViewOf: null, selectedObjectIds: [] };
        const scene = s.currentSceneId ? s.scenes[s.currentSceneId] : undefined;
        const path = scene ? objectPath(scene.objects, cur) : [];
        // Go up one level: the parent owner of the view we leave (or null at the top).
        return {
          editingViewOf: path.length >= 2 ? path[path.length - 2] : null,
          selectedObjectIds: [cur],
        };
      }),
    addView: (objectId: string): boolean => {
      const s = get();
      const scene = s.currentSceneId ? s.scenes[s.currentSceneId] : undefined;
      if (!scene) return false;
      // Views nest MAX_VIEW_DEPTH levels deep: an object at depth MAX_VIEW_DEPTH may not own a view.
      if (objectPath(scene.objects, objectId).length - 1 >= MAX_VIEW_DEPTH) return false;
      return edit(undefined, (scene) => ({
        ...scene,
        objects: mapObject(scene.objects, objectId, (o) =>
          o.view
            ? o
            : {
                ...o,
                view: { id: uid('view'), title: `${o.name} – Close-up`, backgroundUrl: o.spriteRef, width: 400, height: 400, objects: [] },
              }
        ),
      }));
    },
    removeView: (objectId: string) => {
      const s = get();
      const scene = s.currentSceneId ? s.scenes[s.currentSceneId] : undefined;
      const cur = s.editingViewOf;
      let nextEditing = cur;
      if (cur && scene) {
        // If we are editing this owner's view (or a view nested inside it), move up to the owner's parent.
        if (objectPath(scene.objects, cur).includes(objectId)) {
          const ownerPath = objectPath(scene.objects, objectId);
          nextEditing = ownerPath.length >= 2 ? ownerPath[ownerPath.length - 2] : null;
        }
      }
      if (nextEditing !== cur) set({ editingViewOf: nextEditing });
      edit(undefined, (scene) => ({
        ...scene,
        objects: mapObject(scene.objects, objectId, (o) => ({ ...o, view: undefined })),
      }));
    },
    updateView: (objectId: string, patch: Partial<NonNullable<SceneObject['view']>>, key?: string) => {
      edit(key, (scene) => ({
        ...scene,
        objects: mapObject(scene.objects, objectId, (o) => (o.view ? { ...o, view: { ...o.view, ...patch } } : o)),
      }));
    },
  };
};

import { applyItemToObject, canOpenView, discoverObject, isUsable, pickupObject as pickupObj, tryEnterDoor } from '../../shared/game-logic';
import type { PlayerGet, PlayerSet } from './state';
import { lastRotateAt, viewObjs } from './state';
import { itemName } from './item-name';

export const createInteractionSlice = (set: PlayerSet, get: PlayerGet) => ({
  selectItem: (id: string | null) => set({ selectedItem: id }),

  clickObject: (objectId: string, viewId?: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene) return;
    const objs = viewObjs(scene, viewId);
    const obj = objs.find((o) => o.id === objectId);
    if (obj && !isUsable(g.session.state, obj, g.scenes)) {
      g.say(obj.unusableMessage || 'فعلاً قابل استفاده نیست');
      return;
    }
    // Doors take the player into another room (locked doors only show a message).
    if (obj?.door) {
      const rooms = Object.values(g.scenes).filter((sc) => sc.projectId === g.session!.projectId);
      const res = tryEnterDoor(g.session.state, obj, rooms);
      if (res) {
        if (res.message) g.say(res.message, 4000);
        if (res.entered) get().commit(res.newState);
      }
    }
    const res = discoverObject(g.session.state, viewId || scene.id, objectId, objs);
    if (res.grantsItem) g.say(`🎒 آیتم به دست آمد: ${itemName(objs, res.grantsItem)}`, 5000);
    else if (res.message) g.say(res.message);
    if (res.newState !== g.session.state) get().commit(res.newState);
  },

  /**
   * Try to open an object's close-up view. Uses the same deep lookup `clickObject` uses
   * (`viewObjs` → `viewObjects`), so it works for objects at any nesting depth.
   * Returns false (and shows the gate message) when the view cannot be opened right now.
   */
  tryOpenView: (objectId: string, viewId?: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene) return false;
    const objs = viewObjs(scene, viewId);
    const obj = objs.find((o) => o.id === objectId);
    if (!obj) return false;
    const res = canOpenView(g.session.state, obj, g.selectedItem);
    if (!res.ok) {
      g.say(res.message);
      return false;
    }
    // Remember that the view has been opened so it stays openable even if items are consumed later.
    const required = Array.from(
      new Set([...(obj.requiresItem ?? []), ...(obj.view?.requiresItem ?? [])])
    );
    const unlocked = (g.session.state.unlockedViews ?? []).includes(obj.id);
    if (required.length > 0 && !unlocked) {
      get().commit({
        ...g.session.state,
        unlockedViews: [...(g.session.state.unlockedViews ?? []), obj.id],
      });
    }
    set({ selectedItem: null });
    return true;
  },

  /**
   * One motion click: bump the object's rotation step counter. The renderer animates around the
   * pivot; position-gated rules re-evaluate through commit() → evaluateAutoTransforms.
   */
  rotateObject: (objectId: string, viewId?: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene) return;
    const objs = viewObjs(scene, viewId);
    const obj = objs.find((o) => o.id === objectId);
    if (!obj || !isUsable(g.session.state, obj, g.scenes)) return;
    const m = obj.motion;
    if (!m) return;
    const cur = g.session.state.motionSteps?.[objectId] ?? 0;
    // A non-toggle motion stops dead at maxSteps (e.g. a clock hand that cannot pass 12 clicks).
    if (!m.toggle && m.maxSteps !== undefined && cur >= m.maxSteps) return;
    // Anti double-click: ignore clicks while the previous rotation is still animating.
    const dur = Number.isFinite(m.duration) ? (m.duration as number) : 600;
    const last = lastRotateAt.get(objectId);
    if (last !== undefined && Date.now() - last < dur) return;
    if (m.message) g.say(m.message);
    lastRotateAt.set(objectId, Date.now());
    // commit() runs evaluateAutoTransforms itself — position conditions fire from the new step count.
    get().commit({ ...g.session.state, motionSteps: { ...(g.session.state.motionSteps ?? {}), [objectId]: cur + 1 } });
  },

  pickup: (objectId: string, viewId?: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene) return;
    const objs = viewObjs(scene, viewId);
    const obj = objs.find((o) => o.id === objectId);
    // Pickups can fire transition effects too (open doors, change other rooms…).
    const res = pickupObj(g.session.state, viewId || scene.id, objectId, objs, { scenesById: g.scenes });
    if (res.message) g.say(res.message);
    if (res.success) {
      get().commit(res.newState);
      // Trigger B: picking up a numpad sprite (trigger === 'pickup') opens the pad in pick mode
      // right after pickup. The sprite leaves the scene, so type mode is not offered here.
      if (obj?.numpad && obj.numpadTrigger === 'pickup') {
        get().openNumpad(objectId);
      }
    }
  },

  useItemOnObject: (itemId: string | null, objectId: string, viewId?: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene) return;
    const objs = viewObjs(scene, viewId);
    // Transform rules may carry effects that reach other objects/rooms — pass the whole project in.
    const res = applyItemToObject(g.session.state, viewId || scene.id, objectId, itemId, objs, { scenesById: g.scenes });
    if (res.message) g.say(res.message, res.success ? 5000 : 3000);
    if (res.success) {
      get().commit(res.newState);
      // numpad numbers are virtual items: keep the number selected so the player can reuse it
      set({ selectedItem: itemId && /^\d+$/.test(itemId) ? itemId : null });
    }
  },
});

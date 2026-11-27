import { applyItemToObject, tryEnterDoor, unfireLastNumeric } from '../../shared/game-logic';
import type { SessionState } from '../../shared/types';
import type { PlayerGet, PlayerSet } from './state';
import { viewObjs } from './state';

export const createNumpadSlice = (set: PlayerSet, get: PlayerGet) => ({
  openNumpad: (objectId: string, viewId?: string) =>
    set((s) => {
      const persisted = s.session?.state.numpadTyped?.[objectId] ?? [];
      return {
        numpadOpen: true,
        numpadObjectId: objectId,
        numpadViewId: viewId ?? null,
        selectedItem: null,
        numpadTyped: s.numpadObjectId === objectId ? s.numpadTyped : persisted.join(''),
      };
    }),

  closeNumpad: () => set({ numpadOpen: false, numpadObjectId: null, numpadViewId: null, selectedItem: null, numpadTyped: '' }),

  backspaceNumpad: () => {
    set((s) => ({ numpadTyped: s.numpadTyped.slice(0, -1) }));
    // Persist to session state so `displays` conditions can read live digits.
    const g = get();
    if (g.session && g.numpadObjectId) {
      const cur = [...(g.session.state.numpadTyped?.[g.numpadObjectId] ?? [])];
      cur.pop();
      get().commit({
        ...g.session.state,
        numpadTyped: { ...g.session.state.numpadTyped, [g.numpadObjectId]: cur },
      });
    }
  },

  /** Type mode with a code: each tap fills the next empty slot; when full, check the code. */
  typeNumpadDigit: (digit: string) => {
    const g = get();
    const scene = g.sceneOfCurrent();
    if (!g.session || !scene || !g.numpadObjectId) return;
    const obj = viewObjs(scene, g.numpadViewId ?? undefined).find((o) => o.id === g.numpadObjectId);
    const code = obj?.numpadCode;
    if (!obj || !code || g.numpadTyped.length >= code.length) return; // full = waiting for the check
    const typed = g.numpadTyped + digit;
    set({ numpadTyped: typed });

    // Persist each digit to session state so `displays` conditions can read live digits.
    const cur = g.session.state.numpadTyped?.[g.numpadObjectId] ?? [];
    get().commit({
      ...g.session.state,
      numpadTyped: { ...g.session.state.numpadTyped, [g.numpadObjectId]: [...cur, digit] },
    });

    if (typed.length < code.length) return;

    // let the last digit show for a moment, then check
    window.setTimeout(() => {
      const g2 = get();
      if (!g2.session || g2.numpadObjectId !== obj.id) return;
      if (typed !== code) {
        set({ numpadTyped: '' });
        g2.say('❌ رمز اشتباه است');
        return;
      }
      const sc = g2.sceneOfCurrent();
      if (!sc) return;
      const viewId = g2.numpadViewId ?? undefined;
      const objs = viewObjs(sc, viewId);
      const scope = viewId || sc.id;
      let s: SessionState = g2.session.state;

      // 1) Rules of the keypad that wait for this code (requiresItem = "158"):
      //    their effects can unlock the handle, swap a background, transform things, ...
      const res = applyItemToObject(s, scope, obj.id, code, objs, { scenesById: g2.scenes });
      if (res.success) {
        s = res.newState;
        g2.say(res.message, 5000);
      } else if (!obj.door) {
        g2.say(obj.message || '🔓 رمز درست است');
      }

      // 2) Remember the lock is solved (the pad won't reopen).
      const d = s.discoveredObjects[scope] ?? [];
      if (!d.includes(obj.id)) s = { ...s, discoveredObjects: { ...s.discoveredObjects, [scope]: [...d, obj.id] } };

      // 3) Optional: the keypad itself is a door.
      if (obj.door) {
        s = { ...s, openDoors: [...new Set([...(s.openDoors ?? []), obj.id])] };
        const rooms = Object.values(g2.scenes).filter((r) => r.projectId === g2.session!.projectId);
        const door = tryEnterDoor(s, obj, rooms);
        if (door?.entered) s = door.newState;
        if (door?.message) g2.say(door.message, 4000);
      }

      get().commit(s);
      get().closeNumpad();
    }, 350);
  },

  /** Append a digit to numpad `padId` up to `cells` slots (type mode). */
  typeDigit: (padId: string, digit: string, cells: number) => {
    const g = get();
    if (!g.session) return;
    const cur = [...(g.session.state.numpadTyped?.[padId] ?? [])];
    if (cur.length >= cells) return;
    cur.push(digit);
    get().commit({ ...g.session.state, numpadTyped: { ...(g.session.state.numpadTyped ?? {}), [padId]: cur } });
  },

  /** Remove the last filled cell of numpad `padId`. */
  backspaceDigit: (padId: string) => {
    const g = get();
    if (!g.session) return;
    const cur = (g.session.state.numpadTyped?.[padId] ?? []).slice(0, -1);
    get().commit({ ...g.session.state, numpadTyped: { ...(g.session.state.numpadTyped ?? {}), [padId]: cur } });
  },

  /** Undo the last fired numeric rule of numpad `objectId` (pick mode backspace). */
  undoNumpadDigit: (objectId: string) => {
    const g = get();
    if (!g.session || !g.scenes) return;
    const obj = g.scenes[g.session.state.currentSceneId]?.objects?.find((o) => o.id === objectId);
    if (!obj) return;
    const numeric = (obj.transforms ?? [])
      .map((r, i) => (typeof r.requiresItem === 'string' && /^\d+$/.test(r.requiresItem) ? i : -1))
      .filter((i) => i >= 0);
    const next = unfireLastNumeric(g.session.state, objectId, numeric);
    if (next !== g.session.state) get().commit(next);
  },
});

import { allObjectsDeep, viewObjects } from '../../shared/view-tree';
import type { Scene } from '../../shared/types';

export const PLAYER_KEY = 'escape-player-v2';

export type PlayerGet = () => PlayerState;
export type PlayerSet = (partial: PlayerState | Partial<PlayerState> | ((s: PlayerState) => PlayerState | Partial<PlayerState>)) => void;

export interface PlayerState {
  session: import('../../shared/types').Session | null;
  scenes: Record<string, Scene>;
  assets: Record<string, import('../../shared/types').Asset>;
  sprites: Record<string, import('../../shared/types').Sprite>;
  selectedItem: string | null;
  lockInput: string;
  numpadOpen: boolean;
  numpadObjectId: string | null;
  numpadViewId: string | null;
  numpadTyped: string;
  toast: string | null;

  loadFromStudio: () => void;
  startNewGame: (players?: import('../../shared/types').Player[]) => void;
  resetGame: () => void;
  setPlayerReady: (telegramId?: string) => void;
  selectItem: (id: string | null) => void;
  typeNumpadDigit: (digit: string) => void;
  backspaceNumpad: () => void;
  openNumpad: (objectId: string, viewId?: string) => void;
  closeNumpad: () => void;
  typeDigit: (padId: string, digit: string, cells: number) => void;
  backspaceDigit: (padId: string) => void;
  undoNumpadDigit: (objectId: string) => void;
  setToast: (t: string | null) => void;
  switchScene: (id: string) => void;
  clickObject: (objectId: string, viewId?: string) => void;
  tryOpenView: (objectId: string, viewId?: string) => boolean;
  rotateObject: (objectId: string, viewId?: string) => void;
  pickup: (objectId: string, viewId?: string) => void;
  useItemOnObject: (itemId: string | null, objectId: string, viewId?: string) => void;
  enterLockDigit: (d: string) => void;
  clearLockDigit: () => void;
  submitLock: () => void;
  // helpers (bound in createPlayerHelpers)
  say: (message: string | null | undefined, ms?: number) => void;
  commit: (next: import('../../shared/types').SessionState) => void;
  sceneOfCurrent: () => Scene | undefined;
}

let toastTimer: number | undefined;

/** objectId → timestamp of the last rotation click. Guards against double-clicks mid-animation. */
export const lastRotateAt = new Map<string, number>();

/** Objects of the scene, or of the close-up view owned by `viewId` (the owner is looked up at any depth). */
export const viewObjs = (scene: Scene, viewId?: string): Scene['objects'] => viewObjects(scene, viewId ?? '');

/** All object ids in a scene (every nesting level) or in the close-up view owned by `viewId`. */
export function scopeIds(scene: Scene, viewId?: string): Set<string> {
  if (viewId) return new Set(viewObjects(scene, viewId).map((o) => o.id));
  return new Set(allObjectsDeep(scene.objects).map((o) => o.id));
}

/**
 * Strip discovered ids that no longer exist in the (edited) project.
 * Discoveries are keyed by scene id (room objects) OR by the parent object id (objects inside a close-up view);
 * the latter used to be dropped on every resume because only scene ids were recognised.
 */
export function pruneDiscovered(scenes: Record<string, Scene>, discovered: Record<string, string[]>): Record<string, string[]> {
  const viewScopes = new Map<string, Set<string>>();
  for (const sc of Object.values(scenes)) {
    viewScopes.set(sc.id, new Set(allObjectsDeep(sc.objects).map((o) => o.id)));
    for (const o of allObjectsDeep(sc.objects)) {
      if (o.view) viewScopes.set(o.id, new Set(o.view.objects.map((v) => v.id)));
    }
  }
  const out: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(discovered)) {
    const scene = scenes[key];
    const valid = scene ? scopeIds(scene) : viewScopes.get(key);
    if (!valid) continue;
    const kept = ids.filter((id) => valid.has(id));
    if (kept.length) out[key] = kept;
  }
  return out;
}

export const persistPlayer = (s: PlayerState) => {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ session: s.session }));
  } catch {}
};

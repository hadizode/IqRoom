import { type SessionState } from '../../shared/types';
import { evaluateAutoTransforms } from '../../shared/game-logic';
import type { PlayerGet, PlayerSet } from './state';
import { persistPlayer } from './state';

export interface PlayerHelpers {
  say: (message: string | null | undefined, ms?: number) => void;
  commit: (next: SessionState) => void;
  sceneOfCurrent: () => import('../../shared/types').Scene | undefined;
}

let toastTimer: number | undefined;

export function createPlayerHelpers(set: PlayerSet, get: PlayerGet): PlayerHelpers {
  const say = (message: string | null | undefined, ms = 4000) => {
    window.clearTimeout(toastTimer);
    set({ toast: message ?? null });
    if (message) toastTimer = window.setTimeout(() => set({ toast: null }), ms);
  };
  /**
   * Commit a new session state: run the instant (autoApply) transform pass so chained rules
   * cascade on every state change, surface any rule messages as toasts, and persist.
   */
  const commit = (next: SessionState) => {
    const g = get();
    if (!g.session) return;
    let s = next;
    const msgs: string[] = [];
    if (g.scenes && Object.keys(g.scenes).length) {
      const res = evaluateAutoTransforms(s, g.scenes);
      s = res.state;
      msgs.push(...res.messages);
    }
    // Close the numpad overlay whenever the player changes room so it never
    // stays flagged open or reappears after coming back.
    const sceneChanged = g.session.state.currentSceneId !== s.currentSceneId;
    set({
      session: { ...g.session, state: s },
      ...(sceneChanged
        ? {
            numpadOpen: false,
            numpadObjectId: null,
            numpadViewId: null,
            selectedItem: null,
            numpadTyped: '',
          }
        : {}),
    });
    persistPlayer(get());
    for (const m of msgs) say(m, 5000);
  };

  const sceneOfCurrent = () => {
    const g = get();
    const sid = g.session?.state.currentSceneId;
    return sid ? g.scenes[sid] : undefined;
  };

  return { say, commit, sceneOfCurrent };
}

import { allRoomsComplete, validateFinalLock } from '../../shared/game-logic';
import type { PlayerGet, PlayerSet } from './state';
import { persistPlayer } from './state';

export const createLockSlice = (set: PlayerSet, get: PlayerGet) => ({
  enterLockDigit: (d: string) => {
    const g = get();
    const maxLen = Math.max(1, Object.keys(g.scenes).length);
    if (g.lockInput.length >= maxLen) return;
    set({ lockInput: g.lockInput + d });
  },
  clearLockDigit: () => set((s) => ({ lockInput: s.lockInput.slice(0, -1) })),

  submitLock: () => {
    const g = get();
    if (!g.session) return;
    const list = Object.values(g.scenes).filter((sc) => sc.projectId === g.session!.projectId);
    if (!allRoomsComplete(g.session.state, list)) {
      g.say('هنوز همه اتاق‌ها کامل نشده‌اند!');
      return;
    }
    const res = validateFinalLock(g.session.state, list, g.lockInput);
    g.say(res.message, 6000);
    if (res.valid) {
      set({ session: { ...g.session, complete: true } });
      persistPlayer(get());
    }
  },
});

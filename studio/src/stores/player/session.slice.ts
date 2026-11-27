import { createSessionState, type Player, type Session, type SessionState } from '../../shared/types';
import { uid } from '../../shared/utils';
import { useStudioStore } from '../studio';
import type { PlayerGet, PlayerSet } from './state';
import { PLAYER_KEY, lastRotateAt, persistPlayer, pruneDiscovered } from './state';

export const createSessionSlice = (set: PlayerSet, get: PlayerGet) => ({
  /** Load the current project from the studio store (live, unsaved edits included). */
  loadFromStudio: () => {
    const st = useStudioStore.getState();
    const project = st.projects.find((p) => p.id === st.currentProjectId);
    if (!project) return;
    const scenes = Object.fromEntries(project.scenes.map((id) => [id, st.scenes[id]]).filter(([, s]) => !!s));
    let saved: { session: Session | null } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
    } catch {}
    const resume = !!saved?.session && saved.session.projectId === project.id && saved.session.started;
    const first = project.scenes[0];
    // Merge over fresh defaults so older saves missing newer fields (e.g. transformsApplied) don't crash.
    const base: SessionState = resume && saved?.session
      ? {
          ...createSessionState(first),
          ...saved.session.state,
          currentSceneId: scenes[saved.session.state.currentSceneId] ? saved.session.state.currentSceneId : first,
        }
      : createSessionState(first);
    const session: Session = {
      id: uid('sess'),
      projectId: project.id,
      token: `local-${project.id}`,
      players: [
        { telegramId: 'you', name: 'شما', online: true, ready: resume },
        { telegramId: 'bot-demo', name: 'هم‌تیمی (دمو)', online: false, ready: resume },
      ],
      started: resume ? saved!.session!.started : false,
      complete: resume ? saved!.session!.complete : false,
      state: { ...base, discoveredObjects: pruneDiscovered(scenes, base.discoveredObjects) },
    };
    set({ session, scenes, assets: st.assets, sprites: st.sprites, selectedItem: null, lockInput: '', toast: null });
  },

  startNewGame: (players?: Player[]) => {
    const g = get();
    const first = Object.keys(g.scenes)[0];
    if (!g.session || !first) return;
    set({
      session: {
        ...g.session,
        started: true,
        complete: false,
        players: players ?? g.session.players.map((p) => ({ ...p, ready: true })),
        state: createSessionState(first),
      },
      selectedItem: null,
      lockInput: '',
      numpadOpen: false,
      numpadObjectId: null,
      numpadViewId: null,
    });
    persistPlayer(get());
    get().say('بازی شروع شد! موفق باشید 🎮');
  },

  resetGame: () => {
    const g = get();
    lastRotateAt.clear();
    try { localStorage.removeItem(PLAYER_KEY); } catch {}
    // Always read fresh studio data (live, unsaved edits included) — never a stale snapshot.
    const st = useStudioStore.getState();
    const project = st.projects.find((p) => p.id === (g.session?.projectId ?? st.currentProjectId));
    if (!project) return;
    const scenes = Object.fromEntries(
      project.scenes.map((id) => [id, st.scenes[id]]).filter(([, s]) => !!s)
    );
    const first = project.scenes[0];
    set({
      scenes,
      assets: st.assets,
      sprites: st.sprites,
      selectedItem: null,
      lockInput: '',
      toast: null,
      numpadOpen: false,
      numpadObjectId: null,
      numpadViewId: null,
      session: {
        id: uid('sess'),
        projectId: project.id,
        token: `local-${project.id}`,
        players: [
          { telegramId: 'you', name: 'شما', online: true, ready: false },
          { telegramId: 'bot-demo', name: 'هم‌تیمی (دمو)', online: false, ready: false },
        ],
        started: false,
        complete: false,
        state: createSessionState(first),
      },
    });
  },

  setPlayerReady: (telegramId = 'you') => {
    const g = get();
    if (!g.session) return;
    const players = g.session.players.map((p) => (p.telegramId === telegramId ? { ...p, ready: true } : p));
    set({ session: { ...g.session, players } });
    if (players.every((p) => p.ready)) {
      get().startNewGame(players);
    } else {
      get().say('آماده شدید! منتظر هم‌تیمی‌ها بمانید…');
    }
  },

  switchScene: (id: string) => {
    const g = get();
    if (!g.session || !g.scenes[id]) return;
    get().commit({ ...g.session.state, currentSceneId: id });
    set({ numpadOpen: false, numpadObjectId: null, numpadViewId: null, selectedItem: null });
  },
});

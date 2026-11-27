import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SEED_ASSETS, SEED_PROJECT, SEED_SCENES, SEED_SPRITES } from '../../shared/seed-data';
import { idbStorage } from '../../shared/idb';
import type { StudioState } from './state';
import { createStudioHelpers } from './helpers';
import { migratePersisted } from './migration';
import { createProjectSlice } from './project.slice';
import { createSceneSlice } from './scene.slice';
import { createObjectSlice } from './object.slice';
import { createAssetSlice } from './asset.slice';

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => {
      const helpers = createStudioHelpers(set, get);
      return {
        hydrated: false,
        projects: [SEED_PROJECT],
        scenes: Object.fromEntries(SEED_SCENES.map((s) => [s.id, s])),
        assets: Object.fromEntries(SEED_ASSETS.map((a) => [a.id, a])),
        sprites: Object.fromEntries(SEED_SPRITES.map((sp) => [sp.id, sp])),
        screen: 'projects',
        currentProjectId: null,
        currentSceneId: null,
        editingViewOf: null,
        selectedObjectIds: [],
        clipboard: [],
        showGrid: true,
        gridSize: 20,
        snapToGrid: false,
        showLabels: true,
        past: [],
        future: [],

        markHydrated: () => set({ hydrated: true }),

        ...helpers,
        ...createProjectSlice(set, get),
        ...createSceneSlice(set, get),
        ...createObjectSlice(set, get),
        ...createAssetSlice(set, get),
      };
    },
    {
      name: 'escape-studio-v2',
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ projects: s.projects, scenes: s.scenes, assets: s.assets, sprites: s.sprites }),
      migrate: (persistedState: any) => migratePersisted(persistedState ?? {}),
      // If rehydration throws (corrupt/incompatible saved data) `state` is undefined — never leave the app stuck on "Loading…".
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.warn('Studio rehydrate failed, starting from defaults', error);
          setTimeout(() => useStudioStore.setState({ hydrated: true }), 0);
          return;
        }
        state.markHydrated();
      },
    }
  )
);

// Safety net: `hydrated` is normally flipped by onRehydrateStorage above, but if
// persistence ever hangs or throws before that callback fires (corrupt IndexedDB,
// private browsing, storage quota…), the app would be stuck forever on
// "در حال بارگذاری…" — which looks exactly like a blank page. Force-hydrate
// shortly after startup so the UI always renders from the default/seed state.
setTimeout(() => {
  if (!useStudioStore.getState().hydrated) {
    console.warn('Studio hydration did not complete in time; continuing with defaults.');
    useStudioStore.setState({ hydrated: true });
  }
}, 1500);

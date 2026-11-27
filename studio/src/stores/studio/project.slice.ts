import { cloneScene, createScene, normalizeBundle, type Project, type ProjectBundle, type Scene } from '../../shared/types';
import { sceneRefs, sceneUrls } from '../../shared/validation';
import { nowIso, uid } from '../../shared/utils';
import type { StudioGet, StudioSet } from './helpers';
import { recompute } from './migration';

export const createProjectSlice = (set: StudioSet, get: StudioGet) => ({
  // ---------- projects ----------
  createProject: (name: string, description: string) => {
    const id = uid('proj');
    const scene = createScene(id, 'Room 1');
    const project: Project = {
      id,
      name,
      description,
      scenes: [scene.id],
      finalLockDigits: '0',
      assets: [],
      sprites: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((s) => ({ projects: [...s.projects, project], scenes: { ...s.scenes, [scene.id]: scene } }));
    return id;
  },

  deleteProject: (id: string) =>
    set((s) => {
      const project = s.projects.find((p) => p.id === id);
      if (!project) return {};
      const scenes = { ...s.scenes };
      project.scenes.forEach((sid) => delete scenes[sid]);
      const projects = s.projects.filter((p) => p.id !== id);
      const stillUsed = new Set(projects.flatMap((p) => p.assets));
      const assets = { ...s.assets };
      project.assets.forEach((aid) => !stillUsed.has(aid) && delete assets[aid]);
      return { projects, scenes, assets, past: [], future: [] };
    }),

  duplicateProject: (id: string) =>
    set((s) => {
      const src = s.projects.find((p) => p.id === id);
      if (!src) return {};
      const pid = uid('proj');
      const copies = src.scenes.map((sid) => s.scenes[sid]).filter(Boolean).map((sc) => cloneScene(sc, pid, sc.title));
      const project: Project = {
        ...src,
        id: pid,
        name: `${src.name} (copy)`,
        scenes: copies.map((c) => c.id),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      return {
        projects: [...s.projects, project],
        scenes: { ...s.scenes, ...Object.fromEntries(copies.map((c) => [c.id, c])) },
      };
    }),

  updateProject: (patch: Partial<Pick<Project, 'name' | 'description'>>) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === s.currentProjectId ? { ...p, ...patch, updatedAt: nowIso() } : p)),
    })),

  selectProject: (id: string) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    set({
      screen: 'editor',
      currentProjectId: id,
      currentSceneId: p.scenes.find((sid) => get().scenes[sid]) ?? null,
      editingViewOf: null,
      selectedObjectIds: [],
      past: [],
      future: [],
    });
  },

  closeProject: () => set({ screen: 'projects', currentProjectId: null, currentSceneId: null, editingViewOf: null, selectedObjectIds: [] }),

  exportBundle: () => {
    const { currentProjectId, projects, scenes, assets, sprites } = get();
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return '';
    const sc = project.scenes.map((id) => scenes[id]).filter(Boolean);
    const used = new Set<string>(project.assets);
    sc.flatMap(sceneUrls).forEach((u) => u.startsWith('asset:') && used.add(u.slice(6)));
    const spriteIds = new Set<string>(project.sprites);
    sc.forEach((s) => sceneRefs(s).forEach((r) => r.startsWith('sprite:') && spriteIds.add(r.slice(7))));
    // assets referenced by exported sprites must travel with the bundle too
    spriteIds.forEach((sid) => {
      const a = sprites[sid]?.assetId;
      if (a && a.startsWith('asset:')) used.add(a.slice(6));
    });
    const bundle: ProjectBundle = {
      format: 'escape-studio',
      version: 3,
      project: recompute(project, scenes),
      scenes: sc,
      assets: [...used].map((id) => assets[id]).filter(Boolean),
      sprites: [...spriteIds].map((id) => sprites[id]).filter(Boolean),
    };
    return JSON.stringify(bundle, null, 2);
  },

  importBundle: (text: string) => {
    let b: ProjectBundle;
    try {
      b = normalizeBundle(text);
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
    const st = get();
    let { project, scenes } = b;
    const bundleSprites = Object.fromEntries(b.sprites.map((sp) => [sp.id, sp]));
    if (st.projects.some((p) => p.id === project.id) || scenes.some((sc) => st.scenes[sc.id])) {
      const pid = uid('proj');
      // cloneScene only remaps object ids — sprite/asset refs stay shared, so the bundle sprites can be merged as-is.
      scenes = scenes.map((sc) => cloneScene(sc, pid, sc.title));
      project = { ...project, id: pid, name: `${project.name} (imported)`, scenes: scenes.map((sc) => sc.id) };
    }
    set((s) => ({
      projects: [...s.projects, project],
      scenes: { ...s.scenes, ...Object.fromEntries(scenes.map((sc) => [sc.id, sc])) },
      assets: { ...Object.fromEntries(b.assets.map((a) => [a.id, a])), ...s.assets },
      sprites: { ...bundleSprites, ...s.sprites },
    }));
    return { ok: true as const };
  },
});

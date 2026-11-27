import { createSprite, spriteRef, SpriteRegistry, type Asset, type Sprite } from '../../shared/types';
import { countAssetUsage, sceneRefs } from '../../shared/validation';
import { nowIso, uid, type LoadedImage } from '../../shared/utils';
import type { StudioGet, StudioSet } from './helpers';
import type { StudioState } from './state';

export const createAssetSlice = (set: StudioSet, get: StudioGet) => ({
  // ---------- assets ----------
  addAsset: (img: LoadedImage): Asset => {
    const asset: Asset = { id: uid('asset'), name: img.name, url: img.url, width: img.width, height: img.height, createdAt: nowIso() };
    set((s) => ({
      assets: { ...s.assets, [asset.id]: asset },
      projects: s.projects.map((p) => (p.id === s.currentProjectId ? { ...p, assets: [...p.assets, asset.id] } : p)),
    }));
    return asset;
  },
  deleteAsset: (id: string) => {
    const s = get();
    const usedBy = countAssetUsage(id, s.assets, s.sprites, s.scenes);
    if (usedBy > 0) return { ok: false as const, usedBy };
    const aref = `asset:${id}`;
    const orphanSprites = Object.entries(s.sprites)
      .filter(([, sp]) => sp.assetId === aref)
      .filter(([sid]) => !Object.values(s.scenes).some((sc) => sceneRefs(sc).includes(spriteRef(sid))))
      .map(([sid]) => sid);
    set((st) => {
      const assets = { ...st.assets };
      delete assets[id];
      const sprites = { ...st.sprites };
      for (const sid of orphanSprites) delete sprites[sid];
      return {
        assets,
        sprites,
        projects: st.projects.map((p) => ({ ...p, assets: p.assets.filter((a) => a !== id) })),
      };
    });
    return { ok: true as const };
  },

  // ---------- sprites ----------
  useAssetSprite: (ref: string, name?: string) => {
    const s = get();
    // Direct URL (not an asset ref) → wrap in a sprite via the registry.
    if (!ref.startsWith('asset:') && !ref.startsWith('sprite:')) {
      const reg = new SpriteRegistry(s.assets, name ?? '');
      const r = reg.register(ref);
      get().addSprites(reg.list());
      return r;
    }
    const existing = Object.values(s.sprites).find((sp) => sp.assetId === ref);
    if (existing) return spriteRef(existing.id);
    const sp = createSprite(name ?? 'sprite', ref);
    get().addSprites([sp]);
    return spriteRef(sp.id);
  },
  updateSprite: (id: string, patch: Partial<Sprite>) =>
    set((s) => (s.sprites[id] ? { sprites: { ...s.sprites, [id]: { ...s.sprites[id], ...patch } } } : {})),
  addSprite: (sp: Sprite) => {
    get().addSprites([sp]);
    return sp;
  },

  // ---------- ui ----------
  toggleGrid: () => set((s: StudioState) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s: StudioState) => ({ snapToGrid: !s.snapToGrid })),
  toggleLabels: () => set((s: StudioState) => ({ showLabels: !s.showLabels })),
  setGridSize: (n: number) => set({ gridSize: Math.max(5, Math.round(n)) }),

  // ---------- history ----------
  undo: () => get().restore('past'),
  redo: () => get().restore('future'),
});

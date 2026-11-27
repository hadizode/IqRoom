import { computeFinalLock, migrateTwoState, normalizeScene, type Asset, type Project, type Scene, type Sprite } from '../../shared/types';
import { SpriteRegistry } from '../../shared/types';
import { sceneRefs } from '../../shared/validation';

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom' | 'hdist' | 'vdist';
export type OrderMode = 'up' | 'down' | 'top' | 'bottom';

export interface Snap {
  sceneId: string;
  scene: Scene;
}

export const recompute = (p: Project, scenes: Record<string, Scene>): Project => ({
  ...p,
  finalLockDigits: computeFinalLock(p.scenes, scenes),
});

export type PersistedData = { projects: Project[]; scenes: Record<string, Scene>; assets: Record<string, Asset>; sprites: Record<string, Sprite> };

/**
 * Migrate data that was persisted BEFORE the sprite system existed
 * (objects/layers used `imageUrl`, transforms used `newImageUrl`, projects had no `sprites`).
 * Without this, old saved projects render as a blank editor because every ref is missing.
 */
export function migratePersisted(raw: any): PersistedData {
  const projects: Project[] = Array.isArray(raw?.projects) ? raw.projects : [];
  const sceneList: Scene[] = Object.values((raw?.scenes ?? {}) as Record<string, Scene>);
  // Merge legacy "two state" sprite data into transform rules before normalizing — nothing is lost on reload.
  migrateTwoState(sceneList);
  const assets: Record<string, Asset> = { ...(raw?.assets ?? {}) };
  let sprites: Record<string, Sprite> = { ...(raw?.sprites ?? {}) };

  // NOTE: never use the `in` operator on a possibly-string value (it throws a TypeError).
  const sceneIsLegacy = (s: any): boolean =>
    !!s &&
    ((typeof s.backgroundUrl === 'string' && s.backgroundUrl !== '' && !s.backgroundUrl.startsWith('sprite:')) ||
      (s.objects ?? []).some(
        (o: any) => o && typeof o === 'object' && ('imageUrl' in o || (o.transforms ?? []).some((t: any) => t && typeof t === 'object' && 'newImageUrl' in t))
      ) ||
      (s.backgroundLayers ?? []).some((l: any) => l && typeof l === 'object' && 'imageUrl' in l));

  const looksLegacy = sceneList.some(sceneIsLegacy) || projects.some((p) => !(p as any).sprites);

  if (looksLegacy) {
    const reg = new SpriteRegistry(assets);
    const scenes2: Record<string, Scene> = {};
    for (const sc of sceneList) {
      if (!sc) continue;
      const migrated = normalizeScene(sc, sc.projectId ?? '', reg);
      scenes2[migrated.id] = migrated;
    }
    const byId: Record<string, Sprite> = { ...sprites };
    reg.list().forEach((sp) => (byId[sp.id] = sp));
    sprites = byId;
    // Assets created by the registry while normalizing (direct URLs imported into the library)
    // must be added to each project's asset list, otherwise migrated projects show an empty
    // Assets panel and the sprite picker dropdown shows blank.
    const projects2 = projects.map((p) => {
      const ownScenes = Object.values(scenes2).filter((sc) => sc.projectId === p.id);
      const ownSprites = ownScenes.flatMap(sceneRefs);
      const ownAssets = ownSprites
        .map((ref) => byId[ref.startsWith('sprite:') ? ref.slice(7) : '']?.assetId ?? '')
        .filter((aref) => aref.startsWith('asset:') && assets[aref.slice(6)])
        .map((aref) => aref.slice(6));
      return { ...p, sprites: [...new Set([...((p as any).sprites ?? []), ...ownSprites])], assets: [...new Set([...((p as any).assets ?? []), ...ownAssets])] };
    });
    return { projects: projects2, scenes: scenes2, assets, sprites };
  }

  // Already sprite-based — just make sure shapes are complete.
  const scenes2: Record<string, Scene> = {};
  const reg = new SpriteRegistry(assets);
  for (const sc of sceneList) {
    if (!sc) continue;
    scenes2[sc.id] = normalizeScene(sc, sc.projectId ?? '', reg);
  }
  // Keep sprites (and assets) created during normalization — dropping them loses images.
  reg.list().forEach((sp) => (sprites[sp.id] = sp));
  const projects2 = projects.map((p) => ({ ...p, sprites: (p as any).sprites ?? [] }));
  return { projects: projects2, scenes: scenes2, assets, sprites };
}

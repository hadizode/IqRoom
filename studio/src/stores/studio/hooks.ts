import { useMemo } from 'react';
import type { Asset, Project, Scene, Sprite } from '../../shared/types';
import { resolveSprite } from '../../shared/types';
import { useStudioStore } from './index';
import { getContext, type EditContext } from './context';

// ============ Hooks ============
export function useScene(): Scene | undefined {
  return useStudioStore((s) => (s.currentSceneId ? s.scenes[s.currentSceneId] : undefined));
}

export function useCtx(): EditContext | null {
  const scene = useScene();
  const viewOf = useStudioStore((s) => s.editingViewOf);
  return useMemo(() => getContext(scene, viewOf), [scene, viewOf]);
}

export function useCurrentProject(): Project | undefined {
  return useStudioStore((s) => s.projects.find((p) => p.id === s.currentProjectId));
}

export function useProjectAssets(): Asset[] {
  const assets = useStudioStore((s) => s.assets);
  const ids = useStudioStore((s) => s.projects.find((p) => p.id === s.currentProjectId)?.assets);
  return useMemo(() => (ids ?? []).map((id) => assets[id]).filter(Boolean), [assets, ids]);
}

/** All sprites known to the studio store (global registry). */
export function useSprites(): Record<string, Sprite> {
  return useStudioStore((s) => s.sprites);
}

/** Resolve a sprite ref (`sprite:<id>`) or asset ref / direct URL to a concrete image URL ('' when none). */
export function useSpriteSrc(ref: string | undefined): string {
  const assets = useStudioStore((s) => s.assets);
  const sprites = useStudioStore((s) => s.sprites);
  return useMemo(() => (ref ? resolveSprite(ref, sprites, assets) : ''), [ref, sprites, assets]);
}

/** The Sprite object behind a ref (undefined for direct URLs / missing / blank). */
export function useSpriteOf(ref: string | undefined): Sprite | undefined {
  const sprites = useStudioStore((s) => s.sprites);
  return useMemo(() => (ref ? sprites[ref.replace(/^sprite:/, '')] : undefined), [ref, sprites]);
}

export { useStudioStore };

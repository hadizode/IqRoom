import { findObject, mapObject } from '../../shared/view-tree';
import type { BackgroundLayer, Scene, SceneObject, View } from '../../shared/types';

// ============ Context helpers (scene or the view being edited) ============
export interface EditContext {
  objects: SceneObject[];
  width: number;
  height: number;
  backgroundUrl: string;
  layers: BackgroundLayer[];
  view?: View;
}

export function getContext(scene: Scene | undefined, viewOf: string | null): EditContext | null {
  if (!scene) return null;
  const view = viewOf ? findObject(scene.objects, viewOf)?.view : undefined;
  if (view) {
    return { objects: view.objects, width: view.width, height: view.height, backgroundUrl: view.backgroundUrl, layers: [], view };
  }
  return { objects: scene.objects, width: scene.width, height: scene.height, backgroundUrl: scene.backgroundUrl, layers: scene.backgroundLayers };
}

export const setObjectsIn = (scene: Scene, viewOf: string | null, objects: SceneObject[]): Scene => {
  if (!viewOf) return { ...scene, objects };
  return {
    ...scene,
    objects: mapObject(scene.objects, viewOf, (o) => (o.view ? { ...o, view: { ...o.view, objects } } : o)),
  };
};

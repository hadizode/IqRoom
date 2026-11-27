import type { Asset, Project, Scene, SceneObject, Sprite, View } from '../../shared/types';
import type { LoadedImage } from '../../shared/utils';
import type { AlignMode, OrderMode, Snap } from './migration';

export interface StudioState {
  hydrated: boolean;
  projects: Project[];
  scenes: Record<string, Scene>;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  screen: 'projects' | 'editor';
  currentProjectId: string | null;
  currentSceneId: string | null;
  editingViewOf: string | null;
  selectedObjectIds: string[];
  clipboard: SceneObject[];
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showLabels: boolean;
  past: Snap[];
  future: Snap[];

  markHydrated: () => void;
  // projects
  createProject: (name: string, description: string) => string;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  updateProject: (patch: Partial<Pick<Project, 'name' | 'description'>>) => void;
  selectProject: (id: string) => void;
  closeProject: () => void;
  exportBundle: () => string;
  importBundle: (text: string) => { ok: true } | { ok: false; error: string };
  // scenes
  selectScene: (id: string) => void;
  addScene: (title?: string) => void;
  deleteScene: (id: string) => void;
  moveScene: (id: string, dir: -1 | 1) => void;
  duplicateScene: (id: string) => void;
  updateScene: (patch: Partial<Scene>, key?: string) => void;
  setBackground: (url: string, w: number, h: number) => void;
  // objects — every object is one unified sprite; behavior comes from its properties/rules
  addObject: (patch?: Partial<SceneObject>) => string;
  addObjectFromAsset: (assetId: string, cx?: number, cy?: number) => void;
  updateObject: (id: string, patch: Partial<SceneObject>, key?: string) => void;
  updateObjects: (patches: Record<string, Partial<SceneObject>>, key?: string) => void;
  deleteObjects: (ids: string[]) => void;
  selectObject: (id: string, multi?: boolean) => void;
  selectObjects: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  copySelected: () => void;
  paste: () => void;
  duplicateSelected: () => void;
  nudge: (dx: number, dy: number) => void;
  orderObjects: (ids: string[], mode: OrderMode) => void;
  alignObjects: (mode: AlignMode) => void;
  // views
  enterView: (objectId: string) => void;
  exitView: () => void;
  addView: (objectId: string) => boolean;
  removeView: (objectId: string) => void;
  updateView: (objectId: string, patch: Partial<View>, key?: string) => void;
  // assets
  addAsset: (img: LoadedImage) => Asset;
  deleteAsset: (id: string) => { ok: true } | { ok: false; usedBy: number };
  /** Returns the sprite ref (`sprite:<id>`) to assign to an object. Reuses a sprite that already points at this asset. */
  useAssetSprite: (assetIdOrRef: string, name?: string) => string;
  updateSprite: (id: string, patch: Partial<Sprite>) => void;
  addSprite: (sp: Sprite) => Sprite;
  // ui
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleLabels: () => void;
  setGridSize: (n: number) => void;
  // history
  undo: () => void;
  redo: () => void;
  // helpers (bound in createStudioHelpers)
  addSprites: (list: Sprite[]) => void;
  pushHistory: (sceneId: string, key?: string) => void;
  commitScene: (sceneId: string, scene: Scene) => void;
  edit: (key: string | undefined, fn: (scene: Scene) => Scene) => boolean;
  editObjects: (key: string | undefined, fn: (o: SceneObject[]) => SceneObject[]) => boolean;
  restore: (from: 'past' | 'future') => void;
}

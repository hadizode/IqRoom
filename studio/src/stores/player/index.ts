import { create } from 'zustand';
import type { PlayerGet, PlayerSet, PlayerState } from './state';
import { createPlayerHelpers } from './helpers';
import { createSessionSlice } from './session.slice';
import { createInteractionSlice } from './interactions.slice';
import { createNumpadSlice } from './numpad.slice';
import { createLockSlice } from './lock.slice';

export type { PlayerState, PlayerGet, PlayerSet } from './state';
export { scopeIds, viewObjs, lastRotateAt } from './state';
export { itemName } from './item-name';


export const usePlayerStore = create<PlayerState>()((set, get) => {
  const helpers = createPlayerHelpers(set, get);
  return {
    session: null,
    scenes: {},
    assets: {},
    sprites: {},
    selectedItem: null,
    lockInput: '',
    numpadOpen: false,
    numpadObjectId: null,
    numpadViewId: null,
    numpadTyped: '',
    toast: null,

    ...helpers,
    ...createSessionSlice(set, get),
    ...createInteractionSlice(set, get),
    ...createNumpadSlice(set, get),
    ...createLockSlice(set, get),
    setToast: helpers.say,
  };
});

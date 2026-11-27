import type { SceneObject } from '../../shared/types';

/** Human-readable item name: prefer the object that grants it, else fallback table. */
const ITEM_NAMES: Record<string, string> = {
  'key-gold': '🔑 کلید طلایی',
  'key-small': '🔑 کلید کوچک',
  'digit-7': '🔢 عدد ۷',
  'digit-3': '🔢 عدد ۳',
  'wire-cutter': '🔧 سیم‌چین',
};

export function itemName(objects: SceneObject[], id: string): string {
  // Pickup items live in the inventory keyed by their item id (`pickupItemId`, falling back to the object id).
  const picked = objects.find((o) => o.pickupable && (o.pickupItemId || o.id) === id);
  if (picked) return `🎒 ${picked.name}`;
  const granter = objects.find((o) => o.grantsItem === id || o.pickupItemId === id);
  if (granter) return `🎒 ${granter.name}`;
  return ITEM_NAMES[id] || `🎒 ${id}`;
}

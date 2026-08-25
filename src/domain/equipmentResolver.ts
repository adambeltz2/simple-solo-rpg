import type { ChoiceOption } from '../data/srdTypes';
import { byIndex, equipment } from '../data/srd';
import type { InventoryItem } from './character';
import { createId } from './character';

export interface ResolvedEquipment {
  items: InventoryItem[];
  gold: number;
}

function itemFromEquipmentIndex(index: string, name: string, count: number): InventoryItem {
  const eq = byIndex(equipment, index);
  const isArmor = !!eq?.armor_class;
  const isShield = eq?.armor_category === 'Shield' || /shield/i.test(name);
  return {
    id: createId(),
    name,
    quantity: count,
    weight: eq?.weight,
    equipped: false,
    isArmor,
    isShield,
    armorBase: eq?.armor_class?.base,
    armorDexBonus: eq?.armor_class?.dex_bonus,
    armorMaxBonus: eq?.armor_class?.max_bonus,
  };
}

export function resolveOption(option: ChoiceOption): ResolvedEquipment {
  const result: ResolvedEquipment = { items: [], gold: 0 };
  if ('money' in option) {
    const match = option.money.match(/(\d+)\s*gp/i);
    if (match) result.gold += parseInt(match[1], 10);
    return result;
  }
  if ('multiple' in option) {
    for (const sub of option.multiple) {
      const resolved = resolveOption(sub);
      result.items.push(...resolved.items);
      result.gold += resolved.gold;
    }
    return result;
  }
  result.items.push(itemFromEquipmentIndex(option.index, option.name, option.count ?? 1));
  return result;
}

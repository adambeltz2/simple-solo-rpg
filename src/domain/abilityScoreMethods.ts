import type { AbilityKey, Abilities } from './character';
import { ABILITY_KEYS } from './character';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};
export const POINT_BUY_BUDGET = 27;

export function pointBuyCost(abilities: Abilities): number {
  return ABILITY_KEYS.reduce((sum, key) => sum + (POINT_BUY_COST[abilities[key]] ?? 99), 0);
}

export function emptyAbilities(base = 8): Abilities {
  return { str: base, dex: base, con: base, int: base, wis: base, cha: base };
}

export type AbilityMethod = 'standard-array' | 'point-buy' | 'manual';

export function distributeAbilityBonus(
  choice: 'two-one' | 'one-one-one',
  picks: AbilityKey[],
): Partial<Record<AbilityKey, number>> {
  const bonuses: Partial<Record<AbilityKey, number>> = {};
  if (choice === 'two-one') {
    if (picks[0]) bonuses[picks[0]] = (bonuses[picks[0]] ?? 0) + 2;
    if (picks[1]) bonuses[picks[1]] = (bonuses[picks[1]] ?? 0) + 1;
  } else {
    for (const p of picks.slice(0, 3)) bonuses[p] = (bonuses[p] ?? 0) + 1;
  }
  return bonuses;
}

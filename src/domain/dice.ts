export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export function rollDie(size: DieSize): number {
  return 1 + Math.floor(Math.random() * size);
}

export function rollDice(count: number, size: DieSize): number[] {
  return Array.from({ length: count }, () => rollDie(size));
}

export interface D20RollResult {
  rolls: [number] | [number, number];
  chosen: number;
  modifier: number;
  total: number;
  advantage: 'advantage' | 'disadvantage' | null;
  isNat20: boolean;
  isNat1: boolean;
}

export function rollD20(modifier: number, advantage: 'advantage' | 'disadvantage' | null = null): D20RollResult {
  if (!advantage) {
    const r = rollDie(20);
    return { rolls: [r], chosen: r, modifier, total: r + modifier, advantage, isNat20: r === 20, isNat1: r === 1 };
  }
  const a = rollDie(20);
  const b = rollDie(20);
  const chosen = advantage === 'advantage' ? Math.max(a, b) : Math.min(a, b);
  return { rolls: [a, b], chosen, modifier, total: chosen + modifier, advantage, isNat20: chosen === 20, isNat1: chosen === 1 };
}

// Parses simple dice notation like "2d6+3", "1d8-1", "4d6".
export function parseAndRoll(formula: string): { rolls: number[]; total: number; formula: string } {
  const cleaned = formula.replace(/\s+/g, '');
  const match = cleaned.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const flat = Number(cleaned);
    if (!Number.isNaN(flat)) return { rolls: [], total: flat, formula };
    throw new Error(`Unrecognized dice formula: ${formula}`);
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const size = parseInt(match[2], 10) as DieSize;
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  const rolls = rollDice(count, size);
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { rolls, total, formula };
}

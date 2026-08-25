// A homebrew Yes/No oracle + solo-play toolkit. Inspired by the general
// "ask a question, weight it by likelihood, let chaos escalate into random
// events" pattern common across solo RPG toolkits, implemented from scratch
// (own tables, own math) rather than reproducing any specific commercial
// system's charts.
import { rollDie } from './dice';

export type Likelihood =
  | 'impossible' | 'very-unlikely' | 'unlikely' | 'fifty-fifty'
  | 'likely' | 'very-likely' | 'near-certain';

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  impossible: 'Almost Impossible',
  'very-unlikely': 'Very Unlikely',
  unlikely: 'Unlikely',
  'fifty-fifty': '50/50',
  likely: 'Likely',
  'very-likely': 'Very Likely',
  'near-certain': 'Near Certain',
};

// Base target (out of 20) at a neutral chaos factor of 5.
const BASE_TARGET: Record<Likelihood, number> = {
  impossible: 2,
  'very-unlikely': 5,
  unlikely: 8,
  'fifty-fifty': 10,
  likely: 13,
  'very-likely': 16,
  'near-certain': 19,
};

export type OracleAnswer = 'Exceptional Yes' | 'Yes' | 'No' | 'Exceptional No';

export interface OracleResult {
  question: string;
  likelihood: Likelihood;
  chaosFactor: number;
  target: number;
  roll: number;
  answer: OracleAnswer;
  eventRoll: number;
  randomEvent: RandomEvent | null;
}

export function askOracle(question: string, likelihood: Likelihood, chaosFactor: number): OracleResult {
  const chaosAdjust = (chaosFactor - 5) * 1; // each chaos point shifts the target by 1
  const target = Math.min(19, Math.max(1, BASE_TARGET[likelihood] + chaosAdjust));
  const roll = rollDie(20);
  let answer: OracleAnswer;
  if (roll === 20) answer = 'Exceptional Yes';
  else if (roll === 1) answer = 'Exceptional No';
  else answer = roll <= target ? 'Yes' : 'No';

  const eventRoll = rollDie(10);
  const randomEvent = eventRoll <= chaosFactor ? rollRandomEvent() : null;

  return { question, likelihood, chaosFactor, target, roll, answer, eventRoll, randomEvent };
}

const EVENT_FOCUS = [
  'A new NPC arrives', 'An NPC acts against their stated goal', 'An NPC helps unexpectedly',
  'A thread from your journal moves closer to resolution', 'A thread from your journal gets more distant',
  'A thread wraps up, for better or worse', 'Something happens to you directly, and it costs you',
  'Something happens to you directly, and it benefits you', 'The situation gets more complicated',
  'A new location or feature is revealed', 'Reinforcements or a new danger arrive',
  'Something you assumed turns out to be wrong',
];

const EVENT_ACTION = [
  'Betray', 'Protect', 'Steal', 'Reveal', 'Attack', 'Flee', 'Trick', 'Bargain',
  'Warn', 'Ignore', 'Seek', 'Abandon', 'Trap', 'Rescue', 'Corrupt', 'Bless',
  'Break', 'Bind', 'Hunt', 'Hide',
];

const EVENT_SUBJECT = [
  'an old debt', 'a hidden enemy', 'a fragile alliance', 'a forgotten place', 'a powerful artifact',
  'a rival', 'the local authority', 'a secret', 'a natural force', 'a rumor', 'an old wound',
  'a stranger', 'a creature', 'a promise', 'a treasure', 'a monster', 'a message', 'a curse',
  'a path forward', 'a way out',
];

export interface RandomEvent {
  focus: string;
  action: string;
  subject: string;
}

export function rollRandomEvent(): RandomEvent {
  const focus = EVENT_FOCUS[Math.floor(Math.random() * EVENT_FOCUS.length)];
  const action = EVENT_ACTION[Math.floor(Math.random() * EVENT_ACTION.length)];
  const subject = EVENT_SUBJECT[Math.floor(Math.random() * EVENT_SUBJECT.length)];
  return { focus, action, subject };
}

const COMPLICATIONS = [
  'You succeed, but it costs you time — a complication is now closing in.',
  'You succeed, but make noise or leave a trace that could be noticed.',
  'You succeed, but a tool, weapon, or piece of gear is damaged in the process.',
  'You succeed, but you gain a level of Exhaustion or arrive Stressed and worn down.',
  'You succeed, but an NPC nearby takes notice of you.',
  'You succeed, but you must abandon something to do it.',
  'You succeed at a cost: choose a resource (gold, a use of an ability, a relationship) and spend it.',
  'You succeed, but the situation escalates — reinforcements or a complication arrive next scene.',
  'You succeed, but only partially: you get half of what you wanted.',
  'You succeed, but you reveal more about yourself than you intended.',
];

export function rollComplication(): string {
  return COMPLICATIONS[Math.floor(Math.random() * COMPLICATIONS.length)];
}

const NPC_TRAITS = [
  'Blunt', 'Wary', 'Warm', 'Greedy', 'Loyal', 'Cowardly', 'Proud', 'Curious', 'Grim', 'Cheerful',
  'Superstitious', 'Calculating', 'Reckless', 'Devout', 'Bitter', 'Idealistic', 'Weary', 'Sly',
];
const NPC_WANTS = [
  'to be left alone', 'wealth, however it comes', 'revenge on someone specific', 'to protect their family',
  'recognition and status', 'freedom from an obligation', 'knowledge or a lost secret', 'to atone for a past act',
  'safety for their people', 'power over their situation', 'to leave this place for good', 'a way to undo a mistake',
];
const NPC_ROLES = [
  'Merchant', 'Guard', 'Innkeeper', 'Scholar', 'Outlaw', 'Priest', 'Noble', 'Laborer', 'Wanderer',
  'Healer', 'Smuggler', 'Soldier', 'Hermit', 'Official', 'Artisan', 'Spy',
];
const NAME_SYLLABLES_1 = ['Ar', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gar', 'Hal', 'Il', 'Jor', 'Kel', 'Lys', 'Mor', 'Nor', 'Os', 'Pel', 'Quin', 'Rho', 'Sel', 'Tor'];
const NAME_SYLLABLES_2 = ['ic', 'wen', 'dric', 'ara', 'ion', 'wyn', 'eth', 'and', 'ora', 'iel', 'ric', 'assa', 'or', 'ina', 'ald', 'yth', 'ana', 'us', 'ien', 'ka'];

export interface GeneratedNpc {
  name: string;
  role: string;
  trait: string;
  want: string;
}

export function generateNpc(): GeneratedNpc {
  const name = NAME_SYLLABLES_1[Math.floor(Math.random() * NAME_SYLLABLES_1.length)]
    + NAME_SYLLABLES_2[Math.floor(Math.random() * NAME_SYLLABLES_2.length)];
  const role = NPC_ROLES[Math.floor(Math.random() * NPC_ROLES.length)];
  const trait = NPC_TRAITS[Math.floor(Math.random() * NPC_TRAITS.length)];
  const want = NPC_WANTS[Math.floor(Math.random() * NPC_WANTS.length)];
  return { name, role, trait, want };
}

// Approximate, homebrew XP-budget difficulty estimate for solo encounter
// building (not a reproduction of any publisher's official table).
export type Difficulty = 'low' | 'moderate' | 'high' | 'severe';

export function xpBudget(level: number): Record<Difficulty, number> {
  const l = Math.max(1, level);
  return {
    low: Math.round(l * 25 * (1 + l * 0.05)),
    moderate: Math.round(l * 50 * (1 + l * 0.06)),
    high: Math.round(l * 75 * (1 + l * 0.07)),
    severe: Math.round(l * 125 * (1 + l * 0.08)),
  };
}

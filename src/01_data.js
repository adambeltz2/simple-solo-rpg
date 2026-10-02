/* ---------- game data ---------- */
const SKILLS = {
  athletics: { n: 'Athletics', a: 'str' }, acrobatics: { n: 'Acrobatics', a: 'dex' }, stealth: { n: 'Stealth', a: 'dex' },
  sleight: { n: 'Sleight of Hand', a: 'dex' }, arcana: { n: 'Arcana', a: 'int' }, history: { n: 'History', a: 'int' },
  investigation: { n: 'Investigation', a: 'int' }, nature: { n: 'Nature', a: 'int' }, religion: { n: 'Religion', a: 'int' },
  insight: { n: 'Insight', a: 'wis' }, medicine: { n: 'Medicine', a: 'wis' }, perception: { n: 'Perception', a: 'wis' },
  survival: { n: 'Survival', a: 'wis' }, deception: { n: 'Deception', a: 'cha' }, intimidation: { n: 'Intimidation', a: 'cha' },
  persuasion: { n: 'Persuasion', a: 'cha' },
};
const ABIL_N = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const ABIL_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const SPECIES = {
  human: { n: 'Human', perk: 'Resourceful: one extra Fortune point each adventure.' },
  elf: { n: 'Elf', perk: 'Keen senses: proficient in Perception, and advantage on saves against fear.' },
  dwarf: { n: 'Dwarf', perk: 'Stout: +1 HP per level, and poison damage is halved.' },
  halfling: { n: 'Halfling', perk: 'Lucky: reroll any natural 1 on a d20.' },
  dragonborn: { n: 'Dragonborn', perk: 'Breath weapon: once per rest, blast every foe (DEX save).' },
};
const BACKGROUNDS = {
  soldier: { n: 'Soldier', skills: ['athletics', 'intimidation'], d: 'Drilled in the line, hard to rattle.' },
  criminal: { n: 'Criminal', skills: ['stealth', 'deception'], d: 'You know locks, shadows, and lies.' },
  sage: { n: 'Sage', skills: ['history', 'investigation'], d: 'Years in dusty archives.' },
  acolyte: { n: 'Acolyte', skills: ['insight', 'religion'], d: 'Raised in a temple, steady of faith.' },
  outlander: { n: 'Outlander', skills: ['survival', 'nature'], d: 'The wild raised you.' },
  charlatan: { n: 'Charlatan', skills: ['persuasion', 'sleight'], d: 'A silver tongue and quick hands.' },
};
const DRIVES = {
  glory: { n: 'Glory', d: 'You want your name sung. Bold, daring choices feed you.' },
  greed: { n: 'Greed', d: 'Gold opens every door. Bargains and plunder tempt you.' },
  mercy: { n: 'Mercy', d: 'You cannot pass someone in need. Sparing and helping feed you.' },
  curiosity: { n: 'Curiosity', d: 'You must know why. Secrets and strange things pull at you.' },
  vengeance: { n: 'Vengeance', d: 'Someone will pay. Hard confrontation feeds you.' },
};
const CLASSES = {
  fighter: {
    n: 'Fighter', hd: 10, main: 'str', wpn: { n: 'longsword', die: 8, abil: 'str' },
    ac: () => 16, saves: ['str', 'con'], skills: ['athletics', 'perception', 'survival'],
    stats: { str: 15, dex: 12, con: 14, int: 8, wis: 13, cha: 10 },
    blurb: 'Armored and relentless. Second Wind, Action Surge, and Extra Attack at level 5.',
  },
  rogue: {
    n: 'Rogue', hd: 8, main: 'dex', wpn: { n: 'rapier', die: 8, abil: 'dex' },
    ac: (h) => 12 + mod(h.abil.dex), saves: ['dex', 'int'], skills: ['stealth', 'sleight', 'investigation', 'deception'],
    stats: { str: 8, dex: 15, con: 13, int: 12, wis: 10, cha: 14 },
    blurb: 'Quick and cunning. Sneak Attack, Cunning Hide, and Uncanny Dodge at level 5.',
  },
  wizard: {
    n: 'Wizard', hd: 6, main: 'int', wpn: { n: 'quarterstaff', die: 6, abil: 'str' },
    ac: (h) => 10 + mod(h.abil.dex), saves: ['int', 'wis'], skills: ['arcana', 'investigation', 'history'],
    stats: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    blurb: 'Fragile, brilliant. Fire Bolt, Magic Missile, Shield, Sleep, and Scorching Ray at level 3.',
  },
  cleric: {
    n: 'Cleric', hd: 8, main: 'wis', wpn: { n: 'mace', die: 6, abil: 'str' },
    ac: () => 16, saves: ['wis', 'cha'], skills: ['medicine', 'religion', 'insight'],
    stats: { str: 13, dex: 10, con: 14, int: 8, wis: 15, cha: 12 },
    blurb: 'Armored and holy. Sacred Flame, Cure Wounds, Guiding Bolt, and Turn Undead at level 2.',
  },
};
const ITEMS = {
  potion: { n: 'Potion of Healing', d: 'Heals 2d4+2.' },
  oil: { n: 'Flask of Oil', d: 'Thrown: 2d6 fire to one foe.' },
  smoke: { n: 'Smoke Bomb', d: 'Escape a fight, or vanish into the haze.' },
  scroll: { n: 'Scroll of Flame', d: 'A 3d6 fire blast at one foe.' },
};
const GEAR = [
  { id: 'blade', n: 'Whetted Blade', d: '+1 to attack rolls', atk: 1 },
  { id: 'ward', n: 'Warding Charm', d: '+1 AC', ac: 1 },
  { id: 'vest', n: 'Padded Vest', d: '+4 max HP', hp: 4 },
  { id: 'coin', n: 'Lucky Coin', d: '+1 max Fortune', fort: 1 },
  { id: 'eyes', n: 'Ring of Keen Eyes', d: '+2 Perception', skill: { perception: 2 } },
  { id: 'cloak', n: 'Shadow Cloak', d: '+2 Stealth', skill: { stealth: 2 } },
  { id: 'sigil', n: "Scholar's Sigil", d: '+2 Arcana & Investigation', skill: { arcana: 2, investigation: 2 } },
  { id: 'tongue', n: 'Silver Tongue Pin', d: '+2 Persuasion & Deception', skill: { persuasion: 2, deception: 2 } },
  { id: 'grip', n: 'Gauntlets of Grip', d: '+2 Athletics', skill: { athletics: 2 } },
];

/* ---------- monsters ---------- */
const MON = {
  goblin: { n: 'Goblin', ac: 13, hp: 7, atk: 4, dmg: [1, 6, 1], thr: 2, tier: 1, fl: ['pack'], kind: 'humanoid' },
  goblin_archer: { n: 'Goblin Archer', ac: 13, hp: 7, atk: 4, dmg: [1, 6, 1], thr: 2, tier: 1, fl: ['ranged'], kind: 'humanoid' },
  kobold: { n: 'Kobold', ac: 12, hp: 5, atk: 4, dmg: [1, 4, 2], thr: 1, tier: 1, fl: ['pack'], kind: 'humanoid' },
  giant_rat: { n: 'Giant Rat', ac: 12, hp: 7, atk: 4, dmg: [1, 4, 2], thr: 1, tier: 1, fl: ['pack'], kind: 'beast' },
  skeleton: { n: 'Skeleton', ac: 13, hp: 13, atk: 4, dmg: [1, 6, 2], thr: 3, tier: 1, fl: ['undead'], kind: 'undead' },
  zombie: { n: 'Zombie', ac: 8, hp: 22, atk: 3, dmg: [1, 6, 2], thr: 3, tier: 1, fl: ['undead'], kind: 'undead' },
  bandit: { n: 'Bandit', ac: 12, hp: 11, atk: 3, dmg: [1, 6, 1], thr: 2, tier: 1, fl: [], kind: 'humanoid' },
  cultist: { n: 'Cultist', ac: 12, hp: 9, atk: 3, dmg: [1, 6, 1], thr: 2, tier: 1, fl: [], kind: 'humanoid' },
  wolf: { n: 'Wolf', pl: 'Wolves', ac: 13, hp: 11, atk: 4, dmg: [2, 4, 1], thr: 3, tier: 1, fl: ['pack'], kind: 'beast' },
  stirge: { n: 'Stirge', ac: 14, hp: 5, atk: 5, dmg: [1, 4, 3], thr: 2, tier: 1, fl: ['drain'], kind: 'beast' },
  hobgoblin: { n: 'Hobgoblin', ac: 16, hp: 13, atk: 3, dmg: [1, 8, 1], thr: 3, tier: 2, fl: ['pack'], kind: 'humanoid' },
  bugbear: { n: 'Bugbear', ac: 16, hp: 27, atk: 4, dmg: [2, 6, 2], thr: 5, tier: 2, fl: [], kind: 'humanoid' },
  ghoul: { n: 'Ghoul', ac: 12, hp: 22, atk: 4, dmg: [2, 4, 2], thr: 5, tier: 2, fl: ['undead', 'weaken'], kind: 'undead' },
  shadow: { n: 'Shadow', ac: 12, hp: 16, atk: 4, dmg: [2, 6, 0], thr: 4, tier: 2, fl: ['undead', 'drain'], kind: 'undead' },
  giant_spider: { n: 'Giant Spider', ac: 14, hp: 26, atk: 5, dmg: [1, 8, 3], thr: 5, tier: 2, fl: ['web', 'weaken'], kind: 'beast' },
  cult_fanatic: { n: 'Cult Fanatic', ac: 13, hp: 33, atk: 4, dmg: [1, 8, 2], multi: 2, thr: 6, tier: 2, fl: ['fear'], kind: 'humanoid' },
  worg: { n: 'Worg', ac: 13, hp: 26, atk: 5, dmg: [2, 6, 2], thr: 5, tier: 2, fl: ['pack'], kind: 'beast' },
  animated_armor: { n: 'Animated Armor', ac: 18, hp: 33, atk: 4, dmg: [1, 8, 2], multi: 2, thr: 6, tier: 2, fl: [], kind: 'construct' },
  ogre: { n: 'Ogre', ac: 11, hp: 59, atk: 6, dmg: [2, 8, 4], thr: 8, tier: 3, fl: [], kind: 'giant' },
  wight: { n: 'Wight', ac: 14, hp: 45, atk: 4, dmg: [1, 8, 2], multi: 2, thr: 8, tier: 3, fl: ['undead', 'drain'], kind: 'undead' },
  traitor: { n: 'Traitor', ac: 14, hp: 24, atk: 5, dmg: [1, 8, 2], thr: 4, tier: 2, fl: [], kind: 'humanoid' },
};
const BOSS = {
  necromancer: { n: 'Necromancer', ac: 12, hp: 40, atk: 6, dmg: [2, 8, 0], fl: ['drain'], sp: { k: 'summon', key: 'skeleton', every: 3, n: 2 }, kind: 'humanoid' },
  bone_knight: { n: 'Bone Knight', ac: 17, hp: 50, atk: 6, dmg: [1, 10, 3], multi: 2, fl: ['undead', 'fear'], kind: 'undead' },
  goblin_warboss: { n: 'Goblin Warboss', ac: 15, hp: 42, atk: 6, dmg: [1, 8, 3], multi: 2, fl: [], sp: { k: 'summon', key: 'goblin', every: 3, n: 2 }, kind: 'humanoid' },
  bugbear_chief: { n: 'Bugbear Chieftain', ac: 16, hp: 58, atk: 6, dmg: [2, 8, 3], fl: [], kind: 'humanoid' },
  prophet: { n: 'Hollow Prophet', ac: 13, hp: 42, atk: 6, dmg: [2, 8, 0], fl: ['fear'], sp: { k: 'summon', key: 'cultist', every: 3, n: 2 }, kind: 'humanoid' },
  pit_priest: { n: 'Pit Priest', ac: 15, hp: 50, atk: 6, dmg: [1, 10, 3], multi: 2, fl: ['fear'], kind: 'humanoid' },
  spider_queen: { n: 'Spider Queen', ac: 15, hp: 54, atk: 6, dmg: [1, 10, 3], fl: ['web', 'weaken'], kind: 'beast' },
  kobold_sorcerer: { n: 'Kobold Dragonspawn', ac: 14, hp: 40, atk: 6, dmg: [2, 6, 2], fl: [], sp: { k: 'breath', dice: [3, 6], type: 'fire', every: 3, dc: 13 }, kind: 'humanoid' },
  bandit_lord: { n: 'Bandit Lord', ac: 16, hp: 48, atk: 6, dmg: [1, 8, 3], multi: 2, fl: [], kind: 'humanoid' },
  hag: { n: 'Bog Hag', ac: 14, hp: 52, atk: 6, dmg: [2, 6, 3], fl: ['weaken', 'drain'], kind: 'fey' },
  ogre_brute: { n: 'Ogre Warlord', ac: 12, hp: 75, atk: 7, dmg: [2, 10, 4], fl: [], kind: 'giant' },
};

/* ---------- themes ---------- */
const THEMES = {
  crypt: {
    n: 'Crypt', site: ['the Hollow Vault', 'the Sunken Ossuary', 'the Tomb of Ash', "the Gravewarden's Rest"],
    rooms: ['burial hall', 'ossuary', 'sarcophagus chamber', "embalmer's workshop", 'funeral gallery', 'bone-lined stair', 'offering chamber', 'crypt library'],
    sight: ['cobwebbed alcoves line the walls', 'bones are stacked in neat, patient rows', 'a cracked sarcophagus lies half-open', 'faded funeral murals peel from the plaster', 'cold blue light seeps from a seam in the stone'],
    sound: ['Somewhere, dry bone clicks against stone.', 'The silence presses on your ears.', 'Water drips with slow, deliberate timing.', 'A draft moans through the dark like a sleeper dreaming.'],
    smell: ['dust and old incense', 'the sweet rot of a long-closed grave', 'cold, mineral damp'],
    mon: { 1: ['skeleton', 'zombie', 'giant_rat', 'skeleton'], 2: ['ghoul', 'shadow', 'skeleton', 'zombie'], 3: ['wight', 'ghoul', 'shadow'] },
    bosses: ['necromancer', 'bone_knight'], minions: 'the restless dead',
    villainTitle: ['the Ashen', 'Gravecaller', 'the Pale Warden', 'Bone-Sworn'],
    motive: ['wants to raise an army that will never tire', 'is trying to speak once more with someone lost', 'believes death is a disease and the dead are the cure'],
    ritual: ['a rite of raising', 'the Opening of the Vault'],
    mcg: ['the Sepulchral Seal', 'a grave-silver reliquary', 'the Lantern of Last Breath'],
  },
  warren: {
    n: 'Warren', site: ['Rotgut Warren', 'the Skullpick Burrows', 'Mudtooth Hold', 'the Gnawed Deeps'],
    rooms: ['trash-choked tunnel', "chieftain's mess", 'raiders\' armory', 'kennel pit', 'plunder cache', 'smoky barracks', 'mushroom garden', 'rope bridge cavern'],
    sight: ['crude totems of bone and rag lean against the walls', 'smoke curls from a heap of smoldering refuse', 'crude paint smears the rock in jagged warnings', 'stolen goods lie in heaps, sorted by no logic'],
    sound: ['Guttural laughter echoes from somewhere ahead.', 'Metal scrapes on stone, again and again.', 'Something growls low in a nearby tunnel.', 'A crude drum thumps in the walls like a slow heartbeat.'],
    smell: ['wood smoke and spoiled meat', 'wet fur and tallow', 'sour ale and rust'],
    mon: { 1: ['goblin', 'goblin', 'goblin_archer', 'kobold', 'wolf'], 2: ['hobgoblin', 'bugbear', 'worg', 'goblin_archer', 'hobgoblin'], 3: ['bugbear', 'ogre', 'hobgoblin', 'worg'] },
    bosses: ['goblin_warboss', 'bugbear_chief'], minions: 'the raiders',
    villainTitle: ['Skull-Biter', 'the Cruel', 'Ironjaw', 'the Many-Knived'],
    motive: ['wants a throne worth the name, and a larger tribe to sit before it', 'has been starved off the surface and means to take it back', 'dreams of a war that will make the valley tremble'],
    ritual: ['a war-rite', 'the Gathering of Tribes'],
    mcg: ['the Chieftain\'s Horn', 'a stolen village banner', 'the Bonecrown'],
  },
  sanctum: {
    n: 'Sanctum', site: ['the Hollow Sanctum', 'the Drowned Chapel', 'the Chapel Below', 'the Veiled Cathedral'],
    rooms: ['vestry', 'cellar shrine', 'candle-lit nave', 'scriptorium', 'penitent cells', 'reliquary vault', 'chanting hall', 'bell crypt'],
    sight: ['black candles burn in iron stands', 'a mural of a faceless saint stares from the wall', 'sigils of chalk and ash cover the flagstones', 'crimson cloth hangs from the rafters like drying wounds'],
    sound: ['A low, rhythmic chant rolls through the stone.', 'Wax pops and spits in the candle flames.', 'Far off, a bell tolls once, and then not again.', 'Someone is whispering a name over and over.'],
    smell: ['incense, wax, and copper', 'burnt hair and myrrh', 'old stone and spilled wine'],
    mon: { 1: ['cultist', 'cultist', 'giant_rat', 'stirge'], 2: ['cult_fanatic', 'cultist', 'animated_armor', 'shadow'], 3: ['cult_fanatic', 'animated_armor', 'ogre'] },
    bosses: ['prophet', 'pit_priest'], minions: 'the faithful',
    villainTitle: ['the Veiled', 'Voice-of-the-Deep', 'the Ninth Candle', 'the Hollow Saint'],
    motive: ['hears a god no one else can, and is sure it is hungry', 'wants to end a plague and will pay any price', 'is certain the world is a cage and means to break it'],
    ritual: ['the Rite of Opening', 'a midnight communion'],
    mcg: ['the Ninth Candle', 'a faceless saint\'s reliquary', 'the Choir-Bell'],
  },
  delve: {
    n: 'Delve', site: ['the Ironvein Delve', 'Deepcut Mine', 'the Glimmerfall Works', 'the Collapsed Shaft'],
    rooms: ['ore-cart tunnel', 'collapsed gallery', 'foreman\'s office', 'smelter hall', 'web-choked cavern', 'flooded shaft', 'crystal vein chamber', 'timbered stair'],
    sight: ['rusted ore carts sit abandoned on warped rails', 'veins of pale crystal glitter in the rock', 'old support beams lean under their own weight', 'thick webs hang in grey curtains from the ceiling'],
    sound: ['Pebbles patter down from somewhere unseen.', 'Something skitters in the walls.', 'The timbers creak like an old ship.', 'A distant, steady scrape of claw on stone.'],
    smell: ['rock dust and cold iron', 'damp earth and old lamp oil', 'sulfur and mildew'],
    mon: { 1: ['kobold', 'giant_rat', 'stirge', 'kobold', 'goblin'], 2: ['giant_spider', 'hobgoblin', 'stirge', 'bugbear'], 3: ['giant_spider', 'ogre', 'bugbear'] },
    bosses: ['spider_queen', 'kobold_sorcerer'], minions: 'the things in the dark',
    villainTitle: ['the Deepwalker', 'Veinhunter', 'the Hollow Queen', 'Cinder-Claw'],
    motive: ['has claimed the deepest vein and will kill for it', 'serves something old that woke when the miners dug too deep', 'is only trying to keep her brood fed through a bitter winter'],
    ritual: ['a summoning at the vein-heart', 'the Waking of the Deep'],
    mcg: ['the Heartstone', 'a miner\'s lucky lantern', 'a map of the lower shafts'],
  },
  keep: {
    n: 'Keep', site: ['Blackthorn Keep', 'the Ruined Bastion', 'Mournwatch Tower', 'the Ashen Garrison'],
    rooms: ['gatehouse', 'collapsed barracks', 'war room', 'stable block', 'cellar prison', 'armory', 'great hall', 'tower stair'],
    sight: ['banners hang in tatters from the rafters', 'a long table is set with rotting plates', 'arrow slits stripe the walls with thin light', 'broken weapons crowd a sagging rack'],
    sound: ['Wind whistles through broken shutters.', 'Boots scuff somewhere above.', 'A door bangs again and again in the draft.', 'A distant laugh dies as quickly as it began.'],
    smell: ['smoke, horse, and rust', 'old ash and cold stew', 'mildew and boiled leather'],
    mon: { 1: ['bandit', 'wolf', 'bandit', 'goblin'], 2: ['bandit', 'bugbear', 'worg', 'hobgoblin'], 3: ['bugbear', 'ogre', 'hobgoblin', 'worg'] },
    bosses: ['bandit_lord', 'hag', 'ogre_brute'], minions: 'the garrison',
    villainTitle: ['the Red Hand', 'Black-Thorn', 'the Crow-Marshal', 'the Hollow King'],
    motive: ['holds a grudge against the valley, and has ground it into a plan', 'serves a bargain struck in a bad hour', 'says the valley owes a debt and means to collect'],
    ritual: ['a blood-oath', 'the Crowning of Ash'],
    mcg: ['the Marshal\'s Signet', 'the Garrison Ledger', 'a king\'s broken crown'],
  },
};

/* ---------- names ---------- */
const FIRST = ['Aldric', 'Brenna', 'Corwin', 'Dara', 'Edrin', 'Fenna', 'Garrick', 'Hilda', 'Isolde', 'Joren', 'Kestrel', 'Lyra', 'Marek', 'Nessa', 'Orin', 'Perrin', 'Quill', 'Rhea', 'Soren', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yara', 'Bram', 'Cinder', 'Odette', 'Hob', 'Mirela', 'Tobin', 'Ysolde', 'Dunmore', 'Petra', 'Ludo'];
const DARK = ['Mordra', 'Vexil', 'Grask', 'Nythra', 'Orsk', 'Varnhelm', 'Skarn', 'Illith', 'Drogan', 'Maelis', 'Thessaly', 'Karn', 'Zul', 'Morwen', 'Hask'];
const PATRON_ROLE = ['mayor', 'innkeeper', 'village elder', 'priestess', 'caravan-master', 'guildmaster', 'miller', 'ferryman'];
const PLACES = ['Thornwick', 'Marrowfield', 'Greyhollow', 'Ashford', 'Kestrelford', 'Lowmere', 'Pinecrest', 'Stonebridge', 'Highvale', 'Eddleston'];
const SEED_W1 = ['ember', 'crow', 'iron', 'moss', 'ash', 'salt', 'thorn', 'ghost', 'amber', 'gale', 'raven', 'cinder', 'briar', 'frost', 'ruin', 'bone'];
const SEED_W2 = ['gate', 'vault', 'hollow', 'spire', 'crown', 'lantern', 'barrow', 'throne', 'well', 'bridge', 'key', 'mask', 'oath', 'grave', 'tide', 'fang'];
const HERO_NAMES = ['Aelin', 'Bryn', 'Caius', 'Delia', 'Eamon', 'Fiora', 'Gunnar', 'Halia', 'Ivo', 'Jessa', 'Kael', 'Liora', 'Magnus', 'Nyx', 'Oswin', 'Pip', 'Rook', 'Sable', 'Thane', 'Vala'];

/* ---------- hooks ---------- */
const HOOKS = {
  rescue: {
    pitch: '{patron}, the {prole} of {place}, grips your arm. "{ally} was dragged into {site} by {villain}\'s followers three nights ago. Bring {opr} home, and I will pay you {reward} gold."',
    goal: 'Find {ally} alive and bring {opr} home.', clock: 'Dawn sacrifice', clockMax: 9, twists: ['ally_betrays', 'villain_sympathetic', 'patron_lied'],
  },
  recover: {
    pitch: '{patron}, the {prole} of {place}, lays a sealed purse on the table. "{villain} stole {mcg} from us. Without it, {place} is in danger. Bring it back and {reward} gold is yours."',
    goal: 'Recover {mcg} from {villain}.', clock: 'The thief escapes', clockMax: 9, twists: ['mcguffin_cursed', 'patron_lied', 'villain_sympathetic'],
  },
  ritual: {
    pitch: '{patron}, the {prole} of {place}, speaks low. "{villain} is performing {ritual} beneath {site}. When it is finished, there will be no {place}. Stop it. I can pay {reward} gold."',
    goal: 'Stop {ritual} before it is finished.', clock: 'The rite nears completion', clockMax: 8, twists: ['villain_sympathetic', 'patron_lied', 'ally_betrays'],
  },
  hunt: {
    pitch: '{patron}, the {prole} of {place}, points to the hills. "Something is preying on our herds, and our people. The trail leads to {site}, and to {villain}. End it. {reward} gold for the deed."',
    goal: 'Put an end to {villain} and what hunts from {site}.', clock: 'The hunger grows', clockMax: 9, twists: ['villain_sympathetic', 'patron_lied', 'ally_betrays'],
  },
  investigate: {
    pitch: '{patron}, the {prole} of {place}, wrings their hands. "People keep vanishing near {site}. I need to know why, and who is behind it. {reward} gold, and the thanks of the whole village."',
    goal: 'Learn why people vanish near {site}.', clock: 'More vanish', clockMax: 9, twists: ['villain_sympathetic', 'patron_lied', 'ally_betrays'],
  },
};
const ROOM_OBJ = {
  trap: [
    { obj: 'a pressure-plated corridor', kind: 'floor', dmg: 'piercing', good: ['investigation', 'perception'] },
    { obj: 'a corridor of dart-slots', kind: 'darts', dmg: 'poison', good: ['acrobatics', 'perception'] },
    { obj: 'a swinging blade across the passage', kind: 'blade', dmg: 'slashing', good: ['acrobatics', 'investigation'] },
    { obj: 'a tripwire strung just above the dust', kind: 'wire', dmg: 'bludgeoning', good: ['perception', 'sleight'] },
    { obj: 'a vent hissing faint green mist', kind: 'gas', dmg: 'poison', good: ['survival', 'medicine'] },
  ],
  puzzle: [
    { obj: 'a door ringed with glowing runes', skill: 'arcana', alt: 'investigation', good: ['arcana', 'investigation'] },
    { obj: 'a statue whose mouth is a lock', skill: 'history', alt: 'insight', good: ['history', 'insight'] },
    { obj: 'a mosaic of levers and counterweights', skill: 'investigation', alt: 'sleight', good: ['investigation', 'sleight'] },
    { obj: 'a shrine with three carved offering bowls', skill: 'religion', alt: 'insight', good: ['religion', 'insight'] },
    { obj: 'a pedestal of mirrored panels', skill: 'perception', alt: 'arcana', good: ['perception', 'arcana'] },
  ],
  hazard: [
    { obj: 'a rotting plank bridge over a drop', skill: 'acrobatics', alt: 'athletics', good: ['acrobatics', 'athletics'] },
    { obj: 'a passage flooded to the waist', skill: 'athletics', alt: 'survival', good: ['athletics', 'survival'] },
    { obj: 'a hall of drifting spores', skill: 'survival', alt: 'medicine', good: ['survival', 'nature', 'medicine'] },
    { obj: 'a ceiling dripping and ready to fall', skill: 'perception', alt: 'acrobatics', good: ['perception', 'acrobatics'] },
  ],
  lore: [
    { obj: 'a wall of old murals', good: ['history', 'investigation', 'religion'] },
    { obj: "a dead adventurer's journal", good: ['investigation', 'insight', 'history'] },
    { obj: 'a ritual diagram scratched into the floor', good: ['arcana', 'religion', 'investigation'] },
    { obj: "a scribe's cluttered desk", good: ['investigation', 'history', 'insight'] },
  ],
  treasure: [
    { obj: 'an iron-banded chest', good: ['sleight', 'investigation'] },
    { obj: 'a hidden cache behind loose stones', good: ['perception', 'investigation'] },
    { obj: "a dead adventurer's pack", good: ['investigation', 'medicine'] },
    { obj: 'a sealed stone urn', good: ['arcana', 'sleight'] },
  ],
};
const SOCIAL_ROLES = {
  prisoner: { n: 'captive', d: 'bound and gagged against a pillar', want: 'freedom' },
  deserter: { n: 'deserter', d: 'crouched in the shadows, shaking', want: 'a way out' },
  scholar: { n: 'trapped scholar', d: 'pinned behind a toppled shelf', want: 'rescue' },
  rival: { n: 'rival delver', d: 'leaning on a wall, bandaging an arm', want: 'a share of the spoils' },
  trader: { n: 'strange trader', d: 'sitting calmly beside a lantern and a heap of goods', want: 'coin' },
};
const NPC_ACT = {
  prisoner: 'strains against the ropes and looks at you with desperate eyes',
  deserter: 'flinches at the sound of your boots, then freezes',
  scholar: 'waves a hand weakly, ink-stained and out of breath',
  rival: 'looks up, unsurprised, and gives a tired, crooked smile',
  trader: 'tips their hat as if a delver walking in were the most ordinary thing in the world',
};
const COMBAT_ACT = {
  humanoid: ['linger here, weapons loose in their hands', 'crouch around a guttering fire, arguing', 'guard the far archway, watchful and bored', 'mill about, muttering over stolen goods'],
  beast: ['prowl the chamber, hungry and alert', 'tear at something unpleasant in the corner', 'pace in a tight, restless circle', 'lift their heads at the first scent of you'],
  undead: ['stand motionless, waiting', 'shamble in slow, aimless circles', 'stir the moment you cross the threshold', 'rattle and sway as if remembering how to walk'],
  construct: ['stand at attention, perfectly still', 'turn their empty helms toward you in unison'],
  giant: ['sprawl across the floor, breathing heavily', 'stomp around the chamber, muttering'],
  fey: ['hover at the edge of the light, grinning'],
};

/* ---------- narration templates ---------- */
const TPL = {
  arrive: ['You move on.', 'You press forward.', 'The passage opens ahead.', 'You step into the next chamber.', 'You slip deeper.'],
  lead: {
    combat: ['{count} {names} {act}.', '{count} {names} {act}. They have not noticed you yet.', 'You stop short. {count} {names} {act}.'],
    trap: ['Ahead lies {obj}. Something about it is wrong.', 'You catch yourself just before {obj}. It has been here a long time, and it is still working.'],
    puzzle: ['A single barrier stands in your way: {obj}.', 'The passage ends at {obj}. Whoever built it did not want visitors.'],
    hazard: ['The way forward is {obj}.', 'Your path is blocked by {obj}.'],
    lore: ['{obj} catches your eye. It looks like someone wanted it remembered.', 'You find {obj}. The details are worth a closer look.'],
    treasure: ['You find {obj}, tucked out of sight.', '{Obj} sits in the corner, as if waiting for someone patient.'],
    rest: ['A rare quiet. This corner is dry, defensible, and strangely untouched.', 'You find a still pocket in the dungeon, sheltered from the worst of it.'],
    social: ['A {role} sits {d}. They {act}.', 'You are not alone. A {role} is here, {d}. They {act}.'],
  },
  succ: {
    athletics: ['You throw your shoulder into it, and {obj} gives way with a groan.', 'Muscle and momentum carry you through {obj}.'],
    acrobatics: ['You flow past {obj} like water, light on your feet.', 'A twist, a leap, and {obj} is behind you.'],
    stealth: ['You keep to the shadows and make no sound. {Obj} never notices you.', 'Soft steps, shallow breath. You pass {obj} unseen.'],
    sleight: ['Quick fingers do the work. {Obj} clicks open without a fuss.', 'A deft touch, a held breath. {Obj} is yours.'],
    arcana: ['You read the weave of power in {obj} and nudge it aside.', 'The spell-work in {obj} is clever, but you have seen cleverer.'],
    history: ['A half-remembered legend clicks into place. {Obj} makes sense now.', 'You recall the old stories, and {obj} reveals its secret.'],
    investigation: ['You study {obj} until the pattern gives itself up.', 'A careful look reveals what {obj} hoped you would miss.'],
    nature: ['You read the signs of {obj} the way a hunter reads tracks.', 'Nature has its own rules, and you know them.'],
    religion: ['You murmur the old words. {Obj} accepts the offering.', 'The symbols are familiar. A short prayer settles it.'],
    insight: ['You see through {obj} the moment you look past what it is meant to show.', 'Something in the details whispers the truth, and you listen.'],
    medicine: ['You act with calm hands and a clear head. {Obj} is handled.', 'A trained eye finds exactly what is wrong.'],
    perception: ['You catch the small thing others would miss, and {obj} is no longer a danger.', 'Sharp eyes and a steady mind. {Obj} reveals itself.'],
    survival: ['You pick the safe path through {obj}, one careful step at a time.', 'Experience guides you through {obj}.'],
    deception: ['The lie comes out smooth and confident, and it holds.', 'You wrap a falsehood in just enough truth, and it takes.'],
    intimidation: ['You let your voice drop and your shadow lengthen. The resistance melts.', 'A hard stare and a harder promise do the work.'],
    persuasion: ['You say the right words in the right order, and the room softens.', 'Honest, warm, and sure, you make your case. It lands.'],
  },
  fail: {
    athletics: ['{Obj} refuses to budge, and the effort leaves you winded.', 'You strain against {obj}, and something in your shoulder complains.'],
    acrobatics: ['Your footing slips at the worst moment.', 'You mistime it, and {obj} does not forgive.'],
    stealth: ['A boot scuffs, a buckle clinks. Someone, or something, notices.', 'Your shadow falls the wrong way at the wrong time.'],
    sleight: ['Your fingers slip, and {obj} responds with a loud, ugly click.', 'A tool snaps in your hand. That was noisy.'],
    arcana: ['The pattern in {obj} shifts under your gaze, and you lose the thread.', 'You push at the weave, and it pushes back.'],
    history: ['You almost remember the legend, and almost is not enough.', 'The old tale slips away just as you reach for it.'],
    investigation: ['You look for a long time and miss the one detail that matters.', 'Every clue you find points the wrong way.'],
    nature: ['You misread the signs, and the land makes you pay for it.', 'You were sure, and you were wrong.'],
    religion: ['The words feel hollow in your mouth, and {obj} stays silent.', 'You stumble through the rite and the wrong thing listens.'],
    insight: ['You mistake the performance for the truth.', 'Something is hidden here, and you are not seeing it.'],
    medicine: ['Your hands shake, and the problem worsens.', 'A wrong guess, and things get a little worse.'],
    perception: ['You see exactly what you were meant to see, and no more.', 'Dust, shadow, and a moment too late.'],
    survival: ['The ground gives way under a careless step.', 'You choose the wrong path, and {obj} gets its due.'],
    deception: ['The lie comes out lopsided, and they see straight through it.', 'Your story falls apart on the second sentence.'],
    intimidation: ['Your threat lands badly. They look more annoyed than afraid.', 'You puff up your chest, and they do not buy it.'],
    persuasion: ['Your words sound better in your head than out loud.', 'You make your case, and it falls flat.'],
  },
  hit: ['You strike {t}.', 'Your blow lands on {t}.', 'You cut into {t}.', 'You catch {t} cleanly.'],
  miss: ['You swing at {t} and miss.', '{T} twists aside as you strike.', 'Your attack glances off {t}.'],
  ehit: ['{E} hits you.', '{E} lands a blow.', '{E} catches you off guard.', '{E} tears into you.'],
  emiss: ['{E} swings and misses.', '{E} lunges, but you turn the blow.', '{E} cannot find an opening.'],
  die: ['{T} falls and does not rise.', '{T} crumples.', '{T} collapses, lifeless.'],
  npc: {
    trap: [], prisoner: ['"Please, get me out of here. I will tell you everything I know."', '"Thank the gods. Quickly, before they come back."'],
    deserter: ['"I only joined for the coin. I never wanted any of this."', '"Do not call the others. I will tell you what I know."'],
    scholar: ['"Careful, there are traps everywhere. I mapped them, but my notes are under this shelf."', '"Fascinating place, truly, if I were not about to die in it."'],
    rival: ['"Another fool after the same prize? Well, there is room for two, if you split what we find."', '"Do not worry, I am not here to fight. Not yet."'],
    trader: ['"Delvers always get thirsty and short on supplies. I have a little of both for sale."', '"A traveler needs a friend underground. I sell friends, in bottles and bombs."'],
  },
};

/* ---------- ASCII art (original, drawn for this game) ---------- */
const R = String.raw;
const ART = {
  goblin: R`
   ,___,
  (o\_/o)
  /(   )\
   /| |\
  ^^   ^^`,
  kobold: R`
   /\_/\
  ( o.o )
  (>   <)~
   /| |\
  _/   \_`,
  giant_rat: R`
  ()_()
  (o.o)  ____
  (> <)~(____)
   ""   " "`,
  skeleton: R`
    ___
   (o o)
   /|=|\
    |||
   _/ \_`,
  zombie: R`
    ___
   (x_x)
  --|~|--
    | |
   _| |_`,
  bandit: R`
   ,---.
  ( ._. )
  /|   |\
  / |_| \
   /   \
`,
  cultist: R`
    /\
   /  \
  ( __ )
  /|  |\
  ~~~~~~`,
  wolf: R`
   /\___/\
  ( o   o )__
  (  v    ___)
   |||  |||`,
  stirge: R`
  \  ,  /
   \(oo)/
   /\/\/\
     \/ `,
  hobgoblin: R`
   ,---,
  [ o_o ]
  /|###|\
   |   |
  _|   |_`,
  bugbear: R`
   /^^^\
  ( O_O )
  /|###|\
  / |_| \
   _| |_`,
  ghoul: R`
   .---.
  ( o o )
  /|vvv|\
  //   \\
  ^^   ^^`,
  shadow: R`
    .--.
   ( oo )
  ~/    \~
   ~    ~
    ~~~~`,
  giant_spider: R`
  \\ (oo) //
   \\/||\//
   //\||/\\
  //  ||  \\
`,
  cult_fanatic: R`
     /\
    /++\
   ( ** )
  \/|  |\/
   ~~~~~~`,
  worg: R`
   /\_/\
  ( @ @ )\_
  (  w   __)
   |||  |||`,
  animated_armor: R`
    ___
   [___]
  /[|=|]\
   [   ]
   |_|_|`,
  ogre: R`
   _____
  ( O O )
  /|~~~|\
 / |   | \
   |_|_|`,
  wight: R`
    ___
   (o o)
  /|\_/|\
   |   |
  ~~~~~~~`,
  traitor: R`
   ,---.
  ( -_- )
  /|   |\
  / |_| \
   /   \
`,
  necromancer: R`
    /\
   /__\  *
  ( oo )/
  /|  |/
  ~~~~~~`,
  bone_knight: R`
   _/^\_
  [(o o)]
  /[|#|]\
   [   ]
   |_|_|`,
  goblin_warboss: R`
  ,-^-^-,
  ( O_O )
  /|###|\ |
  / |_| \/
   /   \
`,
  bugbear_chief: R`
  \\^^^//
  ( O_O )
  /|###|\
 /\ |_| /\
   _| |_`,
  prophet: R`
    /\
   /::\
  ( ,, )
  \/||\/
   ~~~~`,
  pit_priest: R`
   _/\_
  (_@@_)
  /|##|\
   |  |
  ~~~~~~`,
  spider_queen: R`
  \\\ (OO) ///
   \\\/||\///
   ///\||/\\\
  ///  ||  \\\
`,
  kobold_sorcerer: R`
   /\_/\  ~
  ( O.O )/~~
  (>   <)~~
   /| |\
  _/   \_`,
  bandit_lord: R`
   ,=^=,
  ( >_< )
  /|###|\
  / |_| \
   /   \
`,
  hag: R`
    _/\_
   (@  @)
   /vvvv\
  /|    |\
   ~~~~~~`,
  ogre_brute: R`
   _____
  (>O O<)
 /|#####|\
/ |     | \
  |_|_|_|`,
};
const ART_KIND = { humanoid: 'bandit', beast: 'wolf', undead: 'skeleton', construct: 'animated_armor', giant: 'ogre', fey: 'hag' };
function artFor(e) {
  const raw = ART[e.key] || ART[ART_KIND[e.kind]] || ART.bandit;
  return raw.replace(/^\n|\s+$/g, '');
}

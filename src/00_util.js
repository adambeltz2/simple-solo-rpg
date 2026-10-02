/* ---------- util ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const mod = (score) => Math.floor((score - 10) / 2);
const sgn = (n) => (n >= 0 ? '+' : '−') + Math.abs(n);
const an = (w) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* seeded RNG for dungeon generation (replayable from a seed) */
function RNG(seed) {
  const f = mulberry32(typeof seed === 'number' ? seed : hashStr(String(seed)));
  const r = {
    f,
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    },
    pickN(arr, n) { return r.shuffle(arr).slice(0, n); },
  };
  return r;
}

/* table dice (not seeded: every play-through rolls fresh) */
const dRand = { f: Math.random };
const d = (sides) => 1 + Math.floor(dRand.f() * sides);
const pickR = (arr) => arr[Math.floor(dRand.f() * arr.length)];
function rollDice(n, sides, bonus = 0) {
  const rolls = [];
  let total = bonus;
  for (let i = 0; i < n; i++) { const v = d(sides); rolls.push(v); total += v; }
  return { total, rolls, bonus };
}
function rollArr(a) { return rollDice(a[0], a[1], a[2] || 0); }
const diceStr = (a) => a[0] + 'd' + a[1] + (a[2] ? (a[2] > 0 ? '+' : '−') + Math.abs(a[2]) : '');
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

/* persistence */
const Store = {
  key: 'delve.save.v1',
  mem: null,
  load() {
    try {
      const s = localStorage.getItem(this.key);
      return s ? JSON.parse(s) : this.mem ? JSON.parse(this.mem) : null;
    } catch (e) {
      return this.mem ? JSON.parse(this.mem) : null;
    }
  },
  save(obj) {
    const s = JSON.stringify(obj);
    this.mem = s;
    try { localStorage.setItem(this.key, s); } catch (e) { /* storage full or blocked: memory copy only */ }
  },
  wipe() {
    this.mem = null;
    try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
  },
};

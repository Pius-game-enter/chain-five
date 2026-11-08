// Run with: node game.test.mjs
import assert from 'node:assert/strict';
import { newGame, applyMove, viewFor, targets, isDead, BOARD_LAYOUT } from './game.js';
import { pickMove } from './bot.js';
import { STRINGS } from './i18n.js';
import { readFileSync } from 'node:fs';

const seeded = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const fresh = seed => ({ ...newGame(['Ann', 'Bo'], seeded(seed)), turn: 0 });

// Hand the current player a card, then play it.
function playAs(state, card, cell) {
  const next = structuredClone(state);
  next.hands[next.turn][0] = card;
  return applyMove(next, next.turn, { type: 'play', card, cell });
}

// Deal
const g = fresh(1);
const counts = {};
g.board.forEach(c => c.card && (counts[c.card] = (counts[c.card] ?? 0) + 1));
assert.equal(g.board.filter(c => c.card === null).length, 4);
assert.equal(Object.keys(counts).length, 48);
assert.ok(Object.values(counts).every(n => n === 2));
assert.ok(Object.keys(counts).every(c => c[0] !== 'J'));
assert.equal(g.deck.length, 104 - 14);

// The board is fixed, and the two copies of a card are never neighbours.
assert.deepEqual(fresh(2).board.map(c => c.card), g.board.map(c => c.card));
assert.deepEqual(BOARD_LAYOUT.slice(1, 9), ['AS', '2S', '3S', '4S', '5S', '6S', '7S', '8S']);
for (const card of new Set(BOARD_LAYOUT.filter(Boolean))) {
  const [a, b] = BOARD_LAYOUT.flatMap((c, i) => (c === card ? [i] : []));
  const apart = Math.max(Math.abs(Math.floor(a / 10) - Math.floor(b / 10)), Math.abs((a % 10) - (b % 10)));
  assert.ok(apart > 1, `${card} copies touch at ${a} and ${b}`);
}

// Corner plus four chips is a line; a second line may share exactly one chip.
let s = fresh(7);
const filler = [51, 53, 55, 57, 59, 71, 73];
for (let k = 0; k < 4; k++) s = playAs(playAs(s, 'JD', 1 + k), 'JC', filler[k]);
assert.equal(s.lines[0], 1);
assert.ok([1, 2, 3, 4].every(i => s.board[i].locked));
assert.ok(!targets(s.board, 'JS', 1).includes(1), 'locked chips are safe');
s = playAs(playAs(s, 'JD', 5), 'JC', filler[4]);
assert.ok(targets(s.board, 'JS', 1).includes(5), 'unlocked chips can be removed');
s = playAs(playAs(s, 'JD', 6), 'JC', filler[5]);
s = playAs(s, 'JD', 7);
assert.equal(s.lines[0], 1, 'sharing two chips is not a new line');
s = playAs(s, 'JC', filler[6]);
s = playAs(s, 'JD', 8);
assert.equal(s.lines[0], 2);
assert.ok(s.over);
assert.equal(s.winner, 0);
assert.throws(() => playAs(s, 'JD', 30), /over/);

// Diagonal
let d = fresh(3);
[11, 22, 33, 44].forEach((cell, k) => { d = playAs(playAs(d, 'JD', cell), 'JC', 60 + k * 2); });
d = playAs(d, 'JD', 55);
assert.equal(d.lines[0], 1);

// Turn order and removal
let r = fresh(4);
assert.throws(() => applyMove(r, 1, { type: 'play', card: r.hands[1][0], cell: 1 }), /turn/);
r = playAs(r, 'JD', 44);
r = playAs(r, 'JS', 44);
assert.equal(r.board[44].owner, null);
assert.equal(r.last.removed, true);

// Dead card swap keeps the turn
let x = fresh(5);
const card = x.board[11].card;
x.board.forEach(c => { if (c.card === card) c.owner = 1; });
x.hands[0][0] = card;
x.hands[0][1] = 'JD';
assert.ok(isDead(x.board, card));
const deckBefore = x.deck.length;
x = applyMove(x, 0, { type: 'swap', card });
assert.equal(x.turn, 0);
assert.equal(x.hands[0].length, 7);
assert.equal(x.deck.length, deckBefore - 1);
assert.throws(() => applyMove(x, 0, { type: 'swap', card: 'JD' }), /dead/);

// The view hides the other hand and the deck
const v = viewFor(g, 1);
assert.equal(v.hands[0], 7);
assert.deepEqual(v.hands[1], g.hands[1]);
assert.equal(v.deck, g.deck.length);

// Computer: finishes its own line, blocks the opponent's, swaps dead cards.
const withBoard = (seed, chips) => {
  const s = { ...newGame(['Ann', 'Bot'], seeded(seed)), turn: 1 };
  for (const [cell, owner] of chips) s.board[cell].owner = owner;
  return s;
};
let b = withBoard(8, [[12, 1], [13, 1], [14, 1], [15, 1]]);
b.hands[1][0] = 'JD';
assert.ok([11, 16].includes(pickMove(b, 1).cell), 'completes its own line');
b = withBoard(9, [[32, 0], [33, 0], [34, 0], [35, 0]]);
b.hands[1][0] = 'JC';
assert.ok([31, 36].includes(pickMove(b, 1).cell), 'blocks the opponent');
b = withBoard(10, []);
const deadCard = b.board[11].card;
b.board.forEach(c => { if (c.card === deadCard) c.owner = 0; });
b.hands[1][0] = deadCard;
assert.deepEqual(pickMove(b, 1), { type: 'swap', card: deadCard });
// A whole game between two computers ends without an illegal move.
let auto = newGame(['A', 'B'], seeded(11));
for (let guard = 0; !auto.over && guard < 500; guard++) {
  auto = applyMove(auto, auto.turn, pickMove(auto, auto.turn, 'hard', seeded(guard + 1)));
}
assert.ok(auto.over);

// Levels stay in order: hard should clearly beat easy over many seeded games.
let hardWins = 0;
let decided = 0;
const rnd = seeded(99);
for (let g = 0; g < 300; g++) {
  const seats = g % 2 ? ['hard', 'easy'] : ['easy', 'hard'];
  let s = newGame(['x', 'y'], rnd);
  while (!s.over) s = applyMove(s, s.turn, pickMove(s, s.turn, seats[s.turn], rnd));
  if (s.winner === null) continue;
  decided++;
  if (seats[s.winner] === 'hard') hardWins++;
}
assert.ok(hardWins / decided > 0.6, `hard beat easy only ${hardWins}/${decided}`);

// Translations: Vietnamese has every key, with the same {placeholders}, and every
// error code the engine can throw has text.
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
assert.deepEqual(Object.keys(STRINGS.vi).sort(), Object.keys(STRINGS.en).sort());
for (const [key, en] of Object.entries(STRINGS.en)) {
  const vi = STRINGS.vi[key];
  if (typeof en === 'string') assert.equal(placeholders(vi), placeholders(en), `placeholders differ in ${key}`);
  else assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort(), `word list ${key} differs`);
}
const codes = [...readFileSync(new URL('./game.js', import.meta.url), 'utf8').matchAll(/throw new Error\('(\w+)'\)/g)].map(m => m[1]);
assert.ok(codes.length >= 6);
for (const code of codes) assert.ok(STRINGS.en[`err_${code}`] && STRINGS.vi[`err_${code}`], `no text for ${code}`);

console.log('game rules ok');

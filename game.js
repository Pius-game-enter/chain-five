// Rules engine. Pure functions over plain JSON, so the host can validate a move
// and send the resulting state straight over the wire.

export const SIZE = 10;
export const CORNERS = [0, 9, 90, 99];
export const LINE_LENGTH = 5;
export const LINES_TO_WIN = 2;
export const HAND_SIZE = 7;

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const WILD_JACKS = ['JD', 'JC'];
const REMOVE_JACKS = ['JS', 'JH'];
export const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export const isWild = card => WILD_JACKS.includes(card);
export const isRemove = card => REMOVE_JACKS.includes(card);
const isJack = card => card[0] === 'J';

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// The fixed board. The top half holds every non-jack card once, snaking row by row
// through each suit in rank order. The bottom half repeats it five rows down, mirrored,
// so the two copies of a card are never close. Where the mirror lands on a corner,
// the card comes from the row above instead.
const BOARD_SUITS = ['S', 'H', 'C', 'D'];
const HALF = SIZE / 2;

function buildLayout() {
  const order = BOARD_SUITS.flatMap(s => RANKS.filter(r => r !== 'J').map(r => r + s));
  const layout = Array(SIZE * SIZE).fill(null);
  let next = 0;
  for (let r = 0; r < HALF; r++) {
    const cols = [...Array(SIZE).keys()];
    if (r % 2) cols.reverse();
    for (const c of cols) if (!CORNERS.includes(r * SIZE + c)) layout[r * SIZE + c] = order[next++];
  }
  for (let r = HALF; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (CORNERS.includes(r * SIZE + c)) continue;
      let source = (r - HALF) * SIZE + (SIZE - 1 - c);
      if (CORNERS.includes(source)) source = (HALF - 1) * SIZE + (SIZE - 1 - c);
      layout[r * SIZE + c] = layout[source];
    }
  }
  return layout;
}

export const BOARD_LAYOUT = buildLayout();

export function newGame(names, random = Math.random) {
  const board = BOARD_LAYOUT.map(card => ({ card, owner: null, locked: false }));
  const fullDeck = SUITS.flatMap(s => RANKS.map(r => r + s));
  const deck = shuffle([...fullDeck, ...fullDeck], random);
  return {
    board,
    deck,
    hands: names.map(() => deck.splice(0, HAND_SIZE)),
    names: [...names],
    lines: names.map(() => 0),
    chains: [],
    turn: Math.floor(random() * names.length),
    last: null,
    over: false,
    winner: null,
  };
}

export function targets(board, card, player) {
  const cells = [];
  board.forEach((cell, i) => {
    if (cell.card === null) return;
    const ok = isRemove(card)
      ? cell.owner !== null && cell.owner !== player && !cell.locked
      : cell.owner === null && (isWild(card) || cell.card === card);
    if (ok) cells.push(i);
  });
  return cells;
}

// Both spots for this card are taken, so it can be swapped for a fresh one.
export const isDead = (board, card) => !isJack(card) && targets(board, card).length === 0;

function hasMove(state, player) {
  const hand = state.hands[player];
  return hand.some(card => targets(state.board, card, player).length > 0)
    || (state.deck.length > 0 && hand.some(card => isDead(state.board, card)));
}

// Lock every new five-in-a-row through `at` and return their cells. A new line
// may reuse at most one chip from a line already made; corners count for everyone.
function claimLines(board, at, player) {
  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const counts = (r, c) => inside(r, c) && (board[r * SIZE + c].owner === player || board[r * SIZE + c].card === null);
  const made = [];
  for (const [dr, dc] of DIRECTIONS) {
    let r = Math.floor(at / SIZE);
    let c = at % SIZE;
    while (counts(r - dr, c - dc)) { r -= dr; c -= dc; }
    const run = [];
    while (counts(r, c)) { run.push(r * SIZE + c); r += dr; c += dc; }
    for (let k = 0; k + LINE_LENGTH <= run.length; k++) {
      const window = run.slice(k, k + LINE_LENGTH);
      if (window.filter(i => board[i].locked).length > 1) continue;
      window.forEach(i => { if (board[i].card !== null) board[i].locked = true; });
      made.push(window);
    }
  }
  return made;
}

// Errors are thrown as short codes; the UI turns them into text in the player's language.
export function applyMove(state, player, move) {
  if (state.over) throw new Error('game_over');
  if (player !== state.turn) throw new Error('not_your_turn');
  if (!state.hands[player].includes(move?.card)) throw new Error('not_in_hand');

  const next = structuredClone(state);
  const hand = next.hands[player];
  hand.splice(hand.indexOf(move.card), 1);

  if (move.type === 'swap') {
    if (!isDead(state.board, move.card)) throw new Error('not_dead');
    if (next.deck.length === 0) throw new Error('deck_empty');
    hand.push(next.deck.pop());
    return next;
  }
  if (move.type !== 'play' || !targets(state.board, move.card, player).includes(move.cell)) {
    throw new Error('bad_move');
  }

  const cell = next.board[move.cell];
  const removed = isRemove(move.card);
  if (removed) cell.owner = null;
  else {
    cell.owner = player;
    const made = claimLines(next.board, move.cell, player);
    next.lines[player] += made.length;
    // Saves from before chains were recorded have none, so start the list here.
    next.chains = [...(next.chains ?? []), ...made.map(cells => ({ player, cells }))];
  }
  if (next.deck.length > 0) hand.push(next.deck.pop());
  next.last = { player, card: move.card, cell: move.cell, removed };

  if (next.lines[player] >= LINES_TO_WIN) {
    next.over = true;
    next.winner = player;
  } else {
    next.turn = (player + 1) % next.hands.length;
    // Out of cards with nothing playable: end in a draw instead of hanging the turn.
    if (!hasMove(next, next.turn)) next.over = true;
  }
  return next;
}

// What one player may see: their own hand, only counts for everything hidden.
export function viewFor(state, player) {
  return {
    ...state,
    deck: state.deck.length,
    hands: state.hands.map((hand, i) => (i === player ? hand : hand.length)),
    me: player,
  };
}

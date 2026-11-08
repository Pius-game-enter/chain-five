// Computer opponent. Scores every legal move by the five-cell windows it touches.
// It sees only the board and its own hand, never yours.
import { SIZE, LINE_LENGTH, DIRECTIONS, targets, isDead, isWild, isRemove } from './game.js';

// Indexed by how many of a window's other four cells already count for the player.
// Four means the move completes a line.
const WINDOW_VALUE = [1, 4, 20, 120, 5000];
const TIE_JITTER = 0.5; // breaks ties so the computer does not replay the same game

// blockWeight: how much stopping the opponent counts against building our own line.
// wildCost, removeCost: what spending a jack costs, so they are saved for moves that matter.
// mistakeRate: chance of playing a random legal move instead of the best one.
// Tuning weights barely changes strength (card luck dominates), so levels differ by mistakes.
export const LEVELS = {
  easy: { blockWeight: 0, wildCost: 60, removeCost: 80, mistakeRate: 0.5 },
  medium: { blockWeight: 0.5, wildCost: 60, removeCost: 80, mistakeRate: 0.2 },
  hard: { blockWeight: 0.5, wildCost: 60, removeCost: 80, mistakeRate: 0 },
};

// How much a cell is worth to `player` if they owned it.
function cellValue(board, cell, player) {
  const row = Math.floor(cell / SIZE);
  const col = cell % SIZE;
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    for (let start = 1 - LINE_LENGTH; start <= 0; start++) {
      let own = 0;
      let locked = 0;
      let open = true;
      for (let k = 0; k < LINE_LENGTH && open; k++) {
        const r = row + (start + k) * dr;
        const c = col + (start + k) * dc;
        if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) { open = false; break; }
        const i = r * SIZE + c;
        if (i === cell) continue;
        const { card, owner } = board[i];
        if (card === null || owner === player) own++;
        else if (owner !== null) open = false;
        if (owner === player && board[i].locked) locked++;
      }
      // A new line may reuse only one chip from a finished one.
      if (open && locked <= 1) total += WINDOW_VALUE[own];
    }
  }
  return total;
}

export function pickMove(state, player, level = 'hard', random = Math.random) {
  const { blockWeight, wildCost, removeCost, mistakeRate } = LEVELS[level];
  const { board } = state;
  const hand = state.hands[player];
  const opponent = (player + 1) % state.hands.length;

  const dead = hand.find(card => isDead(board, card));
  if (dead && state.deck.length > 0) return { type: 'swap', card: dead };

  const moves = [];
  for (const card of new Set(hand)) {
    for (const cell of targets(board, card, player)) {
      let score;
      if (isRemove(card)) {
        const emptied = board.map((c, i) => (i === cell ? { ...c, owner: null } : c));
        score = cellValue(emptied, cell, opponent) - removeCost;
      } else {
        score = cellValue(board, cell, player) + blockWeight * cellValue(board, cell, opponent);
        if (isWild(card)) score -= wildCost;
      }
      moves.push({ score: score + random() * TIE_JITTER, move: { type: 'play', card, cell } });
    }
  }
  if (moves.length === 0) return null;

  if (random() < mistakeRate) {
    // Pick a card first, then a spot; picking among all moves would nearly always spend a wild jack.
    const cards = [...new Set(moves.map(m => m.move.card))];
    const card = cards[Math.floor(random() * cards.length)];
    const options = moves.filter(m => m.move.card === card);
    return options[Math.floor(random() * options.length)].move;
  }
  return moves.reduce((best, m) => (m.score > best.score ? m : best)).move;
}

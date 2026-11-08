import { SIZE, LINES_TO_WIN, newGame, applyMove, viewFor, targets, isDead, isWild, isRemove } from './game.js';
import { pickMove, LEVELS } from './bot.js';
import { t, pick, hasText, setLang, otherLang, detectLang, isLang } from './i18n.js';

// The host's browser owns the real game and checks every move. The guest only
// sends moves and draws whatever state comes back.
const ROOM_PREFIX = 'chain-five-';
const ROOM_CODE = /^[a-z0-9]{1,32}$/i;
const NAME_KEY = 'chain-five-name';
const LEVEL_KEY = 'chain-five-level';
const LANG_KEY = 'chain-five-lang';
const MAX_NAME = 20;
const TOAST_MS = 2800;
const CONNECT_TIMEOUT_MS = 15000;
const BOT_DELAY_MS = 900;
const TURN_BUZZ_MS = 30;
const HOST = 0;
const GUEST = 1;
const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SVG_NS = 'http://www.w3.org/2000/svg';
// Suit glyphs from the deck in cards/, drawn small on the board cells.
const SUIT_GLYPH = {
  S: '<path d="M0 -75 C-19 -43 -68 -16 -68 23 C-68 51 -45 66 -25 57 C-11 50 -5 41 0 28 C5 41 11 50 25 57 C45 66 68 51 68 23 C68 -16 19 -43 0 -75 Z M-14 42 Q-16 78 -32 84 L32 84 Q16 78 14 42 Z"/>',
  H: '<path d="M 0 62 C -20 38 -65 7 -65 -28 C -65 -75 -13 -80 0 -39 C 13 -80 65 -75 65 -28 C 65 7 20 38 0 62 Z"/>',
  D: '<path d="M 0 -70 L 57 0 L 0 70 L -57 0 Z"/>',
  C: '<circle cx="0" cy="-36" r="35"/><circle cx="-37" cy="13" r="35"/><circle cx="37" cy="13" r="35"/><path d="M-15 15 L15 15 C9 53 20 69 34 78 L-34 78 C-20 69 -9 53 -15 15 Z"/>',
};

const $ = id => document.getElementById(id);
const roomParam = new URLSearchParams(location.search).get('room');
// The code becomes part of a peer id, so anything but plain letters and digits is refused.
const roomCode = roomParam !== null && ROOM_CODE.test(roomParam) ? roomParam : null;

let isHost = false;
let game = null;     // host only: the full state, including both hands and the deck
let view = null;     // what this screen draws, the same shape for host and guest
let conn = null;
let myName = '';
let selected = null; // index into my hand
let rematchAsked = false;
let vsBot = false;   // the computer plays the guest seat in this tab
let botTimer;
let botLevel = 'medium';
let wakeLock = null;

const cleanName = value => String(value ?? '').trim().slice(0, MAX_NAME);
const rankOf = card => (card[0] === 'T' ? '10' : card[0]);
const suitOf = card => SUIT_SYMBOL[card[1]];
const label = card => rankOf(card) + suitOf(card);
const cardImage = card => `cards/${rankOf(card)}_${card[1]}.svg`;
const cardName = card => t('card', { rank: pick('rank', card[0]), suit: pick('suit', card[1]) });
const myHand = () => view.hands[view.me];
const selectedCard = () => (selected === null ? null : myHand()[selected]);
const myTurn = () => view && !view.over && view.turn === view.me;
// The computer's name follows the chosen language, so it is never read from the game state.
const playerName = p => (vsBot && p === GUEST ? pick('bot', botLevel) : view.names[p]);
const opponentName = () => (view ? playerName(1 - view.me) : t('opponent'));
// Engine errors arrive as codes, possibly from the other player, so unknown ones get a generic text.
const errorText = code => t(hasText(`err_${code}`) ? `err_${code}` : 'err_bad_move');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let toastTimer;
function toast(message) {
  const box = $('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, TOAST_MS);
}

function show(screen) {
  for (const id of ['lobby', 'waiting', 'game']) $(id).hidden = id !== screen;
}

function loadPref(key) {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function savePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode, the choice just is not remembered */ }
}

// Installable and playable offline against the computer.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Lobby

const savedLang = loadPref(LANG_KEY);
$('lobby-hint').dataset.i18n = roomCode ? 'hint_invited' : 'hint';
$('start').dataset.i18n = roomCode ? 'join' : 'create';
setLang(isLang(savedLang) ? savedLang : detectLang());

$('name').value = loadPref(NAME_KEY);
const savedLevel = loadPref(LEVEL_KEY);
if (LEVELS[savedLevel]) document.querySelector(`input[name="level"][value="${savedLevel}"]`).checked = true;
if (roomCode) $('bot-options').hidden = true;
if (roomParam !== null && !roomCode) $('lobby-error').textContent = t('err_bad_link');

document.querySelectorAll('[data-lang-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    const next = otherLang();
    savePref(LANG_KEY, next);
    setLang(next);
    if (view) redraw();
  });
});

$('bot').addEventListener('click', () => {
  myName = cleanName($('name').value) || t('player');
  savePref(NAME_KEY, myName);
  botLevel = document.querySelector('input[name="level"]:checked').value;
  savePref(LEVEL_KEY, botLevel);
  isHost = true;
  vsBot = true;
  game = newGame([myName, 'computer']);
  publish();
});

$('lobby-form').addEventListener('submit', event => {
  event.preventDefault();
  myName = cleanName($('name').value) || t('player');
  savePref(NAME_KEY, myName);
  $('lobby-error').textContent = '';
  if (!window.Peer) return fail(t('err_no_network_lib'));
  $('start').disabled = true;
  setStartLabel('connecting');
  if (roomCode) join(); else host();
});

function setStartLabel(key) {
  $('start').dataset.i18n = key;
  $('start').textContent = t(key);
}

function fail(message) {
  show('lobby');
  $('start').disabled = false;
  setStartLabel(roomCode ? 'join' : 'create');
  $('lobby-error').textContent = message;
}

function onPeerError(error) {
  const message = error.type === 'peer-unavailable'
    ? t('err_room_closed')
    : t('err_connection', { type: error.type ?? error.message });
  if (view) toast(message); else fail(message);
}

document.querySelectorAll('[data-rules]').forEach(button => {
  button.addEventListener('click', () => $('rules').showModal());
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('invite-link').value);
    toast(t('copied'));
  } catch {
    $('invite-link').select();
    toast(t('copy_manually'));
  }
});
if (navigator.share) {
  $('share').hidden = false;
  $('share').addEventListener('click', () => {
    navigator.share({ title: 'Chain Five', text: t('share_text'), url: $('invite-link').value }).catch(() => {});
  });
}

// Network

function host() {
  isHost = true;
  const code = crypto.randomUUID().slice(0, 8);
  // ponytail: rooms ride the free PeerJS broker; self-host peerjs-server if it gets flaky.
  const peer = new Peer(ROOM_PREFIX + code);
  peer.on('open', () => {
    $('invite-link').value = `${location.origin}${location.pathname}?room=${code}`;
    show('waiting');
  });
  peer.on('connection', c => {
    c.on('data', message => onGuestMessage(c, message));
    c.on('close', () => {
      if (c !== conn) return;
      conn = null;
      toast(t('friend_left', { name: opponentName() }));
    });
  });
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', onPeerError);
  // The game only lives in this tab, so warn before a reload throws it away.
  window.addEventListener('beforeunload', event => { if (game && !game.over) event.preventDefault(); });
}

function onGuestMessage(c, message) {
  if (message?.type === 'hello') {
    // ponytail: whoever opens the link last takes the guest seat; add a seat token if strangers get links.
    if (conn && conn !== c) conn.close();
    conn = c;
    const guestName = cleanName(message.name) || t('guest');
    if (game) game.names[GUEST] = guestName;
    else game = newGame([myName, guestName]);
    publish();
    return;
  }
  if (c !== conn) return;
  if (message?.type === 'move') hostMove(GUEST, message.move, code => c.send({ type: 'error', code }));
  if (message?.type === 'rematch' && game.over) startRematch();
}

// onError gets the engine's error code; each side turns it into text in its own language.
function hostMove(player, move, onError) {
  try {
    game = applyMove(game, player, move);
  } catch (error) {
    onError(error.message);
    return;
  }
  publish();
}

const showError = code => toast(errorText(code));

function publish() {
  render(viewFor(game, HOST));
  if (conn?.open) conn.send({ type: 'state', state: viewFor(game, GUEST) });
  if (vsBot) scheduleBot();
}

// A dead-card swap keeps the turn, so this simply runs again after it.
function scheduleBot() {
  clearTimeout(botTimer);
  if (game.over || game.turn !== GUEST) return;
  botTimer = setTimeout(() => {
    const move = pickMove(game, GUEST, botLevel);
    if (move) hostMove(GUEST, move, showError);
  }, BOT_DELAY_MS);
}

function startRematch() {
  game = newGame(game.names);
  publish();
}

function join() {
  const peer = new Peer();
  setTimeout(() => { if (!view) fail(t('err_unreachable')); }, CONNECT_TIMEOUT_MS);
  peer.on('open', () => {
    conn = peer.connect(ROOM_PREFIX + roomCode, { reliable: true });
    conn.on('open', () => conn.send({ type: 'hello', name: myName }));
    conn.on('data', message => {
      if (message?.type === 'state') render(message.state);
      if (message?.type === 'error') showError(message.code);
    });
    conn.on('close', () => toast(t('lost_host')));
  });
  peer.on('error', onPeerError);
}

function play(move) {
  selected = null;
  if (isHost) {
    hostMove(HOST, move, showError);
  } else if (conn?.open) {
    conn.send({ type: 'move', move });
    render(view);
  } else {
    toast(t('not_connected'));
  }
}

// Rendering

const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const node = el('button', 'cell');
  node.type = 'button';
  node.addEventListener('click', () => onCell(i));
  $('board').append(node);
  return node;
});

function onCell(i) {
  if (!myTurn()) return toast(t('their_turn', { name: opponentName() }));
  const card = selectedCard();
  if (!card) return toast(t('pick_first'));
  if (targets(view.board, card, view.me).includes(i)) play({ type: 'play', card, cell: i });
}

function render(next) {
  const turnArrived = view && view.turn !== view.me && next.turn === next.me && !next.over;
  if (turnArrived) navigator.vibrate?.(TURN_BUZZ_MS);
  if (!view || myHand().join() !== next.hands[next.me].join()) selected = null;
  if (!next.over) rematchAsked = false;
  view = next;
  show('game');
  keepAwake();
  renderPlayers();
  renderBoard();
  renderHand();
  renderStatus();
}

// After a language switch every cell and card label is rebuilt, not just the changed ones.
function redraw() {
  cells.forEach(node => { delete node.dataset.key; });
  delete $('hand').dataset.key;
  render(view);
}

// A phone that sleeps mid-game drops the live connection, so keep the screen on while playing.
async function keepAwake() {
  if (view.over || (wakeLock && !wakeLock.released)) return;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    // Not supported or refused; the game still works, the screen may just dim.
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && view) keepAwake();
});

function renderPlayers() {
  view.names.forEach((_, p) => {
    const name = playerName(p);
    const box = $(`player-${p}`);
    box.classList.toggle('active', view.turn === p && !view.over);
    box.querySelector('.pname').textContent = p === view.me ? t('you') : name;
    box.querySelector('.lines').replaceChildren(
      ...Array.from({ length: LINES_TO_WIN }, (_, k) => el('span', k < view.lines[p] ? 'pip on' : 'pip')),
    );
    box.title = t('lines_title', { name, n: view.lines[p], total: LINES_TO_WIN });
  });
}

function renderBoard() {
  const card = selectedCard();
  const open = new Set(card ? targets(view.board, card, view.me) : []);
  $('board').classList.toggle('picking', open.size > 0);
  $('board-frame').className = `board-frame${view.over ? '' : ` turn-${view.turn}`}`;

  view.board.forEach((cell, i) => {
    const node = cells[i];
    // Only rebuild a cell when it changes, so chip animations play once.
    const key = `${cell.card}|${cell.owner}|${cell.locked}`;
    if (node.dataset.key !== key) {
      node.dataset.key = key;
      node.replaceChildren(...cellContent(cell, i));
      node.classList.toggle('free', cell.card === null);
      node.classList.toggle('locked', cell.locked);
      const owner = cell.owner === null ? '' : t('chip_of', { name: playerName(cell.owner) });
      node.setAttribute('aria-label', (cell.card ? cardName(cell.card) : t('free_corner')) + owner);
    }
    node.classList.toggle('target', open.has(i));
    node.classList.toggle('remove', open.has(i) && isRemove(card));
    node.classList.toggle('last', view.last?.cell === i);
  });
}

function cellContent(cell, i) {
  if (cell.card === null) return [];
  const face = el('span', `face suit-${cell.card[1]}`);
  const suit = document.createElementNS(SVG_NS, 'svg');
  suit.setAttribute('class', 'suit');
  suit.setAttribute('viewBox', '-80 -80 160 160');
  // A fixed glyph picked by suit letter; a missing suit from a bad state just draws nothing.
  suit.innerHTML = SUIT_GLYPH[cell.card[1]] ?? '';
  face.append(el('span', 'rank', rankOf(cell.card)), suit);
  if (cell.owner === null) return [face];
  const fresh = view.last?.cell === i && !view.last.removed;
  return [face, el('span', `chip p${cell.owner}${fresh ? ' fresh' : ''}`)];
}

function renderHand() {
  const hand = myHand();
  const box = $('hand');
  if (box.dataset.key !== hand.join()) {
    box.dataset.key = hand.join();
    box.replaceChildren(...hand.map(handCard));
  }
  [...box.children].forEach((node, k) => {
    node.classList.toggle('selected', k === selected);
    node.classList.toggle('dead', isDead(view.board, hand[k]));
  });
  box.classList.toggle('idle', !myTurn());
}

function handCard(card, k) {
  const kind = isWild(card) ? ' wild' : isRemove(card) ? ' remove' : '';
  const node = el('button', `card${kind}`);
  node.type = 'button';
  node.setAttribute('aria-label', cardName(card));
  const face = el('img');
  face.src = cardImage(card);
  face.alt = '';
  node.append(face);
  if (isWild(card)) node.append(el('span', 'tag', t('tag_wild')));
  if (isRemove(card)) node.append(el('span', 'tag', t('tag_remove')));
  node.addEventListener('click', () => {
    selected = selected === k ? null : k;
    renderBoard();
    renderHand();
    renderStatus();
  });
  return node;
}

function statusText() {
  const card = selectedCard();
  if (view.over) {
    if (view.winner === null) return t('draw');
    return view.winner === view.me ? t('you_win') : t('wins', { name: playerName(view.winner) });
  }
  if (!myTurn()) return t('thinking', { name: opponentName() });
  if (!card) return t('your_turn_pick');
  if (isDead(view.board, card)) return t('dead_card');
  if (isWild(card)) return t('wild_status');
  if (isRemove(card)) {
    return targets(view.board, card, view.me).length ? t('remove_status', { name: opponentName() }) : t('remove_none');
  }
  return t('drop');
}

function lastMoveText() {
  const last = view.last;
  if (!last) return view.turn === view.me ? t('you_first') : t('goes_first', { name: playerName(view.turn) });
  const who = last.player === view.me ? t('you') : playerName(last.player);
  return t(last.removed ? 'removed' : 'played', { who, card: label(last.card) });
}

function renderStatus() {
  const card = selectedCard();
  $('status').textContent = statusText();
  $('last-move').textContent = lastMoveText();
  $('side').className = `side${view.over && view.winner !== null ? ` won-${view.winner}` : ''}`;
  $('swap').hidden = !(myTurn() && card && isDead(view.board, card) && view.deck > 0);
  $('rematch').hidden = !view.over;
  $('rematch').disabled = rematchAsked;
  $('rematch').textContent = t(rematchAsked ? 'waiting_host' : 'play_again');
  $('deck-count').textContent = view.deck;
  document.title = myTurn() ? `${t('title_turn')} | Chain Five` : 'Chain Five';
}

$('swap').addEventListener('click', () => {
  const card = selectedCard();
  if (card) play({ type: 'swap', card });
});

$('rematch').addEventListener('click', () => {
  if (isHost) return startRematch();
  if (!conn?.open) return toast(t('not_connected'));
  conn.send({ type: 'rematch' });
  rematchAsked = true;
  renderStatus();
});

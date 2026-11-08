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
const SAVE_KEY = 'chain-five-save'; // the game this browser hosts, or plays against the computer
const JOIN_KEY = 'chain-five-join'; // the room this browser last joined as a guest
const SAVE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_NAME = 20;
const TOAST_MS = 2800;
const CONNECT_TIMEOUT_MS = 15000;
const RECLAIM_TRIES = 8;
const RECLAIM_DELAY_MS = 2000;
const RECONNECT_EVERY_MS = 3000;
const RECONNECT_WINDOW_MS = 2 * 60 * 1000;
const BYE_FLUSH_MS = 150;
const BOT_DELAY_MS = 900;
const TURN_BUZZ_MS = 30;
const HOST = 0;
const GUEST = 1;
const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SVG_NS = 'http://www.w3.org/2000/svg';
const CHAIN_THICKNESS = 0.92; // outline height around a finished line, in board cells
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
let peer = null;
let conn = null;
let hostCode = null; // host only: the room code, kept so a reload can reopen the same room
let myName = '';
let selected = null; // index into my hand
let rematchAsked = false;
let vsBot = false;   // the computer plays the guest seat in this tab
let botTimer;
let botLevel = 'medium';
let wakeLock = null;
let reconnecting = false; // guest only: the host dropped and we are trying to get back in
let hostEnded = false;    // guest only: the host left on purpose
let leaving = false;

const cleanName = value => String(value ?? '').trim().slice(0, MAX_NAME);
const rankOf = card => (card[0] === 'T' ? '10' : card[0]);
const suitOf = card => SUIT_SYMBOL[card[1]];
const label = card => rankOf(card) + suitOf(card);
const cardImage = card => `cards/${rankOf(card)}_${card[1]}.svg`;
const cardName = card => t('card', { rank: pick('rank', card[0]), suit: pick('suit', card[1]) });
const myHand = () => view.hands[view.me];
const selectedCard = () => (selected === null ? null : myHand()[selected]);
// A game someone can still move in; the host ending it freezes the guest's copy.
const live = () => view && !view.over && !hostEnded;
const myTurn = () => live() && view.turn === view.me;
// The computer's name follows the chosen language, so it is never read from the game state.
const playerName = p => (vsBot && p === GUEST ? pick('bot', botLevel) : view.names[p]);
const opponentName = () => (view ? playerName(1 - view.me) : t('opponent'));
const opponentAway = () => isHost && !vsBot && !conn?.open;
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
function clearPref(key) {
  try { localStorage.removeItem(key); } catch { /* nothing stored */ }
}

// Saved records come from storage this whole github.io origin shares, so check their shape before trusting them.
function loadRecord(key) {
  try {
    const record = JSON.parse(loadPref(key) || 'null');
    return record && Date.now() - record.savedAt < SAVE_MAX_AGE_MS ? record : null;
  } catch {
    return null;
  }
}
function loadSavedGame() {
  const save = loadRecord(SAVE_KEY);
  if (save?.game?.board?.length !== SIZE * SIZE || typeof save.name !== 'string') return null;
  if (save.kind === 'bot' && LEVELS[save.level] && !save.game.over) return save;
  if (save.kind === 'host' && ROOM_CODE.test(save.code)) return save;
  return null;
}

// Called after every change, so a reload or a closed tab can pick the game up again.
function saveGame() {
  if (vsBot && game.over) return clearPref(SAVE_KEY);
  const base = { name: myName, game, savedAt: Date.now() };
  const record = vsBot ? { ...base, kind: 'bot', level: botLevel } : { ...base, kind: 'host', code: hostCode };
  savePref(SAVE_KEY, JSON.stringify(record));
}

// Installable and playable offline against the computer.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Browsers only allow their own generic prompt here; the custom one is behind the leave button.
window.addEventListener('beforeunload', event => {
  if (view && !view.over && !leaving && !hostEnded) event.preventDefault();
});

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
  // While the guest waits for a reloading host, "room not found" is expected; keep trying.
  if (reconnecting && error.type === 'peer-unavailable') return;
  const message = error.type === 'peer-unavailable' ? t('err_room_closed')
    : error.type === 'unavailable-id' ? t('err_reopen_room')
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

// Leaving

$('leave').addEventListener('click', () => {
  if (!view || view.over) return leaveGame();
  const key = vsBot ? 'leave_bot' : isHost ? 'leave_host' : 'leave_guest';
  $('leave-text').textContent = t(key, { name: opponentName() });
  $('leave-dialog').showModal();
});

$('leave-dialog').addEventListener('close', () => {
  if ($('leave-dialog').returnValue === 'leave') leaveGame();
});

function leaveGame() {
  leaving = true;
  clearTimeout(botTimer);
  clearPref(isHost ? SAVE_KEY : JOIN_KEY);
  // Tell the other side it was on purpose, so they are not left waiting to reconnect.
  if (conn?.open) conn.send({ type: 'bye' });
  setTimeout(() => {
    peer?.destroy();
    location.replace(location.pathname);
  }, conn?.open ? BYE_FLUSH_MS : 0);
}

// Network

function host(code = crypto.randomUUID().slice(0, 8), tries = 0) {
  isHost = true;
  hostCode = code;
  // ponytail: rooms ride the free PeerJS broker; self-host peerjs-server if it gets flaky.
  peer = new Peer(ROOM_PREFIX + code);
  peer.on('open', () => {
    $('invite-link').value = `${location.origin}${location.pathname}?room=${code}`;
    if (game) publish(); else show('waiting');
  });
  peer.on('connection', c => {
    c.on('data', message => onGuestMessage(c, message));
    c.on('close', () => {
      if (c !== conn) return;
      conn = null;
      toast(t('friend_left', { name: opponentName() }));
      if (view) renderStatus();
    });
  });
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', error => {
    // Right after a reload the broker can still hold the old room id for a moment.
    if (error.type === 'unavailable-id' && game && tries < RECLAIM_TRIES) {
      peer.destroy();
      setTimeout(() => host(code, tries + 1), RECLAIM_DELAY_MS);
      return;
    }
    onPeerError(error);
  });
}

function onGuestMessage(c, message) {
  if (message?.type === 'hello') {
    // ponytail: whoever opens the link last takes the guest seat; add a seat token if strangers get links.
    if (conn && conn !== c) conn.close();
    const returning = Boolean(game && view);
    conn = c;
    const guestName = cleanName(message.name) || t('guest');
    if (game) game.names[GUEST] = guestName;
    else game = newGame([myName, guestName]);
    publish();
    if (returning) toast(t('friend_back', { name: guestName }));
    return;
  }
  if (c !== conn) return;
  if (message?.type === 'move') hostMove(GUEST, message.move, code => c.send({ type: 'error', code }));
  if (message?.type === 'rematch' && game.over) startRematch();
  if (message?.type === 'bye') c.close();
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
  saveGame();
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
  peer = new Peer();
  setTimeout(() => { if (!view) fail(t('err_unreachable')); }, CONNECT_TIMEOUT_MS);
  peer.on('open', connectToHost);
  peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
  peer.on('error', onPeerError);
}

function connectToHost() {
  conn = peer.connect(ROOM_PREFIX + roomCode, { reliable: true });
  const current = conn;
  conn.on('open', () => conn.send({ type: 'hello', name: myName }));
  conn.on('data', message => {
    if (message?.type === 'state') {
      reconnecting = false;
      savePref(JOIN_KEY, JSON.stringify({ code: roomCode, name: myName, savedAt: Date.now() }));
      render(message.state);
    }
    if (message?.type === 'error') showError(message.code);
    if (message?.type === 'bye') {
      hostEnded = true;
      clearPref(JOIN_KEY);
      if (view) renderStatus();
    }
  });
  conn.on('close', () => { if (current === conn && view) keepReconnecting(); });
}

// The host may just be reloading; keep knocking for a while before giving up.
function keepReconnecting() {
  if (leaving || hostEnded || reconnecting) return;
  reconnecting = true;
  if (view) renderStatus();
  const deadline = Date.now() + RECONNECT_WINDOW_MS;
  const timer = setInterval(() => {
    if (!reconnecting || hostEnded) return clearInterval(timer);
    if (Date.now() > deadline) {
      clearInterval(timer);
      reconnecting = false;
      if (view) renderStatus();
      toast(t('lost_host'));
      return;
    }
    if (!conn?.open) connectToHost();
  }, RECONNECT_EVERY_MS);
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

// Pick up where this browser left off: a hosted or computer game after a reload,
// or the room it had joined when the invite link is opened again.
function resume() {
  if (roomCode) {
    const joined = loadRecord(JOIN_KEY);
    if (joined?.code === roomCode && typeof joined.name === 'string') {
      $('name').value = joined.name;
      $('lobby-form').requestSubmit();
    }
    return;
  }
  const save = loadSavedGame();
  if (!save) return;
  myName = save.name;
  game = save.game;
  isHost = true;
  if (save.kind === 'bot') {
    vsBot = true;
    botLevel = save.level;
    publish();
  } else {
    hostCode = save.code;
    publish();
    if (window.Peer) host(save.code);
  }
  toast(t('resumed'));
}

// Rendering

const cells = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const node = el('button', 'cell');
  node.type = 'button';
  node.addEventListener('click', () => onCell(i));
  $('board').append(node);
  return node;
});

// Finished lines are outlined over the chips, one board cell per unit.
const chainLayer = document.createElementNS(SVG_NS, 'svg');
chainLayer.setAttribute('class', 'chains');
chainLayer.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
chainLayer.setAttribute('aria-hidden', 'true');
$('board').append(chainLayer);

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
    box.classList.toggle('active', view.turn === p && live());
    box.classList.toggle('idle', view.turn !== p && live());
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
  $('board-frame').className = `board-frame${live() ? ` turn-${view.turn}` : ''}${myTurn() ? ' mine' : ''}`;
  $('board').classList.toggle('over', view.over);
  $('board').classList.toggle('last-removed', Boolean(view.last?.removed));
  $('board').dataset.last = view.last?.player ?? '';

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
  renderChains();
}

// Only new chains are appended so each outline draws in once; a rematch starts the layer over.
function renderChains() {
  const chains = view.chains ?? [];
  if (chains.length < chainLayer.childElementCount) chainLayer.replaceChildren();
  chains.slice(chainLayer.childElementCount).forEach(({ player, cells: line }) => {
    // A capsule around the five cells: centre to centre, padded by half a cell, turned to the line's angle.
    const [[x1, y1], [x2, y2]] = [line[0], line.at(-1)].map(i => [(i % SIZE) + 0.5, Math.floor(i / SIZE) + 0.5]);
    const length = Math.hypot(x2 - x1, y2 - y1) + CHAIN_THICKNESS;
    const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
    const ring = document.createElementNS(SVG_NS, 'rect');
    ring.setAttribute('class', `chain p${player}`);
    ring.setAttribute('pathLength', '1');
    ring.setAttribute('x', cx - length / 2);
    ring.setAttribute('y', cy - CHAIN_THICKNESS / 2);
    ring.setAttribute('width', length);
    ring.setAttribute('height', CHAIN_THICKNESS);
    ring.setAttribute('rx', CHAIN_THICKNESS / 2);
    ring.setAttribute('transform', `rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI} ${cx} ${cy})`);
    chainLayer.append(ring);
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
  if (hostEnded) return t('host_ended', { name: opponentName() });
  if (view.over) {
    if (view.winner === null) return t('draw');
    return view.winner === view.me ? t('you_win') : t('wins', { name: playerName(view.winner) });
  }
  if (reconnecting) return t('reconnecting', { name: opponentName() });
  if (!myTurn()) return t(opponentAway() ? 'waiting_rejoin' : 'thinking', { name: opponentName() });
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
  const turnClass = !live() ? '' : ` turn-${view.turn}${myTurn() ? ' mine' : ''}`;
  $('side').className = `side${view.over && view.winner !== null ? ` won-${view.winner}` : turnClass}`;
  $('swap').hidden = !(myTurn() && card && isDead(view.board, card) && view.deck > 0);
  $('rematch').hidden = !view.over || hostEnded;
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

resume();

// UI text in English and Vietnamese. A key missing in Vietnamese falls back to English.
export const STRINGS = {
  en: {
    lang_code: 'VI',
    switch_lang: 'Chuyển sang tiếng Việt',
    hint: 'Play a card, drop a chip, make five in a row. Invite a friend or take on the computer.',
    hint_invited: 'A friend invited you to a game. Pick a name and jump in.',
    your_name: 'Your name',
    name_placeholder: 'e.g. Minh',
    create: 'Create a room',
    join: 'Join the game',
    connecting: 'Connecting...',
    level: 'Computer level',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    play_bot: 'Play the computer',
    how_to_play: 'How to play',
    room_open: 'Your room is open',
    room_hint: 'Send this link to a friend. The game starts the moment they open it.',
    invite_link: 'Invite link',
    copy: 'Copy',
    share: 'Share link',
    waiting_friend: 'Waiting for your friend',
    board: 'Board',
    your_hand: 'Your hand',
    swap: 'Swap dead card',
    play_again: 'Play again',
    waiting_host: 'Waiting for host...',
    deck: 'Deck',
    got_it: 'Got it',
    rules: `<li>On your turn, play a card and drop a chip on a matching card on the board. Every card except the jacks is on the board twice.</li>
<li>Make five in a row across, down or diagonally. That is a line. <b>Two lines win.</b></li>
<li>Your second line may share one chip with your first.</li>
<li>Corners are free spots that count for everyone.</li>
<li><b>Wild jacks</b> (J♦ J♣) go on any open spot.</li>
<li><b>Remove jacks</b> (J♠ J♥) take away one of your opponent's chips. Chips in a finished line are safe.</li>
<li>If both spots for a card are taken, the card is dead. Swap it for a new one without losing your turn.</li>
<li>The board is the same every game. Each card is once in the top half and once in the bottom half, in suit and rank order, so you can learn where things are.</li>`,
    you: 'You',
    opponent: 'Your opponent',
    player: 'Player',
    guest: 'Guest',
    err_no_network_lib: 'Could not load the network library. Check your connection and reload.',
    err_room_closed: 'That room is closed. Ask your friend for a new link.',
    err_connection: 'Connection problem ({type}). Try again.',
    err_unreachable: 'Could not reach your friend. Check the link, or ask them to keep the room open.',
    err_bad_link: 'This invite link is not valid. Ask your friend to send it again.',
    copied: 'Link copied. Send it to your friend.',
    copy_manually: 'Press Ctrl+C to copy the link.',
    share_text: 'Play Chain Five with me',
    friend_left: '{name} left. They can rejoin with the same link.',
    lost_host: 'Lost the connection to the host. Reload to rejoin.',
    not_connected: 'Not connected to the host. Reload to rejoin.',
    their_turn: "It is {name}'s turn.",
    pick_first: 'Pick a card from your hand first.',
    draw: 'Draw. The cards ran out.',
    you_win: 'You win!',
    wins: '{name} wins',
    thinking: '{name} is thinking...',
    your_turn_pick: 'Your turn. Pick a card.',
    dead_card: 'Both spots are taken. Swap this card for a new one.',
    wild_status: 'Wild jack. Drop a chip on any open spot.',
    remove_status: "Remove jack. Take one of {name}'s chips.",
    remove_none: 'No chip to remove yet. Pick another card.',
    drop: 'Drop your chip on a glowing spot.',
    you_first: 'You go first.',
    goes_first: '{name} goes first.',
    played: '{who} played {card}.',
    removed: '{who} removed a chip with {card}.',
    title_turn: 'Your turn',
    lines_title: '{name}: {n} of {total} lines',
    free_corner: 'Free corner',
    chip_of: ", {name}'s chip",
    card: '{rank} of {suit}',
    tag_wild: 'Wild',
    tag_remove: 'Remove',
    dead: 'Dead',
    leave_game: 'Leave game',
    leave_title: 'Leave this game?',
    leave_bot: 'Your game against the computer will end.',
    leave_host: '{name} will lose this game too. If you only need a break, keep this page open.',
    leave_guest: 'You can come back with the same invite link while {name} keeps the room open.',
    keep_playing: 'Keep playing',
    waiting_rejoin: 'Waiting for {name} to reconnect...',
    reconnecting: 'Reconnecting to {name}...',
    resumed: 'Welcome back. Your game is restored.',
    friend_back: '{name} is back.',
    host_ended: '{name} ended the game.',
    err_reopen_room: 'Could not reopen your room. Start a new game.',
    err_game_over: 'The game is over.',
    err_not_your_turn: 'Not your turn.',
    err_not_in_hand: 'That card is not in your hand.',
    err_not_dead: 'Only a dead card can be swapped.',
    err_deck_empty: 'The deck is empty.',
    err_bad_move: 'That card cannot go there.',
    rank: { A: 'Ace', T: '10', J: 'Jack', Q: 'Queen', K: 'King' },
    suit: { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' },
    bot: { easy: 'Easy bot', medium: 'Medium bot', hard: 'Hard bot' },
  },
  vi: {
    lang_code: 'EN',
    switch_lang: 'Switch to English',
    hint: 'Đánh bài, đặt chip, xếp 5 ô thẳng hàng. Mời bạn bè hoặc đấu với máy.',
    hint_invited: 'Bạn được mời vào một ván. Nhập tên rồi vào chơi nhé.',
    your_name: 'Tên của bạn',
    name_placeholder: 'ví dụ: Minh',
    create: 'Tạo phòng',
    join: 'Vào ván',
    connecting: 'Đang kết nối...',
    level: 'Độ khó của máy',
    easy: 'Dễ',
    medium: 'Vừa',
    hard: 'Khó',
    play_bot: 'Chơi với máy',
    how_to_play: 'Cách chơi',
    room_open: 'Phòng đã mở',
    room_hint: 'Gửi link này cho bạn bè. Ván đấu bắt đầu ngay khi họ mở link.',
    invite_link: 'Link mời',
    copy: 'Sao chép',
    share: 'Chia sẻ link',
    waiting_friend: 'Đang chờ bạn bè',
    board: 'Bàn cờ',
    your_hand: 'Bài trên tay',
    swap: 'Đổi lá chết',
    play_again: 'Chơi lại',
    waiting_host: 'Đang chờ chủ phòng...',
    deck: 'Bộ bài',
    got_it: 'Đã hiểu',
    rules: `<li>Mỗi lượt, đánh một lá bài và đặt chip lên ô có lá tương ứng trên bàn. Mỗi lá (trừ J) có 2 ô trên bàn.</li>
<li>5 chip liền nhau theo hàng ngang, dọc hoặc chéo tạo thành một dãy. <b>Có 2 dãy là thắng.</b></li>
<li>Dãy thứ hai được dùng chung một chip với dãy đầu.</li>
<li>4 góc là ô tự do, tính cho cả hai người.</li>
<li><b>J tự do</b> (J♦ J♣) đặt được vào bất kỳ ô trống nào.</li>
<li><b>J gỡ</b> (J♠ J♥) gỡ một chip của đối thủ. Chip nằm trong dãy đã hoàn thành thì không gỡ được.</li>
<li>Nếu cả hai ô của một lá đã có chip, lá đó là lá chết. Đổi lấy lá mới mà không mất lượt.</li>
<li>Bàn cờ giống nhau ở mọi ván. Mỗi lá có một ô ở nửa trên và một ô ở nửa dưới, xếp theo chất và hạng, nên bạn sẽ dần thuộc vị trí.</li>`,
    you: 'Bạn',
    opponent: 'Đối thủ',
    player: 'Người chơi',
    guest: 'Khách',
    err_no_network_lib: 'Không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang.',
    err_room_closed: 'Phòng này đã đóng. Hãy nhờ bạn gửi link mới.',
    err_connection: 'Lỗi kết nối ({type}). Hãy thử lại.',
    err_unreachable: 'Không kết nối được. Kiểm tra lại link, hoặc nhờ bạn giữ phòng mở.',
    err_bad_link: 'Link mời không hợp lệ. Hãy nhờ bạn gửi lại link.',
    copied: 'Đã sao chép link. Gửi cho bạn bè nhé.',
    copy_manually: 'Nhấn Ctrl+C để sao chép link.',
    share_text: 'Chơi Chain Five với mình nhé',
    friend_left: '{name} đã rời ván. Họ có thể vào lại bằng link cũ.',
    lost_host: 'Mất kết nối với chủ phòng. Tải lại trang để vào lại.',
    not_connected: 'Chưa kết nối với chủ phòng. Tải lại trang để vào lại.',
    their_turn: 'Đang là lượt của {name}.',
    pick_first: 'Hãy chọn một lá bài trên tay trước.',
    draw: 'Hòa. Đã hết bài.',
    you_win: 'Bạn thắng!',
    wins: '{name} thắng',
    thinking: '{name} đang suy nghĩ...',
    your_turn_pick: 'Lượt của bạn. Chọn một lá bài.',
    dead_card: 'Cả hai ô của lá này đã có chip. Hãy đổi lá mới.',
    wild_status: 'J tự do: đặt chip vào bất kỳ ô trống nào.',
    remove_status: 'J gỡ: gỡ một chip của {name}.',
    remove_none: 'Chưa có chip nào để gỡ. Hãy chọn lá khác.',
    drop: 'Đặt chip vào một ô đang sáng.',
    you_first: 'Bạn đi trước.',
    goes_first: '{name} đi trước.',
    played: '{who} đánh {card}.',
    removed: '{who} gỡ một chip bằng {card}.',
    title_turn: 'Lượt của bạn',
    lines_title: '{name}: {n}/{total} dãy',
    free_corner: 'Góc tự do',
    chip_of: ', chip của {name}',
    card: '{rank} {suit}',
    tag_wild: 'Tự do',
    tag_remove: 'Gỡ',
    dead: 'Chết',
    leave_game: 'Rời ván',
    leave_title: 'Rời ván này?',
    leave_bot: 'Ván đấu với máy sẽ kết thúc.',
    leave_host: '{name} cũng sẽ mất ván này. Nếu chỉ muốn nghỉ một lát, hãy giữ trang này mở.',
    leave_guest: 'Bạn có thể vào lại bằng link mời cũ, miễn là {name} còn giữ phòng.',
    keep_playing: 'Chơi tiếp',
    waiting_rejoin: 'Đang chờ {name} kết nối lại...',
    reconnecting: 'Đang kết nối lại với {name}...',
    resumed: 'Chào mừng trở lại. Ván đấu đã được khôi phục.',
    friend_back: '{name} đã quay lại.',
    host_ended: '{name} đã kết thúc ván.',
    err_reopen_room: 'Không mở lại được phòng. Hãy bắt đầu ván mới.',
    err_game_over: 'Ván đấu đã kết thúc.',
    err_not_your_turn: 'Chưa tới lượt của bạn.',
    err_not_in_hand: 'Lá này không có trên tay bạn.',
    err_not_dead: 'Chỉ đổi được lá chết.',
    err_deck_empty: 'Bộ bài đã hết.',
    err_bad_move: 'Không đặt lá này vào ô đó được.',
    rank: { A: 'Át', T: '10', J: 'Bồi', Q: 'Đầm', K: 'Già' },
    suit: { S: 'bích', H: 'cơ', D: 'rô', C: 'chuồn' },
    bot: { easy: 'Máy dễ', medium: 'Máy vừa', hard: 'Máy khó' },
  },
};

let current = 'en';

export const getLang = () => current;
export const otherLang = () => (current === 'en' ? 'vi' : 'en');
export const isLang = value => Object.hasOwn(STRINGS, value);
export const hasText = key => Object.hasOwn(STRINGS.en, key);

// First visit: Vietnamese if the browser prefers it, English otherwise.
export const detectLang = () => ((navigator.languages ?? [navigator.language]).some(l => l?.startsWith('vi')) ? 'vi' : 'en');

export function t(key, params = {}) {
  const text = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}

// Word lists such as rank and suit names; unknown keys come back unchanged.
export function pick(group, key) {
  return STRINGS[current][group]?.[key] ?? STRINGS.en[group]?.[key] ?? key;
}

export function setLang(next) {
  current = isLang(next) ? next : 'en';
  document.documentElement.lang = current;
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(node => node.setAttribute('aria-label', t(node.dataset.i18nLabel)));
  document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  // Only fixed strings from this file go through innerHTML, never player input.
  document.querySelectorAll('[data-i18n-html]').forEach(node => { node.innerHTML = t(node.dataset.i18nHtml); });
  document.documentElement.style.setProperty('--dead-label', JSON.stringify(t('dead')));
}

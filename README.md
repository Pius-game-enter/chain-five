# Chain Five

Two-player card and chip five-in-a-row, played live in the browser. Static files only, so it runs on GitHub Pages.

## How online play works

GitHub Pages cannot run a WebSocket server, so the two browsers talk directly over WebRTC using [PeerJS](https://peerjs.com). The free PeerJS cloud broker only introduces them.

- The player who creates a room is the host. Their tab owns the real game state and checks every move (`game.js`).
- The invite link carries the room code (`?room=abc123`). Opening it connects to the host.
- Each side only receives its own hand; the opponent's hand and the deck arrive as counts.
- A guest who reloads can rejoin with the same link. If the host closes the tab, the game is gone.

## Files

- `game.js`: rules engine, pure functions. The board is fixed: the top half snakes through every non-jack card once (spades, hearts, clubs, diamonds, each from A to K), and the bottom half repeats it five rows down and mirrored, so the two copies of a card are never neighbours.
- `app.js`: screens, rendering and networking
- `bot.js`: the computer opponent. It scores every legal move by the five-cell windows it touches: finish its own line, block yours, build toward a line, and save jacks for moves that matter. It sees only the board and its own hand. "Play the computer" runs the game entirely in the tab, with no network.
  Levels differ by how often the bot plays a random move instead of its best one (Easy 50% and no deliberate blocking, Medium 20%, Hard never). Tuning the scoring weights barely changed strength, because card luck dominates. Measured over 2000 games per pair: Hard beats Medium 61%, Medium beats Easy 66%, Hard beats Easy 74%.
- `game.test.mjs`: rules self-check, run `node game.test.mjs`
- `cards/`: the 52 card faces and `BACK.svg`, exported from the "Bộ bài 52 lá" Claude Design project. Hand cards show these files directly. Board cells reuse their suit glyphs and colors at mini size.

## On phones

Chain Five is an installable web app (PWA). Nothing goes through an app store.

- iPhone (Safari): Share, then "Add to Home Screen".
- Android (Chrome): menu, then "Install app" (or the install prompt).

Once installed it opens full screen with its own icon. `sw.js` keeps every file, all 53 cards included, so playing the computer works with no connection. Playing a friend still needs the network.

The service worker is network first: online, every load revalidates with the server, so a new deploy shows up on the next load and old and new files never mix. Bump `CACHE` in `sw.js` only when you want to clear what phones have stored.

Phone layout: the hand is a fanned row of larger cards with each top-left index showing, and a landscape phone gets the board and hand side by side. While a game is on, the screen is kept awake (a sleeping phone drops the live connection), and Android phones buzz when your turn comes round.

## Run locally

ES modules need a server, so `file://` will not work. From the repo root:

```sh
python3 -m http.server 8765
# open http://localhost:8765/ in two tabs
```

## Deploy to GitHub Pages

1. Settings, Pages, Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The game goes live at https://pius-game-enter.github.io/sequence-board-game/

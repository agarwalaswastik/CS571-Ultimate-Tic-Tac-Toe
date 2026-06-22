# Ultimate Tic-Tac-Toe: Minimax vs. Monte Carlo Tree Search

Two game-playing AIs for [Ultimate Tic-Tac-Toe](https://en.wikipedia.org/wiki/Ultimate_tic-tac-toe),
built with different search paradigms, plus a harness that pits them head-to-head:

- **Minimax** with alpha-beta pruning and a hand-tuned positional heuristic, written in **C++**.
- **Monte Carlo Tree Search (MCTS)** with UCB1 selection and random rollouts, written in **JavaScript**.

The two engines run in separate processes and communicate over a small text
protocol, so a single match exercises a depth-limited adversarial search, a
statistical sampling search, and a cross-language process bridge at once.

> **Attribution:** The JavaScript MCTS engine and board logic (`js/mcts.js`,
> `js/board.js`) are adapted from the Ultimate Tic-Tac-Toe implementation at
> [theofekfoundation.org](https://www.theofekfoundation.org/games/UltimateTicTacToe/).
> My work on that side was refactoring and documenting the existing code, not
> implementing the MCTS algorithm from scratch. See
> [Credits and license](#credits-and-license).

## The game

Ultimate Tic-Tac-Toe is tic-tac-toe nested inside tic-tac-toe. The board is a 3x3
grid of nine small boards. Winning a small board claims that cell on the big
board, and winning three small boards in a line wins the game. The twist: **the
cell you play in dictates which small board your opponent must play in next.** If
that board is already decided, the opponent may play anywhere. This coupling
makes the branching factor and look-ahead far richer than ordinary tic-tac-toe.

## Approaches

### Minimax (C++)

A classic depth-limited minimax search with alpha-beta pruning (`src/main.cpp`).
Because the full game tree is far too large to solve exactly, the search stops at
a fixed depth (8 plies by default) and scores leaf positions with a heuristic
(`UTTBoard::getHeuristicScore` in `src/board.cpp`) that rewards:

- won small boards, weighted by their position on the big board (center > corner > edge);
- two-in-a-line threats on both the small boards and the big board;
- control of the strategically valuable center board and center cells.

The board uses a compact flat representation and an incremental win check (only
the line through the last move is re-evaluated), keeping each node cheap so the
search can reach a useful depth.

### Monte Carlo Tree Search (JavaScript)

The MCTS engine and board logic (`js/mcts.js`, `js/board.js`) are adapted from the
[theofekfoundation.org Ultimate Tic-Tac-Toe](https://www.theofekfoundation.org/games/UltimateTicTacToe/)
implementation; I refactored and documented them and wrote the match harness
(`game-controller.js`, `minimax-player.js`, `battle.js`, `tournament.js`) that
bridges to the C++ engine.

MCTS (`js/mcts.js`) builds a search tree by repeating four phases thousands of
times per move (10,000 rollouts by default):

1. **Selection** — descend the tree using the UCB1 formula, balancing
   exploitation of strong moves against exploration of uncertain ones.
2. **Expansion** — add the legal children of the first unexpanded node reached.
3. **Simulation** — play a uniformly random game from there to the end.
4. **Backpropagation** — propagate the win/loss/draw result back up the path,
   flipping perspective at each level.

The final move is the most-visited root child — the standard robust choice. MCTS
needs no domain heuristic; it learns each position's value purely from sampled
playouts.

## Project structure

```
src/
  board.cpp           UTTBoard: rules, board representation, and the minimax heuristic
  main.cpp            minimax + alpha-beta search and the stdin/stdout protocol
js/
  board.js            board representation, rules, and coordinate conversion
  mcts.js             Monte Carlo Tree Search engine
  minimax-player.js   wrapper that drives the C++ engine as a child process
  game-controller.js  runs one Minimax-vs-MCTS game
  battle.js           entry point: one narrated game (prints the board each move)
  tournament.js       entry point: many games + aggregate win rates
Makefile              builds the C++ engine into ./run.out
```

The C++ engine speaks a two-digit move protocol (`<board><cell>`) over
stdin/stdout. `js/minimax-player.js` documents the full protocol and the JS side
keeps an independent copy of the board to detect game-over and stay in sync.

## Build and run

Requires a C++17 compiler (`g++`/`clang++`), `make`, and Node.js 16+.

```bash
make                          # builds the C++ engine -> ./run.out

npm run battle                # watch a single game move by move
npm run tournament -- 50      # run 50 games and report win rates

# equivalently, without npm:
node js/battle.js
node js/tournament.js ./run.out 50
```

## Results

In head-to-head play (Minimax depth 8 as X, MCTS at 10,000 rollouts as O), the
heuristic-guided minimax search comes out ahead over a 20-game sample:

| Engine          | Wins | Win rate |
| --------------- | ---- | -------- |
| Minimax (C++)   | 9    | 45%      |
| MCTS (JS)       | 3    | 15%      |
| Draws           | 8    | 40%      |

Minimax's domain-specific heuristic gives it an edge at this rollout budget; MCTS
would be expected to close the gap with substantially more simulations per move
or with rollout policies smarter than uniform-random.

## Possible improvements

- Pack the board into bitboards for faster move generation and copying.
- Add a transposition table and iterative deepening to the minimax search.
- Give MCTS heavier (heuristic-guided) rollouts and a per-move time budget.

## Credits and license

- **C++ minimax engine** (`src/`) and the **match harness** (`js/game-controller.js`,
  `js/minimax-player.js`, `js/battle.js`, `js/tournament.js`) — written by me, and
  released under the MIT License.
- **JavaScript MCTS engine and board logic** (`js/mcts.js`, `js/board.js`) — adapted
  from the Ultimate Tic-Tac-Toe implementation at
  [theofekfoundation.org](https://www.theofekfoundation.org/games/UltimateTicTacToe/).
  I refactored and documented this code but did not author the original MCTS
  implementation. The original does not carry an explicit license, so it is not
  covered by the MIT grant above; all rights to it remain with the original author.

If you intend to reuse the JavaScript engine, please respect the original author's
rights and consider contacting them for permission.

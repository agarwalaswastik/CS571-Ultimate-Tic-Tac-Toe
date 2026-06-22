// mcts.js
//
// Monte Carlo Tree Search player for Ultimate Tic-Tac-Toe.
//
// Each search builds a tree of MCTSNodes. A node stores win/loss counts from the
// perspective of the player to move *at* that node, and the four classic MCTS
// phases are interleaved per iteration:
//
//   1. Selection   - descend the tree by UCB1 until an unexpanded node is found.
//   2. Expansion   - generate that node's legal children on first visit.
//   3. Simulation  - play a uniformly random game to the end (a "rollout").
//   4. Backprop    - propagate the rollout result up the path, flipping sign at
//                    each level so every node scores from its own mover's view.
//
// `getMCTSMove` runs a fixed number of iterations and returns the most-visited
// root child, which is the standard robust choice for the final move.

const {
    CELL,
    isSubBoardClosed,
    copyBoard,
    playMove,
    gameOver,
    isDraw,
} = require('./board');

// UCB1 exploration weight. Higher favors exploring less-visited moves; tuned by
// playtesting for ~10k rollouts per move.
const EXPLORATION = 1.03125;

class MCTSNode {
    // `turn` is true when X is to move at this node, false for O.
    // `lastMove` is the move that produced this node's position.
    constructor(parent, turn, lastMove) {
        this.parent = parent;
        this.turn = turn;
        this.lastMove = lastMove;
        this.hits = 0;       // rollouts won by this node's mover
        this.misses = 0;     // rollouts lost by this node's mover
        this.totalTries = 0;
        this.children = undefined; // lazily expanded
        this.result = undefined;   // cached terminal value, if this node is an end state
    }

    // One MCTS iteration starting from this node, with `board` as scratch state
    // already advanced to this node's position.
    chooseChild(board) {
        if (this.children === undefined) this.children = expand(this, board);

        if (this.children.length === 0) {
            // Terminal node: just resimulate (returns the cached result).
            this.runSimulation(board);
            return;
        }

        // Prefer an unvisited child (expansion phase), chosen at random for variety.
        const unexplored = this.children.filter((c) => c.totalTries === 0);
        if (unexplored.length > 0) {
            const child = unexplored[Math.floor(Math.random() * unexplored.length)];
            playMove(board, child.lastMove, !child.turn);
            child.runSimulation(board);
            return;
        }

        // All children visited: descend into the most promising one (UCB1).
        let best = this.children[0];
        let bestScore = ucb1(this.children[0], this.totalTries);
        for (let i = 1; i < this.children.length; i++) {
            const score = ucb1(this.children[i], this.totalTries);
            if (score > bestScore) {
                bestScore = score;
                best = this.children[i];
            }
        }
        playMove(board, best.lastMove, !best.turn);
        best.chooseChild(board);
    }

    runSimulation(board) {
        this.backPropagate(simulate(this, board));
    }

    // Record a rollout result (+1 win / -1 loss / 0 draw, from this node's
    // mover's perspective) and pass it up the tree with the sign flipped.
    backPropagate(result) {
        if (result > 0) this.hits++;
        else if (result < 0) this.misses++;
        this.totalTries++;
        if (this.parent) this.parent.backPropagate(-result);
    }
}

// Generate the legal children of `node`. The active sub-board is determined by
// the previous move's cell index; if that sub-board is closed (or this is the
// opening move), the player may move in any open sub-board.
function expand(node, board) {
    if (node.result !== undefined) return [];

    const children = [];
    const childTurn = !node.turn;

    // Opening move: anywhere on the board.
    if (!node.lastMove) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                children.push(new MCTSNode(node, childTurn, [r, c]));
            }
        }
        return children;
    }

    // The sub-board the opponent's last move sends us to.
    const targetCenterRow = node.lastMove[0] % 3 * 3 + 1;
    const targetCenterCol = node.lastMove[1] % 3 * 3 + 1;
    if (!isSubBoardClosed(board[targetCenterRow][targetCenterCol])) {
        for (let r = targetCenterRow - 1; r <= targetCenterRow + 1; r++) {
            for (let c = targetCenterCol - 1; c <= targetCenterCol + 1; c++) {
                if (board[r][c] === CELL.EMPTY) {
                    children.push(new MCTSNode(node, childTurn, [r, c]));
                }
            }
        }
        return children;
    }

    // Target sub-board is closed: free move into any open sub-board.
    for (let cr = 1; cr < 9; cr += 3) {
        for (let cc = 1; cc < 9; cc += 3) {
            if (isSubBoardClosed(board[cr][cc])) continue;
            for (let r = cr - 1; r <= cr + 1; r++) {
                for (let c = cc - 1; c <= cc + 1; c++) {
                    if (board[r][c] === CELL.EMPTY) {
                        children.push(new MCTSNode(node, childTurn, [r, c]));
                    }
                }
            }
        }
    }
    return children;
}

// Play a uniformly random game from `node`'s position to a terminal state.
// Returns +1 if `node`'s mover ends up winning, -1 if losing, 0 for a draw.
function simulate(node, board) {
    if (node.result !== undefined) return node.result;

    // Did the move leading into this node already end the game?
    if (gameOver(board, node.turn ? CELL.WON_O : CELL.WON_X, node.lastMove)) {
        return (node.result = -1);
    }
    if (isDraw(board)) return (node.result = 0);

    let lastMove = node.lastMove;
    let turn = node.turn;
    while (true) {
        const targetCenterRow = lastMove[0] % 3 * 3 + 1;
        const targetCenterCol = lastMove[1] % 3 * 3 + 1;
        let row, col;

        if (!isSubBoardClosed(board[targetCenterRow][targetCenterCol])) {
            // Constrained to the target sub-board.
            do {
                row = targetCenterRow - 1 + Math.floor(Math.random() * 3);
                col = targetCenterCol - 1 + Math.floor(Math.random() * 3);
            } while (board[row][col] !== CELL.EMPTY);
        } else {
            // Free move: pick any empty cell in an open sub-board.
            do {
                row = Math.floor(Math.random() * 9);
                col = Math.floor(Math.random() * 9);
            } while (!isSubBoardOpen(board, row, col) || board[row][col] !== CELL.EMPTY);
        }

        playMove(board, [row, col], turn);
        if (gameOver(board, turn ? CELL.WON_X : CELL.WON_O, [row, col])) {
            return node.turn !== turn ? -1 : 1;
        }
        if (isDraw(board)) return 0;

        lastMove = [row, col];
        turn = !turn;
    }
}

// Local helper: is the sub-board containing (row, col) still open?
function isSubBoardOpen(board, row, col) {
    const centerRow = row - row % 3 + 1;
    const centerCol = col - col % 3 + 1;
    return !isSubBoardClosed(board[centerRow][centerCol]);
}

// UCB1 score for a child, balancing its loss rate against exploration. The child
// stores stats from its own mover's view, so from the parent's perspective the
// exploitation term is (misses - hits) / tries.
function ucb1(child, parentTries) {
    const exploitation = (child.misses - child.hits) / child.totalTries;
    const exploration = EXPLORATION * Math.sqrt(Math.log(parentTries) / child.totalTries);
    return exploitation + exploration;
}

// Run MCTS from the given position and return the chosen move as [row, col].
// `turnIsX` is true when it is X's turn to move (defaults to O, the role MCTS
// plays in the battle harness). `lastMove` is the opponent's previous move, or
// null for the opening move.
function getMCTSMove(board, lastMove, simulations = 10000, turnIsX = false) {
    const root = new MCTSNode(false, turnIsX, lastMove);

    for (let i = 0; i < simulations; i++) {
        root.chooseChild(copyBoard(board));
    }

    if (!root.children || root.children.length === 0) {
        throw new Error('No legal moves available');
    }

    let best = root.children[0];
    for (let i = 1; i < root.children.length; i++) {
        if (root.children[i].totalTries > best.totalTries) {
            best = root.children[i];
        }
    }
    return best.lastMove;
}

module.exports = { MCTSNode, getMCTSMove };

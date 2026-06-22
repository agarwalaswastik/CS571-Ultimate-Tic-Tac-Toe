// game-controller.js
//
// Drives a single game of Minimax (X, the C++ engine) vs MCTS (O, the JS engine).
// X always moves first; the two engines alternate. The controller keeps its own
// copy of the board so it can detect terminal states and (in verbose mode) print
// the position, while forwarding each MCTS move to the C++ engine to keep both
// sides in sync.

const {
    CELL,
    createBoard,
    playMove,
    gameOver,
    isDraw,
    absToCoord,
    coordToAbs,
} = require('./board');
const { getMCTSMove } = require('./mcts');
const { MinimaxPlayer } = require('./minimax-player');

const MCTS_SIMULATIONS = 10000;

class GameController {
    constructor(cppPath, { verbose = false } = {}) {
        this.board = createBoard();
        this.lastMove = null;     // [row, col] of the most recent move
        this.moveNum = 0;
        this.verbose = verbose;
        this.result = null;       // 'minimax' | 'mcts' | 'draw'
        this.minimax = new MinimaxPlayer(cppPath, { verbose });
    }

    applyMove(absPos, label) {
        const [row, col] = absToCoord(absPos);
        const xturn = this.moveNum % 2 === 0; // even plies are X (Minimax)
        playMove(this.board, [row, col], xturn);
        this.lastMove = [row, col];
        this.moveNum++;
        if (this.verbose) {
            console.log(`Move ${this.moveNum}: ${label} -> ${absPos} ` +
                `(board ${Math.floor(absPos / 9)}, cell ${absPos % 9})`);
        }
    }

    isGameOver() {
        if (this.moveNum < 5) return false; // fastest possible win needs 5 plies

        // The player who just moved is the only one who could have won.
        const justMovedX = this.moveNum % 2 === 1;
        const wonColor = justMovedX ? CELL.WON_X : CELL.WON_O;

        if (gameOver(this.board, wonColor, this.lastMove)) {
            this.result = justMovedX ? 'minimax' : 'mcts';
            return true;
        }
        if (isDraw(this.board)) {
            this.result = 'draw';
            return true;
        }
        return false;
    }

    async play() {
        // Give the C++ process a moment to start up.
        await new Promise((resolve) => setTimeout(resolve, 100));

        while (!this.isGameOver()) {
            if (this.verbose) this.printBoard();

            if (this.moveNum % 2 === 0) {
                // Minimax (X): the C++ engine plays and reports its move.
                const move = await this.minimax.getMove();
                this.applyMove(move, 'Minimax (X)');
            } else {
                // MCTS (O): compute the move here, then forward it to C++.
                const [row, col] = getMCTSMove(this.board, this.lastMove, MCTS_SIMULATIONS);
                const move = coordToAbs(row, col);
                this.applyMove(move, 'MCTS (O)');
                this.minimax.sendMove(move);
            }
        }

        if (this.verbose) {
            this.printBoard();
            console.log(`\nResult: ${this.result} (${this.moveNum} moves)`);
        }

        this.minimax.close();
        return this.result;
    }

    // Render the 9x9 board: X / O for cells, # for a decided sub-board center.
    printBoard() {
        console.log('\n' + '='.repeat(25));
        for (let row = 0; row < 9; row++) {
            let line = '';
            for (let col = 0; col < 9; col++) {
                const v = this.board[row][col];
                if (v === CELL.X) line += 'X ';
                else if (v === CELL.O) line += 'O ';
                else if (v >= CELL.FULL_X) line += '# '; // decided sub-board center
                else line += '. ';
                if (col % 3 === 2 && col < 8) line += '| ';
            }
            console.log(line);
            if (row % 3 === 2 && row < 8) console.log('-'.repeat(25));
        }
        console.log('='.repeat(25));
    }
}

module.exports = { GameController };

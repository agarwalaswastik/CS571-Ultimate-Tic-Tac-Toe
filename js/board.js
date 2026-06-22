// board.js
//
// Board representation and rules for Ultimate Tic-Tac-Toe.
//
// The board is a 9x9 grid (`board[row][col]`) that holds both the 81 individual
// cells and the status of the nine 3x3 sub-boards. Sub-board status is stored in
// the *center cell* of each sub-board (rows/cols 1, 4, 7), which is overloaded to
// encode more than just "X or O":
//
//   0  empty cell
//   1  X cell
//   2  O cell
//   3  sub-board full / drawn (center had been X)
//   4  sub-board full / drawn (center had been O)
//   5  sub-board won by X
//   6  sub-board won by O
//
// Encoding the sub-board result in its own center cell lets the win/legality
// checks read everything from a single flat array, which keeps the MCTS rollouts
// (the hot path) fast and allocation-free.

const CELL = {
    EMPTY: 0,
    X: 1,
    O: 2,
    FULL_X: 3, // sub-board drawn, center was X
    FULL_O: 4, // sub-board drawn, center was O
    WON_X: 5,  // sub-board won by X
    WON_O: 6,  // sub-board won by O
};

// True once a sub-board is decided (won or drawn) and can no longer be played in.
function isSubBoardClosed(value) {
    return value === CELL.FULL_X || value === CELL.FULL_O ||
           value === CELL.WON_X || value === CELL.WON_O;
}

// Allocate an empty 9x9 board.
function createBoard() {
    return Array.from({ length: 9 }, () => new Array(9).fill(CELL.EMPTY));
}

// Deep copy a board (used to give each MCTS rollout its own scratch state).
function copyBoard(board) {
    const copy = new Array(9);
    for (let i = 0; i < 9; i++) copy[i] = board[i].slice();
    return copy;
}

// Apply a move for the given player and update the affected sub-board's status.
// `xturn` is true for X, false for O.
function playMove(board, move, xturn) {
    const color = xturn ? CELL.X : CELL.O;
    const [row, col] = move;
    const centerRow = row - row % 3 + 1;
    const centerCol = col - col % 3 + 1;
    const startRow = row - row % 3;
    const startCol = col - col % 3;

    board[row][col] = color;

    if (wonSubBoard(board, color, move, startRow, startCol)) {
        board[centerRow][centerCol] = color + 4; // 5 = WON_X, 6 = WON_O
    } else if (isSubBoardFull(board, startRow, startCol)) {
        board[centerRow][centerCol] += 2;        // 3 = FULL_X, 4 = FULL_O
    }
}

// Did `color` just complete a line within the 3x3 sub-board at (startRow, startCol)?
// Only the row/col/diagonals through the placed `move` can be newly completed.
function wonSubBoard(board, color, move, startRow, startCol) {
    const [row, col] = move;

    // Column through the move.
    let won = true;
    for (let r = startRow; r < startRow + 3; r++) {
        if (board[r][col] !== color) { won = false; break; }
    }
    if (won) return true;

    // Row through the move.
    won = true;
    for (let c = startCol; c < startCol + 3; c++) {
        if (board[row][c] !== color) { won = false; break; }
    }
    if (won) return true;

    // Main diagonal (only if the move sits on it).
    if (row % 3 === col % 3) {
        won = true;
        for (let r = startRow, c = startCol; r < startRow + 3; r++, c++) {
            if (board[r][c] !== color) { won = false; break; }
        }
        if (won) return true;
    }

    // Anti-diagonal (only if the move sits on it).
    if (row % 3 === 2 - col % 3) {
        won = true;
        for (let r = startRow, c = startCol + 2; r < startRow + 3; r++, c--) {
            if (board[r][c] !== color) { won = false; break; }
        }
        if (won) return true;
    }

    return false;
}

// Are all nine cells of the sub-board at (startRow, startCol) filled?
function isSubBoardFull(board, startRow, startCol) {
    for (let r = startRow; r < startRow + 3; r++) {
        for (let c = startCol; c < startCol + 3; c++) {
            if (board[r][c] === CELL.EMPTY) return false;
        }
    }
    return true;
}

// Has `color` won the overall game? `color` is WON_X (5) or WON_O (6); the
// meta-board is read from the sub-board centers. `lastMove` is any cell in the
// most recently completed sub-board, used to limit the lines we check.
function gameOver(board, color, lastMove) {
    const centerRow = lastMove[0] - lastMove[0] % 3 + 1;
    const centerCol = lastMove[1] - lastMove[1] % 3 + 1;

    // Column of sub-boards.
    let won = true;
    for (let r = 1; r < 9; r += 3) {
        if (board[r][centerCol] !== color) { won = false; break; }
    }
    if (won) return true;

    // Row of sub-boards.
    won = true;
    for (let c = 1; c < 9; c += 3) {
        if (board[centerRow][c] !== color) { won = false; break; }
    }
    if (won) return true;

    // Main diagonal of sub-boards.
    if (Math.floor(centerRow / 3) === Math.floor(centerCol / 3)) {
        won = true;
        for (let r = 1, c = 1; r < 9; r += 3, c += 3) {
            if (board[r][c] !== color) { won = false; break; }
        }
        if (won) return true;
    }

    // Anti-diagonal of sub-boards.
    if (Math.floor(centerRow / 3) === 2 - Math.floor(centerCol / 3)) {
        won = true;
        for (let r = 1, c = 7; r < 9; r += 3, c -= 3) {
            if (board[r][c] !== color) { won = false; break; }
        }
        if (won) return true;
    }

    return false;
}

// True when every sub-board is decided (used to detect a drawn game).
function isDraw(board) {
    for (let r = 1; r < 9; r += 3) {
        for (let c = 1; c < 9; c += 3) {
            if (!isSubBoardClosed(board[r][c])) return false;
        }
    }
    return true;
}

// Can a move legally be sent to the sub-board containing (row, col)? A sub-board
// is only a legal target while it is still open.
function isSubBoardOpen(board, move) {
    const centerRow = move[0] - move[0] % 3 + 1;
    const centerCol = move[1] - move[1] % 3 + 1;
    return !isSubBoardClosed(board[centerRow][centerCol]);
}

// --- Coordinate conversion -------------------------------------------------
//
// The C++ engine addresses cells by absolute index 0..80 (`subBoard * 9 + cell`,
// each in row-major order). The JS engine uses [row, col] on the 9x9 grid. These
// two helpers translate between the two conventions.

function absToCoord(absPos) {
    const subBoard = Math.floor(absPos / 9);
    const cell = absPos % 9;
    const subRow = Math.floor(subBoard / 3);
    const subCol = subBoard % 3;
    const cellRow = Math.floor(cell / 3);
    const cellCol = cell % 3;
    return [subRow * 3 + cellRow, subCol * 3 + cellCol];
}

function coordToAbs(row, col) {
    const subRow = Math.floor(row / 3);
    const subCol = Math.floor(col / 3);
    const cellRow = row % 3;
    const cellCol = col % 3;
    const subBoard = subRow * 3 + subCol;
    const cell = cellRow * 3 + cellCol;
    return subBoard * 9 + cell;
}

module.exports = {
    CELL,
    isSubBoardClosed,
    isSubBoardOpen,
    createBoard,
    copyBoard,
    playMove,
    gameOver,
    isDraw,
    absToCoord,
    coordToAbs,
};

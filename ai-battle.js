// ai-battle.js
const { spawn } = require('child_process');

// ============================================
// MCTS AI Implementation (from JavaScript code)
// ============================================

class MCTSNode {
    constructor(parent, turn, lastMove) {
        this.parent = parent;
        this.turn = turn;
        this.lastMove = lastMove;
        this.hits = 0;
        this.misses = 0;
        this.totalTries = 0;
        this.children = undefined;
        this.result = undefined;
    }

    chooseChild(board) {
        if (this.children === undefined)
            this.children = MCTSGetChildren(this, board);
        if (this.children.length === 0) {
            this.runSimulation(board);
        } else {
            let countUnexplored = 0;
            for (let i = 0; i < this.children.length; i++)
                if (this.children[i].totalTries === 0)
                    countUnexplored++;

            if (countUnexplored > 0) {
                const ran = Math.floor(Math.random() * countUnexplored);
                let index = 0;
                for (let i = 0; i < this.children.length; i++) {
                    if (this.children[i].totalTries === 0) {
                        if (index === ran) {
                            playMove(board, this.children[i].lastMove, !this.children[i].turn);
                            this.children[i].runSimulation(board);
                            return;
                        }
                        index++;
                    }
                }
            } else {
                let bestChild = this.children[0];
                let bestPotential = MCTSChildPotential(this.children[0], this.totalTries);
                for (let i = 1; i < this.children.length; i++) {
                    const potential = MCTSChildPotential(this.children[i], this.totalTries);
                    if (potential > bestPotential) {
                        bestPotential = potential;
                        bestChild = this.children[i];
                    }
                }
                playMove(board, bestChild.lastMove, !bestChild.turn);
                bestChild.chooseChild(board);
            }
        }
    }

    runSimulation(board) {
        this.backPropogate(MCTSSimulate(this, board));
    }

    backPropogate(simulation) {
        if (simulation > 0)
            this.hits++;
        else if (simulation < 0)
            this.misses++;
        this.totalTries++;
        if (this.parent)
            this.parent.backPropogate(-simulation);
    }
}

function MCTSGetChildren(father, tboard) {
    const turn = father.turn;
    const children = [];

    if (father.result !== undefined)
        return [];

    if (father.lastMove) {
        const nextCenter = [father.lastMove[0] % 3 * 3 + 1, father.lastMove[1] % 3 * 3 + 1];
        const nextCenterColor = tboard[nextCenter[0]][nextCenter[1]];
        if (nextCenterColor !== 5 && nextCenterColor !== 6 && nextCenterColor !== 3 && nextCenterColor !== 4) {
            for (let i = nextCenter[0] - 1; i <= nextCenter[0] + 1; i++)
                for (let a = nextCenter[1] - 1; a <= nextCenter[1] + 1; a++)
                    if (tboard[i][a] === 0)
                        children.push(new MCTSNode(father, !turn, [i, a]));
            return children;
        }
    } else {
        for (let i = 0; i < 9; i++)
            for (let a = 0; a < 9; a++)
                children.push(new MCTSNode(father, !turn, [i, a]));
        return children;
    }

    for (let I = 1; I < 9; I += 3)
        for (let A = 1; A < 9; A += 3)
            if (tboard[I][A] !== 5 && tboard[I][A] !== 6 && tboard[I][A] !== 3 && tboard[I][A] !== 4)
                for (let i = I - 1; i <= I + 1; i++)
                    for (let a = A - 1; a <= A + 1; a++)
                        if (tboard[i][a] === 0)
                            children.push(new MCTSNode(father, !turn, [i, a]));
    return children;
}

function MCTSSimulate(father, tboard) {
    if (father.result !== undefined)
        return father.result;

    if (gameOver(tboard, father.turn ? 6 : 5, father.lastMove))
        return father.result = -1;

    if (tieGame(tboard))
        return father.result = 0;

    let lm = father.lastMove, turn = father.turn;
    while (true) {
        const nextCenter = [lm[0] % 3 * 3 + 1, lm[1] % 3 * 3 + 1];
        let nextCenterColor = tboard[nextCenter[0]][nextCenter[1]];
        let x, y;

        if (nextCenterColor !== 5 && nextCenterColor !== 6 && nextCenterColor !== 3 && nextCenterColor !== 4) {
            do {
                x = nextCenter[0] - 1 + Math.floor(Math.random() * 3);
                y = nextCenter[1] - 1 + Math.floor(Math.random() * 3);
            } while (tboard[x][y] !== 0);
        } else {
            do {
                x = Math.floor(Math.random() * 9);
                y = Math.floor(Math.random() * 9);
            } while (!legalCenter(tboard, [x, y]) || tboard[x][y] !== 0);
        }

        playMove(tboard, [x, y], turn);
        if (gameOver(tboard, turn ? 5 : 6, [x, y])) {
            return father.turn !== turn ? -1 : 1;
        }
        if (tieGame(tboard))
            return 0;
        lm = [x, y];
        turn = !turn;
    }
}

function MCTSChildPotential(child, t) {
    const w = child.misses - child.hits;
    const n = child.totalTries;
    return w / n + 1.03125 * Math.sqrt(Math.log(t) / n);
}

function playMove(tboard, move, xturn) {
    const color = xturn ? 1 : 2;
    const centerx = move[0] - move[0] % 3 + 1;
    const centery = move[1] - move[1] % 3 + 1;
    const startx = move[0] - move[0] % 3;
    const starty = move[1] - move[1] % 3;
    tboard[move[0]][move[1]] = color;
    if (localWin(tboard, color, move, startx, starty))
        tboard[centerx][centery] = color + 4;
    else if (squareFull(tboard, startx, starty))
        tboard[centerx][centery] += 2;
}

function localWin(tboard, color, move, startx, starty) {
    for (let trial = 0; trial < 4; trial++) {
        let won = true;
        switch (trial) {
            case 0:
                for (let i = startx; i < startx + 3; i++)
                    if (tboard[i][move[1]] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 1:
                for (let a = starty; a < starty + 3; a++)
                    if (tboard[move[0]][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 2:
                if (move[0] % 3 !== move[1] % 3) break;
                for (let i = startx, a = starty; i < startx + 3; i++, a++)
                    if (tboard[i][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 3:
                if (move[0] % 3 !== 2 - move[1] % 3) break;
                for (let i = startx, a = starty + 2; i < startx + 3; i++, a--)
                    if (tboard[i][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
        }
    }
    return false;
}

function squareFull(tboard, startx, starty) {
    for (let i = startx; i < startx + 3; i++)
        for (let a = starty; a < starty + 3; a++)
            if (tboard[i][a] === 0)
                return false;
    return true;
}

function gameOver(tboard, color, m) {
    const move = [m[0] - m[0] % 3 + 1, m[1] - m[1] % 3 + 1];

    for (let trial = 0; trial < 4; trial++) {
        let won = true;
        switch (trial) {
            case 0:
                for (let i = 1; i < 9; i += 3)
                    if (tboard[i][move[1]] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 1:
                for (let a = 1; a < 9; a += 3)
                    if (tboard[move[0]][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 2:
                if (Math.floor(move[0] / 3) !== Math.floor(move[1] / 3)) break;
                for (let i = 1, a = 1; i < 9; i += 3, a += 3)
                    if (tboard[i][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
            case 3:
                if (Math.floor(move[0] / 3) !== 2 - Math.floor(move[1] / 3)) break;
                for (let i = 1, a = 7; i < 9; i += 3, a -= 3)
                    if (tboard[i][a] !== color) {
                        won = false;
                        break;
                    }
                if (won) return true;
                break;
        }
    }
    return false;
}

function tieGame(tboard) {
    for (let i = 1; i < 9; i += 3)
        for (let a = 1; a < 9; a += 3)
            if (tboard[i][a] !== 3 && tboard[i][a] !== 4 && tboard[i][a] !== 6 && tboard[i][a] !== 5)
                return false;
    return true;
}

function legalCenter(tboard, move) {
    const c = tboard[move[0] - move[0] % 3 + 1][move[1] - move[1] % 3 + 1];
    return !(c === 5 || c === 6 || c === 4 || c === 3);
}

function simpleCopy(board) {
    const copy = new Array(9);
    for (let i = 0; i < 9; i++) {
        copy[i] = new Array(9);
        for (let a = 0; a < 9; a++)
            copy[i][a] = board[i][a];
    }
    return copy;
}

// ============================================
// Position Conversion Functions
// ============================================

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

// ============================================
// MCTS Move Selection
// ============================================

function getMCTSMove(board, lastMove, simulations = 10000) {
    const startTime = Date.now();
    
    const root = new MCTSNode(false, false, lastMove); // false = O's turn
    
    for (let i = 0; i < simulations; i++) {
        root.chooseChild(simpleCopy(board));
    }
    
    if (!root.children || root.children.length === 0) {
        throw new Error("No legal moves available");
    }
    
    let bestChild = root.children[0];
    for (let i = 1; i < root.children.length; i++) {
        if (root.children[i].totalTries > bestChild.totalTries) {
            bestChild = root.children[i];
        }
    }
    
    const endTime = Date.now();
    const winRate = bestChild.totalTries > 0 ? 
        (bestChild.hits / bestChild.totalTries * 100).toFixed(1) : 0;
    
    console.log(`[MCTS] Simulations: ${simulations}, Time: ${endTime - startTime}ms, Win rate: ${winRate}%`);
    
    return bestChild.lastMove;
}

// ============================================
// C++ Interface
// ============================================

class CppMinimaxPlayer {
    constructor(executablePath) {
        this.process = spawn(executablePath);
        this.ready = false;
        
        this.process.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) console.log(`[C++ stderr] ${msg}`);
        });
        
        this.process.on('close', (code) => {
            console.log(`C++ process exited with code ${code}`);
        });
    }
    
    async sendMove(absPos) {
        const boardIdx = Math.floor(absPos / 9);
        const cellIdx = absPos % 9;
        const moveStr = `${boardIdx}${cellIdx}\n`;
        
        this.process.stdin.write(moveStr);
    }
    
    async getMove() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('C++ AI timeout'));
            }, 30000);
            
            const onData = (data) => {
                const output = data.toString();
                const moveMatch = output.match(/AI CHOSE THE MOVE (\d)(\d)/);
                const gameOverMatch = output.match(/GAME_OVER/);
                
                if (gameOverMatch) {
                    clearTimeout(timeout);
                    this.process.stdout.removeListener('data', onData);
                    reject(new Error('C++ reports game over'));
                    return;
                }
                
                if (moveMatch) {
                    clearTimeout(timeout);
                    this.process.stdout.removeListener('data', onData);
                    
                    const boardIdx = parseInt(moveMatch[1]);
                    const cellIdx = parseInt(moveMatch[2]);
                    const absPos = boardIdx * 9 + cellIdx;
                    
                    resolve(absPos);
                }
            };
            
            this.process.stdout.on('data', onData);
            this.process.stdin.write('ai\n');
        });
    }
    
    close() {
        this.process.stdin.end();
        this.process.kill();
    }
}

// ============================================
// Game Controller
// ============================================

class GameController {
    constructor(cppPath) {
        this.board = Array(9).fill(null).map(() => Array(9).fill(0));
        this.lastMove = null;
        this.moveNum = 0;
        this.cppPlayer = new CppMinimaxPlayer(cppPath);
    }
    
    makeMove(absPos, playerName) {
        const [row, col] = absToCoord(absPos);
        const player = (this.moveNum % 2 === 0) ? 1 : 2; // 1 = X (Minimax), 2 = O (MCTS)
        const xturn = player === 1;
        
        playMove(this.board, [row, col], xturn);
        this.lastMove = [row, col];
        this.moveNum++;
        
        console.log(`\nMove ${this.moveNum}: ${playerName} played position ${absPos} (Board ${Math.floor(absPos/9)}, Cell ${absPos%9})`);
    }
    
    isGameOver() {
        if (this.moveNum < 5) return false;
        
        const lastPlayer = (this.moveNum % 2 === 0) ? 2 : 1;
        const color = lastPlayer === 1 ? 5 : 6;
        
        if (gameOver(this.board, color, this.lastMove)) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🎉 ${lastPlayer === 1 ? 'MINIMAX (X)' : 'MCTS (O)'} WINS!`);
            console.log('='.repeat(50) + '\n');
            return true;
        }
        
        if (tieGame(this.board)) {
            console.log(`\n${'='.repeat(50)}`);
            console.log("🤝 GAME TIED!");
            console.log('='.repeat(50) + '\n');
            return true;
        }
        
        return false;
    }
    
    printBoard() {
        console.log('\n' + '='.repeat(50));
        for (let row = 0; row < 9; row++) {
            let line = '';
            for (let col = 0; col < 9; col++) {
                const val = this.board[row][col];
                if (val === 1) line += 'X ';
                else if (val === 2) line += 'O ';
                else if (val >= 3) line += '# ';
                else line += '. ';
                
                if (col % 3 === 2 && col < 8) line += '| ';
            }
            console.log(line);
            if (row % 3 === 2 && row < 8) {
                console.log('-'.repeat(50));
            }
        }
        console.log('='.repeat(50));
    }
    
    async playGame() {
        console.log("\n" + "=".repeat(50));
        console.log("🎮 ULTIMATE TIC-TAC-TOE: AI BATTLE");
        console.log("Minimax (X) vs MCTS (O)");
        console.log("=".repeat(50));
        
        // Wait a moment for C++ to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        while (!this.isGameOver()) {
            this.printBoard();
            
            let move;
            const startTime = Date.now();
            
            if (this.moveNum % 2 === 0) {
                // Minimax (X) turn
                console.log("\n⚡ Minimax thinking...");
                move = await this.cppPlayer.getMove();
                const endTime = Date.now();
                console.log(`[Minimax] Time: ${endTime - startTime}ms`);
                
                this.makeMove(move, "Minimax (X)");
                // C++ already knows its own move, don't send it back!
            } else {
                // MCTS (O) turn
                console.log("\n🎲 MCTS thinking...");
                const mctsMove = getMCTSMove(this.board, this.lastMove, 10000);
                move = coordToAbs(mctsMove[0], mctsMove[1]);
                
                this.makeMove(move, "MCTS (O)");
                
                // Send MCTS move to C++ so it stays in sync
                await this.cppPlayer.sendMove(move);
            }
            
            // Small delay for readability
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.printBoard();
        console.log(`\nTotal moves: ${this.moveNum}`);
        
        this.cppPlayer.close();
    }
}

// ============================================
// Main Execution
// ============================================

async function main() {
    const cppExecutable = process.argv[2] || './run.out';
    
    console.log(`Using C++ executable: ${cppExecutable}`);
    
    try {
        const game = new GameController(cppExecutable);
        await game.playGame();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
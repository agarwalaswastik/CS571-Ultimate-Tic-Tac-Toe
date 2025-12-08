// ai-battle-tournament.js
const { spawn } = require('child_process');

// ============================================
// MCTS AI Implementation
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
    const root = new MCTSNode(false, false, lastMove);
    
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
    
    return bestChild.lastMove;
}

// ============================================
// C++ Interface
// ============================================

class CppMinimaxPlayer {
    constructor(executablePath) {
        this.process = spawn(executablePath);
        this.ready = false;
        this.silentMode = true;
        
        this.process.stderr.on('data', (data) => {
            if (!this.silentMode) {
                const msg = data.toString().trim();
                if (msg) console.log(`[C++ stderr] ${msg}`);
            }
        });
        
        this.process.on('close', (code) => {
            if (!this.silentMode) {
                console.log(`C++ process exited with code ${code}`);
            }
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
    constructor(cppPath, verbose = false) {
        this.board = Array(9).fill(null).map(() => Array(9).fill(0));
        this.lastMove = null;
        this.moveNum = 0;
        this.cppPlayer = new CppMinimaxPlayer(cppPath);
        this.cppPlayer.silentMode = !verbose;
        this.verbose = verbose;
        this.gameResult = null; // 'minimax', 'mcts', or 'tie'
    }
    
    makeMove(absPos, playerName) {
        const [row, col] = absToCoord(absPos);
        const player = (this.moveNum % 2 === 0) ? 1 : 2;
        const xturn = player === 1;
        
        playMove(this.board, [row, col], xturn);
        this.lastMove = [row, col];
        this.moveNum++;
        
        if (this.verbose) {
            console.log(`Move ${this.moveNum}: ${playerName} -> pos ${absPos}`);
        }
    }
    
    isGameOver() {
        if (this.moveNum < 5) return false;
        
        const lastPlayer = (this.moveNum % 2 === 0) ? 2 : 1;
        const color = lastPlayer === 1 ? 5 : 6;
        
        if (gameOver(this.board, color, this.lastMove)) {
            this.gameResult = lastPlayer === 1 ? 'minimax' : 'mcts';
            return true;
        }
        
        if (tieGame(this.board)) {
            this.gameResult = 'tie';
            return true;
        }
        
        return false;
    }
    
    async playGame() {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        while (!this.isGameOver()) {
            let move;
            
            if (this.moveNum % 2 === 0) {
                // Minimax turn
                move = await this.cppPlayer.getMove();
                this.makeMove(move, "Minimax");
            } else {
                // MCTS turn
                const mctsMove = getMCTSMove(this.board, this.lastMove, 10000);
                move = coordToAbs(mctsMove[0], mctsMove[1]);
                this.makeMove(move, "MCTS");
                await this.cppPlayer.sendMove(move);
            }
        }
        
        this.cppPlayer.close();
        return this.gameResult;
    }
}

// ============================================
// Tournament Runner
// ============================================

class Tournament {
    constructor(cppPath, numGames = 50) {
        this.cppPath = cppPath;
        this.numGames = numGames;
        this.stats = {
            minimax: 0,
            mcts: 0,
            tie: 0
        };
    }
    
    async run() {
        console.log("\n" + "=".repeat(60));
        console.log("🏆 ULTIMATE TIC-TAC-TOE TOURNAMENT");
        console.log(`   Minimax (X) vs MCTS (O) - ${this.numGames} games`);
        console.log("=".repeat(60) + "\n");
        
        const startTime = Date.now();
        
        for (let i = 1; i <= this.numGames; i++) {
            process.stdout.write(`Game ${i}/${this.numGames}... `);
            
            const game = new GameController(this.cppPath, false);
            const result = await game.playGame();
            this.stats[result]++;
            
            // Print result
            if (result === 'minimax') {
                console.log('✓ Minimax wins');
            } else if (result === 'mcts') {
                console.log('✓ MCTS wins');
            } else {
                console.log('○ Tie');
            }
            
            // Brief pause between games
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const endTime = Date.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(1);
        
        console.log("\n\n" + "=".repeat(60));
        console.log("📊 TOURNAMENT RESULTS");
        console.log("=".repeat(60));
        console.log(`Total Games:     ${this.numGames}`);
        console.log(`Total Time:      ${totalTime}s (${(totalTime / this.numGames).toFixed(1)}s per game)\n`);
        
        console.log(`Minimax Wins:    ${this.stats.minimax} (${(this.stats.minimax / this.numGames * 100).toFixed(1)}%)`);
        console.log(`MCTS Wins:       ${this.stats.mcts} (${(this.stats.mcts / this.numGames * 100).toFixed(1)}%)`);
        console.log(`Ties:            ${this.stats.tie} (${(this.stats.tie / this.numGames * 100).toFixed(1)}%)`);
        console.log("=".repeat(60));
        
        if (this.stats.minimax > this.stats.mcts) {
            console.log("\n🥇 Minimax is the winner!");
        } else if (this.stats.mcts > this.stats.minimax) {
            console.log("\n🥇 MCTS is the winner!");
        } else {
            console.log("\n🤝 It's a tie overall!");
        }
        console.log();
    }
}

// ============================================
// Main Execution
// ============================================

async function main() {
    const cppExecutable = process.argv[2] || './run.out';
    const numGames = parseInt(process.argv[3]) || 10;
    
    console.log(`Using C++ executable: ${cppExecutable}`);
    
    try {
        const tournament = new Tournament(cppExecutable, numGames);
        await tournament.run();
    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
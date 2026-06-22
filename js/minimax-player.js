// minimax-player.js
//
// Thin Node wrapper around the C++ minimax engine. The engine runs as a child
// process that speaks a simple line protocol over stdin/stdout:
//
//   ->  "<board><cell>\n"   tell the engine the opponent just played this move
//   ->  "ai\n"              ask the engine to compute and play its own move
//   <-  "AI CHOSE THE MOVE <board><cell>"   the engine's chosen move
//   <-  "GAME_OVER ..."                      the engine considers the game over
//
// Moves are exchanged as two digits: sub-board index (0-8) then cell index (0-8).

const { spawn } = require('child_process');

const MOVE_TIMEOUT_MS = 30000;

class MinimaxPlayer {
    constructor(executablePath, { verbose = false } = {}) {
        this.verbose = verbose;
        this.process = spawn(executablePath);

        this.process.stderr.on('data', (data) => {
            if (!this.verbose) return;
            const msg = data.toString().trim();
            if (msg) console.log(`[C++ stderr] ${msg}`);
        });

        this.process.on('close', (code) => {
            if (this.verbose) console.log(`C++ process exited with code ${code}`);
        });
    }

    // Inform the engine of the opponent's move (absolute index 0..80).
    sendMove(absPos) {
        const boardIdx = Math.floor(absPos / 9);
        const cellIdx = absPos % 9;
        this.process.stdin.write(`${boardIdx}${cellIdx}\n`);
    }

    // Ask the engine for its move; resolves to an absolute index 0..80.
    getMove() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.process.stdout.removeListener('data', onData);
                reject(new Error('C++ AI timed out'));
            }, MOVE_TIMEOUT_MS);

            const onData = (data) => {
                const output = data.toString();

                if (/GAME_OVER/.test(output)) {
                    clearTimeout(timeout);
                    this.process.stdout.removeListener('data', onData);
                    reject(new Error('C++ reports game over'));
                    return;
                }

                const match = output.match(/AI CHOSE THE MOVE (\d)(\d)/);
                if (match) {
                    clearTimeout(timeout);
                    this.process.stdout.removeListener('data', onData);
                    const boardIdx = parseInt(match[1], 10);
                    const cellIdx = parseInt(match[2], 10);
                    resolve(boardIdx * 9 + cellIdx);
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

module.exports = { MinimaxPlayer };

// battle.js
//
// Play a single, fully narrated game of Minimax (X) vs MCTS (O), printing the
// board after every move. Useful for watching how the two engines play.
//
//   node js/battle.js [path-to-cpp-executable]
//
// Defaults to the ./run.out built by `make` at the repo root.

const path = require('path');
const { GameController } = require('./game-controller');

async function main() {
    const cppExecutable = process.argv[2] || path.join(__dirname, '..', 'run.out');

    console.log('='.repeat(40));
    console.log('ULTIMATE TIC-TAC-TOE: AI BATTLE');
    console.log('Minimax (X)  vs  MCTS (O)');
    console.log(`Engine: ${cppExecutable}`);
    console.log('='.repeat(40));

    try {
        const game = new GameController(cppExecutable, { verbose: true });
        await game.play();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();

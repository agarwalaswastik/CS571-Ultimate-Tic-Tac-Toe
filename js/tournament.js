// tournament.js
//
// Play many quiet games of Minimax (X) vs MCTS (O) and report aggregate
// win/loss/draw rates.
//
//   node js/tournament.js [path-to-cpp-executable] [num-games]
//
// Defaults to the ./run.out built by `make` at the repo root and 10 games.

const path = require('path');
const { GameController } = require('./game-controller');

async function runTournament(cppPath, numGames) {
    const stats = { minimax: 0, mcts: 0, draw: 0 };

    console.log('='.repeat(60));
    console.log('ULTIMATE TIC-TAC-TOE TOURNAMENT');
    console.log(`Minimax (X) vs MCTS (O) - ${numGames} games`);
    console.log('='.repeat(60) + '\n');

    const start = Date.now();
    for (let i = 1; i <= numGames; i++) {
        process.stdout.write(`Game ${i}/${numGames}... `);
        const game = new GameController(cppPath, { verbose: false });
        const result = await game.play();
        stats[result]++;
        console.log({ minimax: 'Minimax wins', mcts: 'MCTS wins', draw: 'Draw' }[result]);
    }
    const totalTime = (Date.now() - start) / 1000;

    const pct = (n) => (n / numGames * 100).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('RESULTS');
    console.log('='.repeat(60));
    console.log(`Games:        ${numGames}`);
    console.log(`Total time:   ${totalTime.toFixed(1)}s (${(totalTime / numGames).toFixed(1)}s per game)\n`);
    console.log(`Minimax wins: ${stats.minimax} (${pct(stats.minimax)}%)`);
    console.log(`MCTS wins:    ${stats.mcts} (${pct(stats.mcts)}%)`);
    console.log(`Draws:        ${stats.draw} (${pct(stats.draw)}%)`);
    console.log('='.repeat(60));
}

async function main() {
    const cppExecutable = process.argv[2] || path.join(__dirname, '..', 'run.out');
    const numGames = parseInt(process.argv[3], 10) || 10;

    try {
        await runTournament(cppExecutable, numGames);
    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();

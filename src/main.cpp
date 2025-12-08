#include "board.cpp"
#include <sstream>

// Minimax implementation
int minimax(UTTBoard &board, int depth, int alpha, int beta, bool isMaximizing, uint8_t aiPlayer){
  if (depth==0||board.gameOver()){
    return board.getHeuristicScore(aiPlayer);
  }

  vector<uint8_t> moves = board.getLegalMoves();
  if (moves.empty()) return board.getHeuristicScore(aiPlayer);

  if (isMaximizing){
    int maxEval = -9999999;

    for (uint8_t move: moves){
      UTTBoard nextBoard = board;
      nextBoard.makeMove(move);

      int eval = minimax(nextBoard, depth-1, alpha, beta, false, aiPlayer);

      if (eval>maxEval) maxEval=eval;
      alpha = max(alpha, eval);
      if (beta<=alpha) break;
    }
    return maxEval;
  } else{
    int minEval = 9999999;

    for (uint8_t move: moves){
      UTTBoard nextBoard = board;
      nextBoard.makeMove(move);

      int eval = minimax(nextBoard, depth-1, alpha, beta, true, aiPlayer);

      if (eval<minEval)minEval=eval;
      beta = min(beta, eval);
      if (beta<=alpha) break;
    }
    return minEval;
  }
}

uint8_t getBestMove(UTTBoard &board, int depth){
  uint8_t aiPlayer = board.whoseTurn();
  vector<uint8_t> moves = board.getLegalMoves();

  if (moves.empty()) {
    cerr << "ERROR: No legal moves available" << endl;
    return 81;
  }

  uint8_t bestMove = moves[0];
  int bestValue = -9999999;

  int alpha = -2000000000;
  int beta = 2000000000;

  for (uint8_t move: moves){
    UTTBoard nextBoard = board;
    nextBoard.makeMove(move);
    int moveValue = minimax(nextBoard, depth-1, alpha, beta, false, aiPlayer);
    // cerr << move << ": " << moveValue << "\n";

    if (moveValue>bestValue){
      bestValue = moveValue;
      bestMove = move;
    }
  }
  
  return bestMove;
}

// Parse move from string format "XY" where X is board, Y is cell
uint8_t parseMove(const string& input) {
  if (input.length() != 2) return 81;
  
  if (input[0] < '0' || input[0] > '8') return 81;
  if (input[1] < '0' || input[1] > '8') return 81;
  
  uint8_t boardIdx = input[0] - '0';
  uint8_t cellIdx = input[1] - '0';
  
  return boardIdx * 9 + cellIdx;
}

int main(int argc, char *argv[]) {
  UTTBoard board = UTTBoard();
  
  cerr << "C++ Minimax AI Ready" << endl;
  cerr << "Waiting for moves on stdin (format: 'XY' where X=board, Y=cell, or 'ai' for AI move)" << endl;
  
  string line;
  while (getline(cin, line)) {
    // Trim whitespace
    line.erase(0, line.find_first_not_of(" \t\n\r"));
    line.erase(line.find_last_not_of(" \t\n\r") + 1);
    
    if (line.empty()) continue;
    
    if (line == "ai" || line == "AI") {
      // AI makes a move
      if (board.gameOver()) {
        cerr << "Game is over, no moves available" << endl;
        cout << "GAME_OVER" << endl;
        cout << flush;
        break;
      }
      
      vector<uint8_t> legalMoves = board.getLegalMoves();
      if (legalMoves.empty()) {
        cerr << "ERROR: No legal moves available but game not over" << endl;
        cerr << "Move number: " << (int)board.moveNum << endl;
        cerr << "Last move: " << (board.prevMove >= 0 ? board.getMoveString(board.prevMove) : "none") << endl;
        cerr << "Won sub-boards: ";
        for (uint8_t sb = 0; sb < 9; sb++) {
          if (board.isSubWon(sb)) {
            cerr << (int)sb << "(P" << (board.subWinner(sb)+1) << ") ";
          }
        }
        cerr << endl;
        cout << "NO_MOVES" << endl;
        cout << flush;
        break;
      }
      
      cerr << "Legal moves available: " << legalMoves.size() << endl;
      
      uint8_t aiMove;
      try {
        aiMove = getBestMove(board, 8); // Depth 8 for reasonable speed
      } catch (...) {
        cerr << "ERROR: getBestMove failed, using first legal move" << endl;
        aiMove = legalMoves[0];
      }
      
      if (aiMove >= 81 || !board.checkMove(aiMove)) {
        cerr << "ERROR: AI returned invalid move: " << (int)aiMove << endl;
        cerr << "Using first legal move instead" << endl;
        aiMove = legalMoves[0];
      }
      
      try {
        board.makeMove(aiMove);
      } catch (...) {
        cerr << "FATAL ERROR: makeMove failed for position " << (int)aiMove << endl;
        cout << "ERROR" << endl;
        cout << flush;
        break;
      }
      
      // Output in format expected by Node.js
      cout << "AI CHOSE THE MOVE " << board.getMoveString(aiMove) << endl;
      cout << flush;
      
      cerr << "AI played: " << board.getMoveString(aiMove) << endl;
      
      if (board.gameOver()) {
        if (board.getWinner() >= 0) {
          cerr << "Game Over! Winner: Player " << (board.getWinner() + 1) << endl;
        } else {
          cerr << "Game Over! Tie!" << endl;
        }
        break;
      }
    } else if (line == "quit" || line == "exit") {
      break;
    } else if (line == "print") {
      board.print();
      board.printTop();
    } else {
      // Opponent's move
      uint8_t move = parseMove(line);
      
      if (move >= 81) {
        cerr << "ERROR: Invalid move format: " << line << endl;
        cerr << "Move number was: " << (int)move << endl;
        continue;
      }
      
      cerr << "Attempting to play opponent move at position " << (int)move << " (Board " << (int)(move/9) << ", Cell " << (int)(move%9) << ")" << endl;
      
      if (!board.checkMove(move)) {
        cerr << "ERROR: Invalid move (not allowed by game rules): " << line << endl;
        cerr << "Position " << (int)move << " is not legal" << endl;
        
        // Print which sub-boards are won
        cerr << "Won sub-boards: ";
        for (uint8_t sb = 0; sb < 9; sb++) {
          if (board.isSubWon(sb)) {
            cerr << (int)sb << "(P" << (board.subWinner(sb)+1) << ") ";
          }
        }
        cerr << endl;
        
        cerr << "Last move was: " << (board.prevMove >= 0 ? board.getMoveString(board.prevMove) : "none") << endl;
        cerr << "Board state may be out of sync. Attempting to continue..." << endl;
        continue;
      }
      
      board.makeMove(move);
      cerr << "Opponent played: " << board.getMoveString(move) << endl;
      
      // Debug: Check if sub-board was won
      uint8_t subBoard = move / 9;
      if (board.isSubWon(subBoard)) {
        cerr << "Sub-board " << (int)subBoard << " is now won by player " << (board.subWinner(subBoard) + 1) << endl;
      }
      
      // CRITICAL: Check if opponent just won the game!
      if (board.gameOver()) {
        if (board.getWinner() >= 0) {
          cerr << "Game Over! Winner: Player " << (board.getWinner() + 1) << endl;
          cout << "GAME_OVER Player " << (board.getWinner() + 1) << " wins!" << endl;
          cout << flush;
        } else {
          cerr << "Game Over! Tie!" << endl;
          cout << "GAME_OVER Tie!" << endl;
          cout << flush;
        }
        break;
      }
    }
  }
  
  return 0;
}
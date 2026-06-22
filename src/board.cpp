#include <cassert>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>

using namespace std;

class UTTBoard
{
public:
  uint8_t moveNum;
  uint8_t subWins;
  int8_t winner;
  int8_t prevMove;
  bool board[81][2];      // [cell][player]: per-cell occupancy for each player
  bool winnerBoard[9][2]; // [subBoard][player]: which player has won each sub-board

  UTTBoard()
  {
    moveNum = 0;
    subWins = 0;
    winner = -1;
    prevMove = -1;
    memset(board, false, sizeof(board));
    memset(winnerBoard, false, sizeof(winnerBoard));
  }

  UTTBoard(const UTTBoard &other)
      : moveNum(other.moveNum),
        subWins(other.subWins),
        winner(other.winner),
        prevMove(other.prevMove)
  {
    memcpy(board, other.board, sizeof(board));
    memcpy(winnerBoard, other.winnerBoard, sizeof(winnerBoard));
  }

  // Returns whose turn it is (Player1/2 -> 0/1), derived from the move count.
  inline uint8_t whoseTurn() { return moveNum & 0b1; }

  // Translate an absolute position to its sub_board index
  inline uint8_t pos2sub(uint8_t position)
  {
    assert((position >= 0) && (position < 81));
    return position / 9;
  }

  // Translate a relative position to its absolute position
  inline uint8_t sub2pos(uint8_t subBoard, uint8_t rel_position)
  {
    assert((rel_position >= 0) && (rel_position < 9));
    assert((subBoard >= 0) && (subBoard < 9));
    return 9 * subBoard + rel_position;
  }

  // Translate absolute position to relative position for display purposes
  string getMoveString(uint8_t position)
  {
    if (position >= 81)
      return "Invalid";

    int boardIdx = position / 9;
    int cellIdx = position % 9;

    return to_string(boardIdx) + to_string(cellIdx);
  }

  // Returns whether a position has been played yet
  inline bool isPlayed(uint8_t position)
  {
    assert((position >= 0) && (position < 81));
    return board[position][0] || board[position][1];
  }

  // Returns whether a position has been played yet
  // No Player: -1, Player1/2: 0/1
  inline int8_t whoPlayed(uint8_t position)
  {
    assert((position >= 0) && (position < 81));
    return board[position][0] ? 0 : board[position][1] ? 1
                                                       : -1;
  }

  // Returns whether a subBoard has been won
  inline bool isSubWon(uint8_t subBoard)
  {
    assert((subBoard >= 0) && (subBoard < 9));
    return winnerBoard[subBoard][0] || winnerBoard[subBoard][1];
  }

  // Returns the winner of the provided subBoard
  // No Winner: -1, Player1/2: 0/1
  inline int8_t subWinner(uint8_t subBoard)
  {
    assert((subBoard >= 0) && (subBoard < 9));
    return winnerBoard[subBoard][0] ? 0 : winnerBoard[subBoard][1] ? 1
                                                                   : -1;
  }

  // Check if the game has concluded via winner or stalemate
  inline bool gameOver() { return (winner >= 0) || (subWins == 9); }

  // Return the winner of the game
  // No Winner: -1, Player1/2: 0/1
  inline int8_t getWinner() { return winner; }

  // Check if move allowed given absolute position
  bool checkMove(uint8_t abs_position)
  {
    assert((abs_position >= 0) && (abs_position < 81));
    return validMove(abs_position);
  }

  // Commit move to board given the absolute position
  void makeMove(uint8_t abs_position)
  {
    assert((abs_position >= 0) && (abs_position < 81));
    pushMove(abs_position);
  }

  // Print board state to stdout
  // Player1/2: X/O
  void print()
  {
    for (uint8_t line = 0; line < 17; line++)
    {
      if (line % 2 == 1)
      { // Divider Line
        if (line % 6 == 5)
          cout << topDividerLine;
        else
          cout << subDividerLine;
        continue;
      }

      printLineBoard((line / 2));
    }
  }

  // Print top-level board state to stdout
  // Player1/2: X/O
  void printTop()
  {
    for (int line = 0; line < 5; line++)
    {
      if (line % 2 == 1)
      { // Divider Line
        cout << subBoardDivider + '\n';
        continue;
      }

      uint8_t pos = 3 * (line / 2);
      cout << printWinMove(pos) << " | " << printWinMove(pos + 1) << " | " << printWinMove(pos + 2) << '\n';
    }
    cout << "AVAILABLE MOVES: [";
    vector<uint8_t> nextMoves = getLegalMoves();
    for (uint8_t i = 0; i < nextMoves.size(); i++)
    {
      cout << getMoveString(nextMoves[i]) << ", ";
    }
    cout << "]" << endl;
  }

  vector<uint8_t> getLegalMoves()
  {
    vector<uint8_t> availableMoves;
    if (moveNum == 0)
    {
      for (uint8_t i = 0; i < 81; i++)
        availableMoves.push_back(i);
      return availableMoves;
    }

    uint8_t next_sub_board = prevMove % 9;

    if (!isSubWon(next_sub_board))
    {
      uint8_t base_board = next_sub_board * 9;
      for (uint8_t i = 0; i < 9; i++)
      {
        uint8_t position = base_board + i;
        if (!isPlayed(position))
        {
          availableMoves.push_back(position);
        }
      }

      if (!availableMoves.empty())
        return availableMoves;
    }

    for (uint8_t sb = 0; sb < 9; sb++)
    {
      if (!isSubWon(sb))
      {
        uint8_t base_board = sb * 9;
        for (uint8_t i = 0; i < 9; i++)
        {
          uint8_t position = base_board + i;
          if (!isPlayed(position))
          {
            availableMoves.push_back(position);
          }
        }
      }
    }

    return availableMoves;
  }

  // Tunable parameters
  const float M_SUB_1 = 1.5f;      // First ally in sub-board line
  const float M_SUB_2 = 2.0f;      // Second ally in sub-board line
  const float M_MAIN_1 = 3.0f;     // First won sub-board in main line
  const float M_MAIN_2 = 5.0f;     // Second won sub-board in main line
  const float CONSTANT = 100.0f;   // Base value for won sub-board

  const float EDGE_MULT = 1.0f;    // Edge position multiplier
  const float CORNER_MULT = 1.2f;  // Corner position multiplier
  const float CENTER_MULT = 1.5f;  // Center position multiplier

  const float CENTER_SUB_BONUS = 50.0f;   // Bonus for winning center sub-board
  const float CENTER_CELL_BONUS = 20.0f;  // Bonus for center cell of center sub-board

  const int WIN_SCORE = 100000;    // Terminal win value

  // Winning lines (rows, cols, diagonals)
  const uint8_t WIN_LINES[8][3] = {
    {0, 1, 2}, {3, 4, 5}, {6, 7, 8},  // Rows
    {0, 3, 6}, {1, 4, 7}, {2, 5, 8},  // Cols
    {0, 4, 8}, {2, 4, 6}              // Diagonals
  };

  // Get position multiplier (edge/corner/center)
  float getPositionMultiplier(uint8_t index) {
    if (index == 4) return CENTER_MULT;  // Center
    if (index % 2 == 0) return CORNER_MULT;  // Corners: 0,2,6,8
    return EDGE_MULT;  // Edges: 1,3,5,7
  }

  // Get line multiplier for a position based on how many allies in each line
  float getLineMultiplier(int8_t board[9], uint8_t pos, int8_t player, float m1, float m2) {
    float maxMult = 1.0f;
    
    // Check each winning line that contains this position
    for (int i = 0; i < 8; i++) {
      bool inLine = false;
      for (int j = 0; j < 3; j++) {
        if (WIN_LINES[i][j] == pos) {
          inLine = true;
          break;
        }
      }
      
      if (!inLine) continue;
      
      // Count allies in the OTHER two positions of this line
      int allyCount = 0;
      int opponentCount = 0;
      
      for (int j = 0; j < 3; j++) {
        uint8_t checkPos = WIN_LINES[i][j];
        if (checkPos == pos) continue;  // Skip the position we're evaluating
        
        if (board[checkPos] == player) {
          allyCount++;
        } else if (board[checkPos] == (1 - player)) {
          opponentCount++;
        }
      }
      
      // Calculate multiplier for this line
      float lineMult = 1.0f;
      if (opponentCount == 0) {  // Line not blocked
        if (allyCount == 1) {
          lineMult = m1;
        } else if (allyCount == 2) {
          lineMult = m1 * m2;
        }
      }
      
      // Take max across all lines
      if (lineMult > maxMult) {
        maxMult = lineMult;
      }
    }
    
    return maxMult;
  }

  int getHeuristicScore(uint8_t current_player) {
    // Terminal state check
    if (gameOver()) {
      if (winner == current_player) return WIN_SCORE;
      if (winner == (1 - current_player)) return -WIN_SCORE;
      return 0;  // Draw
    }
    
    float score = 0.0f;
    uint8_t opponent = 1 - current_player;
    
    // Build main board state (which sub-boards are won)
    int8_t mainBoard[9];
    for (uint8_t i = 0; i < 9; i++) {
      mainBoard[i] = subWinner(i);  // Returns player (0/1) or -1 for not won
    }
    
    // --- Score won sub-boards on main board ---
    for (uint8_t subIdx = 0; subIdx < 9; subIdx++) {
      int8_t w = mainBoard[subIdx];
      
      if (w == current_player || w == opponent) {
        float baseValue = (w == current_player) ? CONSTANT : -CONSTANT;
        float globalPosMult = getPositionMultiplier(subIdx);
        float lineMult = getLineMultiplier(mainBoard, subIdx, w, M_MAIN_1, M_MAIN_2);
        
        score += baseValue * globalPosMult * lineMult;
        
        // Extra bonus for winning the center sub-board
        if (subIdx == 4) {
          score += (w == current_player) ? CENTER_SUB_BONUS : -CENTER_SUB_BONUS;
        }
      }
    }
    
    // --- Score individual cells in unwon sub-boards ---
    for (uint8_t subIdx = 0; subIdx < 9; subIdx++) {
      // Skip won sub-boards (subWinner returns -1 for unwon, 0/1 for won)
      if (mainBoard[subIdx] != -1) continue;
      
      float globalPosMult = getPositionMultiplier(subIdx);
      
      // Build sub-board state
      int8_t subBoard[9];
      for (uint8_t cell = 0; cell < 9; cell++) {
        int8_t owner = whoPlayed(sub2pos(subIdx, cell));
        subBoard[cell] = (owner == -1) ? 2 : owner;  // 2 for empty (our own sentinel)
      }
      
      // Score each occupied cell
      for (uint8_t cell = 0; cell < 9; cell++) {
        int8_t owner = subBoard[cell];
        
        if (owner == 2) continue;  // Skip empty cells
        
        float baseValue = (owner == current_player) ? 1.0f : -1.0f;
        float subPosMult = getPositionMultiplier(cell);
        float lineMult = getLineMultiplier(subBoard, cell, owner, M_SUB_1, M_SUB_2);
        
        score += baseValue * subPosMult * globalPosMult * lineMult;
        
        // Extra bonus for center cell of center sub-board
        if (subIdx == 4 && cell == 4) {
          score += (owner == current_player) ? CENTER_CELL_BONUS : -CENTER_CELL_BONUS;
        }
      }
    }
    
    return (int)score;
  }

private:
  // Check if a sub-board win condition has occurred
  bool checkSubWon(uint8_t subBoard)
  {
    assert((subBoard >= 0) && (subBoard < 9));
    uint8_t p = whoseTurn();
    uint8_t base = 9 * subBoard;

    if (board[base][p])
    {
      if (board[base + 1][p] && board[base + 2][p])
        return true;
      if (board[base + 4][p] && board[base + 8][p])
        return true;
      if (board[base + 3][p] && board[base + 6][p])
        return true;
    }
    if (board[base + 1][p] && board[base + 4][p] && board[base + 7][p])
      return true;
    if (board[base + 2][p])
    {
      if (board[base + 4][p] && board[base + 6][p])
        return true;
      if (board[base + 5][p] && board[base + 8][p])
        return true;
    }
    if (board[base + 3][p] && board[base + 4][p] && board[base + 5][p])
      return true;
    if (board[base + 6][p] && board[base + 7][p] && board[base + 8][p])
      return true;

    return false;
  }

  // Check if a sub-board win condition has occurred
  bool checkWon()
  {
    if (subWins < 3)
      return false;
    uint8_t p = whoseTurn();

    if (winnerBoard[0][p])
    {
      if (winnerBoard[1][p] && winnerBoard[2][p])
        return true;
      if (winnerBoard[4][p] && winnerBoard[8][p])
        return true;
      if (winnerBoard[3][p] && winnerBoard[6][p])
        return true;
    }
    if (winnerBoard[1][p] && winnerBoard[4][p] && winnerBoard[7][p])
      return true;
    if (winnerBoard[2][p])
    {
      if (winnerBoard[4][p] && winnerBoard[6][p])
        return true;
      if (winnerBoard[5][p] && winnerBoard[8][p])
        return true;
    }
    if (winnerBoard[3][p] && winnerBoard[4][p] && winnerBoard[5][p])
      return true;
    if (winnerBoard[6][p] && winnerBoard[7][p] && winnerBoard[8][p])
      return true;

    return false;
  }

  // Check Move Validity
  bool validMove(uint8_t position)
  {
    if (gameOver())
      return false;
    uint8_t subBoard = pos2sub(position);

    // Basic validity: cell not played, sub-board not already won
    if (isPlayed(position) || isSubWon(subBoard))
      return false;

    // "Send" constraint: the previous move's cell index dictates which
    // sub-board this move must land in.
    if (prevMove != -1)
    {
      uint8_t targetBoard = prevMove % 9;

      // Free move: target board already won, so any valid cell is allowed.
      if (isSubWon(targetBoard))
        return true;

      // Move lands in the required target board.
      if (subBoard == targetBoard)
        return true;

      // Move is outside the target board, which is only allowed if the target
      // board is completely full (any empty cell there makes this illegal).
      int base = targetBoard * 9;
      for (int i = 0; i < 9; i++)
      {
        if (!isPlayed(base + i))
          return false;
      }
    }

    return true;
  }

  // Internally Commit move to board
  void pushMove(uint8_t position)
  {
    assert(validMove(position));

    uint8_t subBoard = pos2sub(position);
    uint8_t p = whoseTurn();

    board[position][p] = true;
    if (checkSubWon(subBoard))
    {
      winnerBoard[subBoard][p] = true;
      subWins++;
      if (checkWon())
      {
        winner = p;
        return;
      }
    }

    prevMove = position;
    moveNum++;
  }

  // +----------------------+
  // |  Printing Utilities  |
  // +----------------------+

  // Printing definitions
  inline static const string subBoardDivider = "--+---+--";
  inline static const string topPartDivider = string(subBoardDivider.length(), '-');
  inline static const string subDividerLine = subBoardDivider + " | " + subBoardDivider + " | " + subBoardDivider + '\n';
  inline static const string topDividerLine = topPartDivider + "-+-" + topPartDivider + "-+-" + topPartDivider + '\n';

  // Returns the appropriate character for the state of a position
  inline char printMove(uint8_t pos)
  {
    switch (whoPlayed(pos))
    {
    case 0:
      return 'X';
    case 1:
      return 'O';
    default:
      return ' ';
    }
  }

  // Returns the appropriate character for the state of a position
  inline char printWinMove(uint8_t subBoard)
  {
    switch (subWinner(subBoard))
    {
    case 0:
      return 'X';
    case 1:
      return 'O';
    default:
      return ' ';
    }
  }

  // Print the data line of a sub-board beginning at provided position
  inline void printLineSubBoard(uint8_t pos)
  {
    cout << printMove(pos) << " | " << printMove(pos + 1) << " | " << printMove(pos + 2);
  }

  // Print the data line of a board beginning at provided position
  inline void printLineBoard(uint8_t line)
  {
    uint8_t position = 3 * line + 18 * (line / 3);
    printLineSubBoard(position);
    cout << " | ";
    printLineSubBoard(position + 9);
    cout << " | ";
    printLineSubBoard(position + 18);
    cout << '\n';
  }
};

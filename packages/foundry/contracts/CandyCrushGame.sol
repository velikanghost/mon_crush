// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title CandyCrushGame
 * @notice A blockchain-based Candy Crush-like game where game actions are recorded on-chain
 * @dev This contract handles the game state and records matches
 */
contract CandyCrushGame {
    // Game board size
    uint8 public constant BOARD_SIZE = 8;

    // Item types
    uint8 public constant EMPTY = 0;
    uint8 public constant RED_CANDY = 1;
    uint8 public constant BLUE_CANDY = 2;
    uint8 public constant GREEN_CANDY = 3;
    uint8 public constant YELLOW_CANDY = 4;
    uint8 public constant PURPLE_CANDY = 5;

    // Game state
    mapping(uint256 => mapping(uint256 => uint8)) public gameBoard;
    mapping(address => uint256) public playerScores;
    mapping(address => uint256) public matchesMade;

    // Events
    event CandyMatched(
        address indexed player,
        uint8 x,
        uint8 y,
        uint8 candyType
    );
    event ScoreUpdated(address indexed player, uint256 newScore);
    event GameBoardUpdated(uint8[8][8] board);

    /**
     * @notice Record a candy match at the specified position
     * @param x The x-coordinate (column) of the match
     * @param y The y-coordinate (row) of the match
     * @param candyType The type of candy that was matched
     * @return success Whether the match was successfully recorded
     */
    function recordMatch(
        uint8 x,
        uint8 y,
        uint8 candyType
    ) external returns (bool success) {
        require(x < BOARD_SIZE, "X coordinate out of bounds");
        require(y < BOARD_SIZE, "Y coordinate out of bounds");
        require(
            candyType > EMPTY && candyType <= PURPLE_CANDY,
            "Invalid candy type"
        );

        // Record the match
        gameBoard[x][y] = EMPTY; // Clear the matched candy
        playerScores[msg.sender] += 10; // Award points
        matchesMade[msg.sender]++;

        // Emit events
        emit CandyMatched(msg.sender, x, y, candyType);
        emit ScoreUpdated(msg.sender, playerScores[msg.sender]);

        return true;
    }

    /**
     * @notice Get the current score for a player
     * @param player The address of the player
     * @return score The player's current score
     */
    function getPlayerScore(
        address player
    ) external view returns (uint256 score) {
        return playerScores[player];
    }

    /**
     * @notice Get the current number of matches made by a player
     * @param player The address of the player
     * @return matches The number of matches the player has made
     */
    function getMatchesMade(
        address player
    ) external view returns (uint256 matches) {
        return matchesMade[player];
    }

    /**
     * @notice Update the entire game board (admin function for initialization)
     * @param newBoard The new state of the game board
     */
    function updateGameBoard(uint8[8][8] calldata newBoard) external {
        for (uint8 i = 0; i < BOARD_SIZE; i++) {
            for (uint8 j = 0; j < BOARD_SIZE; j++) {
                gameBoard[i][j] = newBoard[i][j];
            }
        }

        emit GameBoardUpdated(newBoard);
    }

    /**
     * @notice Get a candy at a specific position
     * @param x The x-coordinate (column)
     * @param y The y-coordinate (row)
     * @return candyType The type of candy at the position
     */
    function getCandyAt(
        uint8 x,
        uint8 y
    ) external view returns (uint8 candyType) {
        require(x < BOARD_SIZE, "X coordinate out of bounds");
        require(y < BOARD_SIZE, "Y coordinate out of bounds");
        return gameBoard[x][y];
    }
}

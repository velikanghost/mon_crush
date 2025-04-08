// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title MonadMatch
 * @notice A blockchain-based game where game actions are recorded on-chain
 * @dev This contract handles the game state and records matches
 */
contract MonadMatch {
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

    // Game wallet mappings
    mapping(address => address) public gameWalletToMainWallet; // Maps game wallet -> main wallet
    mapping(address => address[]) public mainWalletToGameWallets; // Maps main wallet -> game wallets
    mapping(address => uint256) public gameWalletCount; // Count of game wallets per main wallet

    // Events
    event MonanimalMatched(
        address indexed player,
        uint8 x,
        uint8 y,
        uint8 monanimalType
    );
    event ScoreUpdated(address indexed player, uint256 newScore);
    event GameBoardUpdated(uint8[8][8] board);
    event GameWalletLinked(
        address indexed mainWallet,
        address indexed gameWallet
    );

    /**
     * @notice Links a game wallet to a main wallet
     * @param gameWallet The address of the game wallet to link
     * @dev The main wallet is msg.sender
     * @return success Whether the wallet was successfully linked
     */
    function linkGameWallet(
        address gameWallet
    ) external returns (bool success) {
        require(gameWallet != address(0), "Invalid game wallet address");
        require(gameWallet != msg.sender, "Game wallet cannot be main wallet");
        require(
            gameWalletToMainWallet[gameWallet] == address(0),
            "Game wallet already linked"
        );

        // Link the game wallet to the main wallet
        gameWalletToMainWallet[gameWallet] = msg.sender;

        // Add game wallet to the main wallet's array
        mainWalletToGameWallets[msg.sender].push(gameWallet);
        gameWalletCount[msg.sender]++;

        emit GameWalletLinked(msg.sender, gameWallet);
        return true;
    }

    /**
     * @notice Gets the main wallet associated with a game wallet
     * @param gameWallet The address of the game wallet
     * @return mainWallet The address of the linked main wallet
     */
    function getMainWallet(
        address gameWallet
    ) external view returns (address mainWallet) {
        return gameWalletToMainWallet[gameWallet];
    }

    /**
     * @notice Gets all game wallets associated with a main wallet
     * @param mainWallet The address of the main wallet
     * @return gameWallets Array of linked game wallet addresses
     */
    function getGameWallets(
        address mainWallet
    ) external view returns (address[] memory gameWallets) {
        return mainWalletToGameWallets[mainWallet];
    }

    /**
     * @notice Checks if a game wallet is linked to a main wallet
     * @param gameWallet The game wallet address to check
     * @param mainWallet The main wallet address to check against
     * @return isLinked Whether the wallets are linked
     */
    function isWalletLinked(
        address gameWallet,
        address mainWallet
    ) external view returns (bool isLinked) {
        return gameWalletToMainWallet[gameWallet] == mainWallet;
    }

    /**
     * @notice Record a monanimal match at the specified position
     * @param x The x-coordinate (column) of the match
     * @param y The y-coordinate (row) of the match
     * @param monanimalType The type of monanimal that was matched
     * @return success Whether the match was successfully recorded
     */
    function recordMatch(
        uint8 x,
        uint8 y,
        uint8 monanimalType
    ) external returns (bool success) {
        require(x < BOARD_SIZE, "X coordinate out of bounds");
        require(y < BOARD_SIZE, "Y coordinate out of bounds");
        require(
            monanimalType > EMPTY && monanimalType <= PURPLE_CANDY,
            "Invalid monanimal type"
        );

        address player = msg.sender;
        address mainWallet = gameWalletToMainWallet[player];

        // If this is a game wallet, use the main wallet for scoring
        if (mainWallet != address(0)) {
            player = mainWallet;
        }

        // Record the match
        gameBoard[x][y] = EMPTY; // Clear the matched monanimal
        playerScores[player] += 10; // Award points to the main wallet (or sender if not a game wallet)
        matchesMade[player]++;

        // Emit events
        emit MonanimalMatched(player, x, y, monanimalType);
        emit ScoreUpdated(player, playerScores[player]);

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
     * @notice Get a monanimal at a specific position
     * @param x The x-coordinate (column)
     * @param y The y-coordinate (row)
     * @return monanimalType The type of monanimal at the position
     */
    function getMonanimalAt(
        uint8 x,
        uint8 y
    ) external view returns (uint8 monanimalType) {
        require(x < BOARD_SIZE, "X coordinate out of bounds");
        require(y < BOARD_SIZE, "Y coordinate out of bounds");
        return gameBoard[x][y];
    }
}

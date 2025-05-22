// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./MonadMatch.sol";

contract GameEscrow {
    // Reference to main game contract
    MonadMatch public monadMatch;

    // Game configuration constants
    uint256 public constant GAME_DURATION = 2 minutes; // Duration of versus games

    /**
     * @notice Game data structure containing all the information for a versus game
     * @dev Stores all relevant data for game state and player information
     */
    struct VersusGame {
        address player1; // Address of player who initiated the game
        address player2; // Address of the player who accepted the invitation
        uint256 wagerAmount; // Amount each player wagered
        uint256 startTime; // When the game started
        uint256 endTime; // When the game will end
        bool isActive; // Whether the game is currently active
        bool isClaimed; // Whether the prize has been claimed
        string player1FarcasterName; // Farcaster username of player 1
        string player2FarcasterName; // Farcaster username of player 2
        uint256 player1Score; // Score of player 1
        uint256 player2Score; // Score of player 2
        bool player1ScoreSubmitted; // Whether player 1 has submitted their score
        bool player2ScoreSubmitted; // Whether player 2 has submitted their score
    }

    // Storage variables
    mapping(bytes32 => VersusGame) public versusGames;
    mapping(address => bytes32[]) public playerGames;
    mapping(string => address) public farcasterNameToAddress;

    // Events
    /**
     * @notice Emitted when a new game is created
     * @param gameId Unique identifier for the game
     * @param player1 Address of the player who created the game
     * @param player1FarcasterName Farcaster username of player 1
     * @param player2FarcasterName Farcaster username of the invited player
     * @param wagerAmount Amount wagered by player 1
     */
    event GameCreated(
        bytes32 indexed gameId,
        address indexed player1,
        string player1FarcasterName,
        string player2FarcasterName,
        uint256 wagerAmount
    );
    /**
     * @notice Emitted when a player joins a game
     * @param gameId Unique identifier for the game
     * @param player2 Address of the player who joined the game
     */
    event GameJoined(bytes32 indexed gameId, address indexed player2);
    /**
     * @notice Emitted when a game starts
     * @param gameId Unique identifier for the game
     * @param startTime Timestamp when the game started
     * @param endTime Timestamp when the game will end
     */
    event GameStarted(
        bytes32 indexed gameId,
        uint256 startTime,
        uint256 endTime
    );
    /**
     * @notice Emitted when a game ends
     * @param gameId Unique identifier for the game
     * @param winner Address of the winner (address(0) for a tie)
     * @param prize Amount of MON tokens awarded to the winner
     */
    event GameEnded(
        bytes32 indexed gameId,
        address indexed winner,
        uint256 prize
    );
    /**
     * @notice Emitted when a game is cancelled
     * @param gameId Unique identifier for the cancelled game
     */
    event GameCancelled(bytes32 indexed gameId);
    /**
     * @notice Emitted when a player submits their score
     * @param gameId Unique identifier for the game
     * @param player Address of the player who submitted the score
     * @param score The score submitted by the player
     */
    event ScoreSubmitted(
        bytes32 indexed gameId,
        address indexed player,
        uint256 score
    );

    /**
     * @notice Initialize the escrow contract with the main game contract
     * @param _monadMatch Address of the MonadMatch contract
     */
    constructor(address _monadMatch) {
        monadMatch = MonadMatch(_monadMatch);
    }

    /**
     * @notice Create a new versus game and place wager in escrow
     * @param player2FarcasterName The Farcaster username of the invited player
     * @param player1FarcasterName The Farcaster username of the player creating the game
     * @return gameId The unique identifier for the created game
     * @dev Requires sender to provide a wager amount as msg.value
     */
    function createGame(
        string calldata player2FarcasterName,
        string calldata player1FarcasterName
    ) external payable returns (bytes32 gameId) {
        require(msg.value > 0, "Wager amount must be greater than 0");

        // Register player's Farcaster name if not already done
        if (farcasterNameToAddress[player1FarcasterName] == address(0)) {
            farcasterNameToAddress[player1FarcasterName] = msg.sender;
        }
        require(
            farcasterNameToAddress[player1FarcasterName] == msg.sender,
            "Not your Farcaster name"
        );

        // Generate a unique game ID
        gameId = keccak256(
            abi.encodePacked(msg.sender, player2FarcasterName, block.timestamp)
        );

        // Create the game
        versusGames[gameId] = VersusGame({
            player1: msg.sender,
            player2: address(0),
            wagerAmount: msg.value,
            startTime: 0,
            endTime: 0,
            isActive: false,
            isClaimed: false,
            player1FarcasterName: player1FarcasterName,
            player2FarcasterName: player2FarcasterName,
            player1Score: 0,
            player2Score: 0,
            player1ScoreSubmitted: false,
            player2ScoreSubmitted: false
        });

        // Store the game ID in player's games list
        playerGames[msg.sender].push(gameId);

        emit GameCreated(
            gameId,
            msg.sender,
            player1FarcasterName,
            player2FarcasterName,
            msg.value
        );
        return gameId;
    }

    /**
     * @notice Join an existing game as player 2 and match the wager
     * @param gameId The ID of the game to join
     * @param farcasterName The Farcaster username of player 2
     * @dev Requires sender to provide a matching wager amount as msg.value
     * @dev Automatically starts the game after joining
     */
    function joinGame(
        bytes32 gameId,
        string calldata farcasterName
    ) external payable {
        VersusGame storage game = versusGames[gameId];

        require(game.player1 != address(0), "Game does not exist");
        require(game.player2 == address(0), "Game already has two players");
        require(!game.isActive, "Game already started");
        require(
            msg.value == game.wagerAmount,
            "Must match the exact wager amount"
        );
        require(
            keccak256(abi.encodePacked(game.player2FarcasterName)) ==
                keccak256(abi.encodePacked(farcasterName)),
            "Not the invited player"
        );

        // Register player's Farcaster name if not already done
        if (farcasterNameToAddress[farcasterName] == address(0)) {
            farcasterNameToAddress[farcasterName] = msg.sender;
        }
        require(
            farcasterNameToAddress[farcasterName] == msg.sender,
            "Not your Farcaster name"
        );

        // Update game with player 2's information
        game.player2 = msg.sender;

        // Store the game ID in player 2's games list
        playerGames[msg.sender].push(gameId);

        emit GameJoined(gameId, msg.sender);

        // Automatically start the game once player 2 joins
        _startGame(gameId);
    }

    /**
     * @notice Internal function to start the game timer
     * @param gameId The ID of the game to start
     * @dev Sets the start and end time and marks the game as active
     */
    function _startGame(bytes32 gameId) internal {
        VersusGame storage game = versusGames[gameId];

        require(
            game.player1 != address(0) && game.player2 != address(0),
            "Need two players to start"
        );
        require(!game.isActive, "Game already started");

        // Set game timing
        game.startTime = block.timestamp;
        game.endTime = block.timestamp + GAME_DURATION;
        game.isActive = true;

        emit GameStarted(gameId, game.startTime, game.endTime);
    }

    /**
     * @notice Submit score for a player in an active game
     * @param gameId The ID of the game
     * @param player The address of the player for whom to submit the score
     * @param score The player's score
     * @return success Whether the score was successfully submitted
     */
    function submitScore(
        bytes32 gameId,
        address player,
        uint256 score
    ) external returns (bool success) {
        VersusGame storage game = versusGames[gameId];

        require(game.isActive, "Game not active");
        require(
            player == game.player1 || player == game.player2,
            "Not a valid player in this game"
        );

        if (player == game.player1) {
            require(!game.player1ScoreSubmitted, "Score already submitted");
            game.player1Score = score;
            game.player1ScoreSubmitted = true;
        } else {
            require(!game.player2ScoreSubmitted, "Score already submitted");
            game.player2Score = score;
            game.player2ScoreSubmitted = true;
        }

        emit ScoreSubmitted(gameId, player, score);
        return true;
    }

    /**
     * @notice Get scores for a specific game
     * @param gameId The ID of the game
     * @return player1Score The score of player 1
     * @return player2Score The score of player 2
     * @return player1Submitted Whether player 1 has submitted their score
     * @return player2Submitted Whether player 2 has submitted their score
     */
    function getGameScores(
        bytes32 gameId
    )
        external
        view
        returns (
            uint256 player1Score,
            uint256 player2Score,
            bool player1Submitted,
            bool player2Submitted
        )
    {
        VersusGame memory game = versusGames[gameId];
        return (
            game.player1Score,
            game.player2Score,
            game.player1ScoreSubmitted,
            game.player2ScoreSubmitted
        );
    }

    /**
     * @notice End the game and distribute the prize to the winner
     * @param gameId The ID of the game to end
     * @dev Can only be called after the game time has expired
     * @dev Determines winner based on submitted scores or fallback to MonadMatch contract
     */
    function endGame(bytes32 gameId) external {
        VersusGame storage game = versusGames[gameId];

        require(game.isActive, "Game not active");
        require(block.timestamp >= game.endTime, "Game still in progress");
        require(!game.isClaimed, "Prize already claimed");

        // Mark as claimed to prevent reentrancy
        game.isClaimed = true;

        // Determine the winner based on the submitted scores or fallback to MonadMatch scores
        uint256 score1 = game.player1ScoreSubmitted
            ? game.player1Score
            : monadMatch.getPlayerScore(game.player1);

        uint256 score2 = game.player2ScoreSubmitted
            ? game.player2Score
            : monadMatch.getPlayerScore(game.player2);

        address winner;
        if (score1 > score2) {
            winner = game.player1;
        } else if (score2 > score1) {
            winner = game.player2;
        } else {
            // If it's a tie, return funds to both players
            payable(game.player1).transfer(game.wagerAmount);
            payable(game.player2).transfer(game.wagerAmount);

            emit GameEnded(gameId, address(0), 0); // Indicate a tie
            return;
        }

        // Calculate the prize (total of both wagers)
        uint256 prize = game.wagerAmount * 2;

        // Transfer the prize to the winner
        payable(winner).transfer(prize);

        // Update game state
        game.isActive = false;

        emit GameEnded(gameId, winner, prize);
    }

    /**
     * @notice Cancel a game that hasn't been joined yet and refund the wager
     * @param gameId The ID of the game to cancel
     * @dev Can only be called by the game creator and only before player 2 joins
     */
    function cancelGame(bytes32 gameId) external {
        VersusGame storage game = versusGames[gameId];

        require(msg.sender == game.player1, "Only creator can cancel");
        require(game.player2 == address(0), "Game already has two players");
        require(!game.isActive, "Game already started");

        // Get the wager amount before deleting the game
        uint256 refundAmount = game.wagerAmount;

        // Mark game as inactive
        game.isActive = false;
        game.isClaimed = true;

        // Refund the wager to player 1
        payable(game.player1).transfer(refundAmount);

        emit GameCancelled(gameId);
    }

    /**
     * @notice Get active games for a player
     * @param player The address of the player
     * @return activeGameIds List of active game IDs the player is participating in
     * @dev Useful for the frontend to display a player's active games
     */
    function getPlayerActiveGames(
        address player
    ) external view returns (bytes32[] memory activeGameIds) {
        bytes32[] memory allGames = playerGames[player];
        uint256 activeCount = 0;

        // First count active games
        for (uint256 i = 0; i < allGames.length; i++) {
            if (versusGames[allGames[i]].isActive) {
                activeCount++;
            }
        }

        // Then populate the array
        activeGameIds = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allGames.length; i++) {
            if (versusGames[allGames[i]].isActive) {
                activeGameIds[index] = allGames[i];
                index++;
            }
        }

        return activeGameIds;
    }

    /**
     * @notice Get details of a specific game
     * @param gameId The ID of the game
     * @return gameDetails The details of the game
     * @dev Returns all information about a game including players, wagers, and timing
     */
    function getGameDetails(
        bytes32 gameId
    ) external view returns (VersusGame memory gameDetails) {
        return versusGames[gameId];
    }

    /**
     * @notice Check if a game needs to be ended (time has expired)
     * @param gameId The ID of the game to check
     * @return needsEnding Whether the game needs to be ended
     * @dev Useful for the frontend to determine if endGame should be called
     */
    function gameNeedsEnding(
        bytes32 gameId
    ) external view returns (bool needsEnding) {
        VersusGame memory game = versusGames[gameId];
        return
            game.isActive && block.timestamp >= game.endTime && !game.isClaimed;
    }
}

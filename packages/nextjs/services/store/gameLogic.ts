import { MatchData } from "./gameStore";
import { useGameStore } from "./gameStore";
import { playComboSound, playMatchSound } from "~~/services/audio/gameAudio";
import { addTxHashToDB } from "~~/services/indexeddb/transactionDB";
import { extendUserSession } from "~~/services/utils/sessionStorage";
import { sendBatchMatchTransactions } from "~~/services/wallet/gameWalletService";
import { CANDY_NAMES } from "~~/utils/helpers";

// Variable to store the refillBoard implementation
let realRefillBoardImpl: ((board: number[][], checkForChainMatches?: boolean) => void) | null = null;

// Remove old sound references and initialization
// Sound reference for match sound
// let matchSoundRef: HTMLAudioElement | null = null;

// Initialize the match sound
export const initMatchSound = () => {
  // This function is now just a wrapper around the gameAudio initialization
  // which will be handled in a separate component
  console.log("Match sound initialization now handled by gameAudio service");
};

// Helper function to process matches using game wallet instead of relayer
export const processMatchesWithGameWallet = async (
  matchesToProcess: MatchData[],
  gameWalletPrivateKey: string | undefined,
) => {
  const { setGameStatus, setTxHashes } = useGameStore.getState();

  if (!gameWalletPrivateKey) {
    console.warn("Game wallet private key not available, skipping transaction.");
    setGameStatus("Game wallet not ready. Please connect wallet and generate a game wallet.");
    return [];
  }

  if (matchesToProcess.length === 0) {
    return [];
  }

  try {
    console.log(`Processing ${matchesToProcess.length} matches with game wallet...`);

    // Send batch transactions using the game wallet
    const txHashes = await sendBatchMatchTransactions(gameWalletPrivateKey, matchesToProcess);

    console.log(`Successfully sent ${txHashes.length} transactions`);
    setGameStatus(`Sent ${txHashes.length} transactions to the blockchain!`);

    // Update transaction hashes in the store
    if (txHashes.length > 0) {
      // Add tx hashes directly to the store
      const { txHashes: currentHashes } = useGameStore.getState();
      setTxHashes([...txHashes, ...currentHashes].slice(0, 100)); // Limit to 100 hashes for performance

      // Save each hash to IndexedDB for persistence
      txHashes.forEach(hash => {
        addTxHashToDB(hash).catch(error => {
          console.error("Failed to save transaction hash to IndexedDB:", error);
        });
      });
    }

    return txHashes;
  } catch (error) {
    console.error("Error processing matches with game wallet:", error);
    setGameStatus("Error submitting matches to blockchain. Try again later.");
    return [];
  }
};

// Process a chain match (automatic match after refill)
export const processChainMatch = (
  board: number[][],
  chainMatches: MatchData[],
  gameWalletPrivateKey: string | undefined,
) => {
  const {
    comboCounter,
    scoreMultiplier,
    setComboCounter,
    setScoreMultiplier,
    setGameStatus,
    setMatches,
    setGameBoard,
    setScore,
    setTxCount,
    checkForMatchesInBoard,
  } = useGameStore.getState();

  // Play combo sound for chain reactions with increasing intensity based on the chain count
  playComboSound(comboCounter + 1);

  // Increment combo counter
  const newComboCounter = comboCounter + 1;
  setComboCounter(newComboCounter);

  // Check if we've reached 5 consecutive matches for combo multiplier
  if (newComboCounter === 5) {
    setScoreMultiplier(1.1);
    setGameStatus("COMBO x1.1! Bonus points activated!");
  } else if (newComboCounter > 5) {
    setGameStatus(`COMBO x1.1! Chain reaction - ${newComboCounter} consecutive matches!`);
  } else {
    setGameStatus(`Chain reaction! ${newComboCounter} consecutive matches!`);
  }

  // Mark matched candies in UI
  setMatches(chainMatches);

  // Clear matched candies
  const newBoard = board.map(row => [...row]); // Create a fresh deep copy
  chainMatches.forEach(match => {
    newBoard[match.y][match.x] = 0;
  });

  // Set the game board state immediately
  setGameBoard(newBoard);

  // Update score with multiplier if applicable
  const basePoints = chainMatches.length * 10;
  const pointsWithMultiplier = Math.floor(basePoints * scoreMultiplier);
  setScore(prev => prev + pointsWithMultiplier);

  // Update transaction count optimistically based on number of matches
  setTxCount(prev => prev + chainMatches.length);

  // Process matches with game wallet
  if (gameWalletPrivateKey) {
    processMatchesWithGameWallet(chainMatches, gameWalletPrivateKey);
  }

  // Log debug info
  console.log(`CHAIN REACTION #${newComboCounter}: ${chainMatches.length} matches, multiplier: ${scoreMultiplier}`);

  // Flash a visual indicator for debugging
  if (typeof document !== "undefined") {
    document.body.classList.add("chain-reaction");
    setTimeout(() => document.body.classList.remove("chain-reaction"), 300);
  }

  // Use requestAnimationFrame to ensure the UI has updated before refilling
  requestAnimationFrame(() => {
    // Use a short delay to ensure the UI has completely rendered the board with zeros
    setTimeout(() => {
      console.log("Refilling board after chain reaction");
      // Use the debounced refill to prevent race conditions
      debouncedRefill(newBoard, true);
    }, 400);
  });
};

// Create a debounced refill function to prevent multiple refills happening at once
export const debouncedRefill = (() => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (board: number[][], checkForChainMatches = true) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set a new timeout
    timeoutId = setTimeout(() => {
      if (realRefillBoardImpl) {
        realRefillBoardImpl(board, checkForChainMatches);
      }
      timeoutId = null;
    }, 50);
  };
})();

// Refill the board with new candies without creating matches
export const refillBoard = (board: number[][], checkForChainMatches = true) => {
  const { setGameBoard, setComboCounter, setScoreMultiplier, setGameStatus, checkForMatchesInBoard } =
    useGameStore.getState();

  // Create a deep copy of the board to avoid mutation issues
  const newBoard = board.map(row => [...row]);

  // For each column, move existing candies down to fill gaps
  for (let x = 0; x < 6; x++) {
    let emptySpaces = 0;
    for (let y = 5; y >= 0; y--) {
      if (newBoard[y][x] === 0) {
        emptySpaces++;
      } else if (emptySpaces > 0) {
        newBoard[y + emptySpaces][x] = newBoard[y][x];
        newBoard[y][x] = 0;
      }
    }

    // Fill empty spaces at the top with new candies that don't create matches
    for (let y = 0; y < emptySpaces; y++) {
      // Determine what candy types would create matches
      const invalidTypes = new Set<number>();

      // Check horizontal matches
      if (x >= 2 && newBoard[y][x - 1] === newBoard[y][x - 2]) {
        invalidTypes.add(newBoard[y][x - 1]);
      }
      if (
        x >= 1 &&
        x < 5 &&
        newBoard[y][x - 1] !== 0 &&
        newBoard[y][x + 1] !== 0 &&
        newBoard[y][x - 1] === newBoard[y][x + 1]
      ) {
        invalidTypes.add(newBoard[y][x - 1]);
      }

      // Check below for vertical matches (we're filling top-down)
      if (y < 4 && newBoard[y + 1][x] !== 0 && newBoard[y + 2][x] !== 0 && newBoard[y + 1][x] === newBoard[y + 2][x]) {
        invalidTypes.add(newBoard[y + 1][x]);
      }

      // Choose a valid candy type
      let validTypes = [1, 2, 3, 4, 5].filter(t => !invalidTypes.has(t));

      // If there are no valid types for some reason, just pick any type
      if (validTypes.length === 0) {
        validTypes = [1, 2, 3, 4, 5];
      }

      newBoard[y][x] = validTypes[Math.floor(Math.random() * validTypes.length)];
    }
  }

  // Update the game board state
  setGameBoard(newBoard);

  // Use requestAnimationFrame to ensure the UI is updated before proceeding
  requestAnimationFrame(() => {
    // Only check for chain matches if requested
    if (checkForChainMatches) {
      // Allow a short delay for the UI to update
      setTimeout(() => {
        // Make a fresh deep copy to check for matches
        const boardCopy = newBoard.map(row => [...row]);
        const chainMatches = checkForMatchesInBoard(boardCopy);

        // If there are chain matches, process them
        if (chainMatches.length > 0) {
          console.log(`Found ${chainMatches.length} chain matches!`);
          // FIX: Pass the game wallet private key, not the user's address
          const { gameWalletPrivateKey } = useGameStore.getState();
          processChainMatch(newBoard, chainMatches, gameWalletPrivateKey);
        } else {
          // No more chain matches, reset combo counter
          setComboCounter(0);
          setScoreMultiplier(1);
          setGameStatus("Ready for next move!");
        }
      }, 300);
    } else {
      setGameStatus("Ready for next move!");
    }
  });
};

// Set refillBoard implementation for use by the debounced version
realRefillBoardImpl = refillBoard;

// Export a function to set the refillBoard implementation
export const setRefillBoardImpl = (impl: (board: number[][], checkForChainMatches?: boolean) => void) => {
  realRefillBoardImpl = impl;
};

// Handle candy click
export const handleCandyClick = async (x: number, y: number) => {
  const {
    gameBoard,
    selectedCandy,
    setSelectedCandy,
    setMatches,
    setScore,
    setTxCount,
    setGameStatus,
    setGameBoard,
    address,
    gameWalletPrivateKey,
    checkForMatchesInBoard,
  } = useGameStore.getState();

  // Extend the user's session when they interact with the game
  if (address) {
    extendUserSession(address);
  }

  // First click - select candy
  if (!selectedCandy) {
    setSelectedCandy({ x, y });
    setGameStatus(`Selected ${CANDY_NAMES[gameBoard[y][x] as keyof typeof CANDY_NAMES]} at (${x},${y})`);
    return;
  }

  // Same candy clicked - deselect
  if (selectedCandy.x === x && selectedCandy.y === y) {
    setSelectedCandy(null);
    setGameStatus("Deselected candy");
    return;
  }

  // Second click - Check if it's adjacent to the selected candy
  const isAdjacent =
    (Math.abs(selectedCandy.x - x) === 1 && selectedCandy.y === y) ||
    (Math.abs(selectedCandy.y - y) === 1 && selectedCandy.x === x);

  if (!isAdjacent) {
    setSelectedCandy({ x, y });
    setGameStatus(
      `Not adjacent. Selected ${CANDY_NAMES[gameBoard[y][x] as keyof typeof CANDY_NAMES]} at (${x},${y}) instead.`,
    );
    return;
  }

  // Try the swap to see if it creates a match
  const newBoard = gameBoard.map(row => [...row]);
  const tempCandy = newBoard[selectedCandy.y][selectedCandy.x];
  newBoard[selectedCandy.y][selectedCandy.x] = newBoard[y][x];
  newBoard[y][x] = tempCandy;

  // Check for matches in the new board
  const matches = checkForMatchesInBoard(newBoard);

  // If no matches, revert the swap
  if (matches.length === 0) {
    setGameStatus("Invalid move - no matches would be created");
    setSelectedCandy(null);
    return;
  }

  // Valid swap - update UI with the swapped positions
  setGameBoard(newBoard);
  setSelectedCandy(null);

  // Play match sound effect - always use match sound for direct matches regardless of size
  playMatchSound();

  // Update score based on match count
  const basePoints = matches.length * 10;
  setScore(prev => prev + basePoints);
  setTxCount(prev => prev + matches.length);

  // Mark matched candies in UI
  setMatches(matches);

  // Update status message
  setGameStatus(`Matched ${matches.length} ${matches.length === 1 ? "candy" : "candies"} for ${basePoints} points!`);

  // Now that we have matches, clear them from the board
  const clearedBoard = newBoard.map(row => [...row]);
  matches.forEach(match => {
    clearedBoard[match.y][match.x] = 0;
  });

  // Process matches with game wallet
  if (gameWalletPrivateKey) {
    processMatchesWithGameWallet(matches, gameWalletPrivateKey);
  } else {
    console.warn("Game wallet private key not available. Matches will not be recorded on-chain.");
  }

  // Update the board after a small delay for better UX
  setTimeout(() => {
    // Update the board with cleared candies
    setGameBoard(clearedBoard);

    // After clearing, trigger a refill
    setTimeout(() => {
      console.log("Refilling board after clearing matches");
      debouncedRefill(clearedBoard, true);
    }, 300);
  }, 300);
};

// Attach the handleCandyClick function to the game store
export const initGameLogic = () => {
  const { handleCandyClick } = useGameStore.getState();
  const newHandleCandyClick = (x: number, y: number) => {
    return handleCandyClick(x, y);
  };
  useGameStore.setState({ handleCandyClick: newHandleCandyClick });

  // Initialize refillBoard implementation
  realRefillBoardImpl = refillBoard;
};

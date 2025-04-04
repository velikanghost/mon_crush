import { MatchData } from "./gameStore";
import { useGameStore } from "./gameStore";
import { CANDY_NAMES } from "~~/utils/helpers";

// Sound reference for match sound
let matchSoundRef: HTMLAudioElement | null = null;

// Initialize the match sound
export const initMatchSound = () => {
  if (typeof window !== "undefined" && !matchSoundRef) {
    matchSoundRef = new Audio("/match.mp3");
  }
};

// Function to play match sound
export const playMatchSound = () => {
  if (matchSoundRef) {
    // Reset the audio to start position and play
    matchSoundRef.currentTime = 0;
    matchSoundRef.play().catch(error => {
      // Handle any browser autoplay restrictions
      console.log("Error playing sound:", error);
    });
  }
};

// Helper function to POST matches to the relayer API
export const postMatchesToRelayer = async (matchesToPost: MatchData[], address: string | undefined) => {
  const { setGameStatus, setPendingTxCount } = useGameStore.getState();

  if (!address) {
    console.warn("Wallet not connected, skipping relayer call.");
    setGameStatus("Connect wallet to save matches!");
    return;
  }

  console.log(`Posting ${matchesToPost.length} matches to relayer for address ${address}...`);

  // Post each match individually (backend handles batching)
  for (const match of matchesToPost) {
    try {
      const response = await fetch("/api/relayer/candymatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: match.x,
          y: match.y,
          candyType: match.type,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Relayer response:", data.message);
        // Update pending count based on the message (extract number)
        const queueSizeMatch = data.message?.match(/Current queue size: (\d+)/);
        if (queueSizeMatch && queueSizeMatch[1]) {
          setPendingTxCount(parseInt(queueSizeMatch[1], 10));
        }
      } else {
        console.error("Error response from relayer:", await response.text());
        setGameStatus("Error submitting match to relayer.");
      }
    } catch (error) {
      console.error("Error posting match to relayer:", error);
      setGameStatus("Network error submitting match.");
    }
  }
};

// Variable to store the refillBoard implementation
let realRefillBoardImpl: ((board: number[][], checkForChainMatches?: boolean) => void) | null = null;

// Process a chain match (automatic match after refill)
export const processChainMatch = (board: number[][], chainMatches: MatchData[], address: string | undefined) => {
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

  // Play match sound
  playMatchSound();

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

  // Post chain matches to the relayer
  postMatchesToRelayer(chainMatches, address);

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
  for (let x = 0; x < 8; x++) {
    let emptySpaces = 0;
    for (let y = 7; y >= 0; y--) {
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
        x < 7 &&
        newBoard[y][x - 1] !== 0 &&
        newBoard[y][x + 1] !== 0 &&
        newBoard[y][x - 1] === newBoard[y][x + 1]
      ) {
        invalidTypes.add(newBoard[y][x - 1]);
      }

      // Check below for vertical matches (we're filling top-down)
      if (y < 6 && newBoard[y + 1][x] !== 0 && newBoard[y + 2][x] !== 0 && newBoard[y + 1][x] === newBoard[y + 2][x]) {
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
          // FIX: Call processChainMatch with the current user's address
          // Get the address from the gameStore
          const address = useGameStore.getState().address;
          processChainMatch(newBoard, chainMatches, address);
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

// Handle candy click
export const handleCandyClick = async (x: number, y: number, address: string | undefined) => {
  const {
    gameBoard,
    selectedCandy,
    score,
    highScore,
    scoreMultiplier,
    setSelectedCandy,
    setGameStatus,
    setMatches,
    setComboCounter,
    setScoreMultiplier,
    setGameBoard,
    setScore,
    setHighScore,
    setTxCount,
    checkForMatchesInBoard,
    setAddress,
  } = useGameStore.getState();

  // Store the address in the gameStore for chain reactions
  if (address && setAddress) {
    setAddress(address);
  }

  const candyType = gameBoard[y][x];
  if (candyType === 0) return;

  if (!selectedCandy) {
    // First candy selected - reset combo counter for new move sequence
    setComboCounter(0);
    setScoreMultiplier(1);

    setSelectedCandy({ x, y });
    setGameStatus(`Selected ${CANDY_NAMES[candyType as keyof typeof CANDY_NAMES]} at (${x},${y})`);
  } else {
    // Second candy selected - check if it's adjacent (horizontally or vertically only, not diagonally)
    const isAdjacent =
      (Math.abs(selectedCandy.x - x) === 1 && selectedCandy.y === y) || // Horizontal adjacency
      (Math.abs(selectedCandy.y - y) === 1 && selectedCandy.x === x); // Vertical adjacency

    if (isAdjacent) {
      // Create a deep copy of the board for swapping
      const newBoard = gameBoard.map(row => [...row]);

      // Store original values
      const firstCandy = newBoard[selectedCandy.y][selectedCandy.x];
      const secondCandy = newBoard[y][x];

      // Swap candies
      newBoard[y][x] = firstCandy;
      newBoard[selectedCandy.y][selectedCandy.x] = secondCandy;

      // Update the game board
      setGameBoard(newBoard);
      setGameStatus(`Swapped candies! Checking for matches...`);

      // Clear the selection immediately
      setSelectedCandy(null);

      // Check for matches directly on the newBoard
      console.log("Checking for matches after swap");
      const boardMatches = checkForMatchesInBoard(newBoard);

      if (boardMatches.length > 0) {
        // Play match sound
        playMatchSound();

        // Process matches immediately using the new board
        setMatches(boardMatches);
        setComboCounter(1);

        // Clear matched candies
        const updatedBoard = newBoard.map(row => [...row]);
        boardMatches.forEach(match => {
          updatedBoard[match.y][match.x] = 0;
        });

        setGameBoard(updatedBoard);
        setGameStatus(`Found ${boardMatches.length} matches! Processing...`);

        // Calculate score with multiplier
        const basePoints = boardMatches.length * 10;
        const pointsWithMultiplier = Math.floor(basePoints * scoreMultiplier);
        const newScore = score + pointsWithMultiplier;

        // Update score
        setScore(newScore);

        // Update transaction count optimistically
        setTxCount(prev => prev + boardMatches.length);

        // Update high score if needed
        if (newScore > highScore) {
          setHighScore(newScore);
          // Save to localStorage
          if (typeof window !== "undefined") {
            const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
            localStorage.setItem(storageKey, newScore.toString());
            console.log(`Saved high score ${newScore} to localStorage with key ${storageKey}`);
          }
        }

        // Post these initial matches to the relayer
        postMatchesToRelayer(boardMatches, address);

        // Trigger refill after a delay for animations/visibility
        setTimeout(() => {
          debouncedRefill(updatedBoard, true);
        }, 600);
      } else {
        // If no match, swap back
        console.log("No matches found, swapping back");
        setGameStatus("No matches found. Swapping back.");

        // Create a fresh copy for the swap back
        const revertedBoard = newBoard.map(row => [...row]);

        // FIX: Use original values for swapping back
        revertedBoard[selectedCandy.y][selectedCandy.x] = firstCandy;
        revertedBoard[y][x] = secondCandy;

        setGameBoard(revertedBoard);

        // Reset combo
        setComboCounter(0);
        setScoreMultiplier(1);
      }
    } else {
      // Not adjacent (or diagonal), select the new candy instead
      setSelectedCandy({ x, y });
      setGameStatus(`Selected ${CANDY_NAMES[candyType as keyof typeof CANDY_NAMES]} at (${x},${y})`);
    }
  }
};

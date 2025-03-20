"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NextPage } from "next";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// Define candy types and their colors
const CANDY_TYPES = {
  0: "transparent", // Empty
  1: "#FF5252", // Red
  2: "#536DFE", // Blue
  3: "#4CAF50", // Green
  4: "#FFD740", // Yellow
  5: "#AB47BC", // Purple
};

// Define candy names
const CANDY_NAMES = {
  0: "Empty",
  1: "Red Candy",
  2: "Blue Candy",
  3: "Green Candy",
  4: "Yellow Candy",
  5: "Purple Candy",
};

const Home: NextPage = () => {
  const { address } = useAccount(); // Get the connected wallet address
  const [gameBoard, setGameBoard] = useState<number[][]>(
    Array(8)
      .fill(0)
      .map(() => Array(8).fill(0)),
  );
  const [selectedCandy, setSelectedCandy] = useState<{ x: number; y: number } | null>(null);
  const [matches, setMatches] = useState<{ x: number; y: number; type: number }[]>([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [gameStatus, setGameStatus] = useState("Ready to play!");
  const [walletConnected, setWalletConnected] = useState(false);
  const [comboCounter, setComboCounter] = useState(0);
  const [scoreMultiplier, setScoreMultiplier] = useState(1);
  const [isSyncingHighScore, setIsSyncingHighScore] = useState(false);

  // Add a ref for the match sound
  const matchSoundRef = useRef<HTMLAudioElement | null>(null);

  // Hook for writing to the contract
  const { writeContractAsync: writeCandyCrushGameAsync } = useScaffoldWriteContract({
    contractName: "CandyCrushGame",
  });

  // Check if wallet is connected
  useEffect(() => {
    setWalletConnected(!!address);
  }, [address]);

  // Read player score from contract
  const { data: playerScore } = useScaffoldReadContract({
    contractName: "CandyCrushGame",
    functionName: "getPlayerScore",
    args: address ? [address as `0x${string}`] : undefined,
    enabled: !!address,
  } as any);

  // Function to update the player's high score on the blockchain
  const updateHighScoreOnChain = useCallback(
    async (newHighScore: number) => {
      if (!address) {
        console.log("Cannot update blockchain score: No wallet connected");
        return;
      }

      if (!playerScore) {
        console.log("Cannot update blockchain score: Player score not loaded from blockchain");
        return;
      }

      try {
        // Calculate how many points we need to add to reach the high score
        const currentScoreNum = Number(playerScore);
        if (newHighScore > currentScoreNum) {
          // We need to record enough matches to bring the score up to the high score
          const scoreToAdd = newHighScore - currentScoreNum;
          const matchesToRecord = Math.ceil(scoreToAdd / 10); // Each match gives 10 points

          setIsSyncingHighScore(true);
          console.log(
            `Updating blockchain high score from ${currentScoreNum} to ${newHighScore} by recording ${matchesToRecord} matches`,
          );

          // Record a single match multiple times to update the score
          for (let i = 0; i < matchesToRecord; i++) {
            await writeCandyCrushGameAsync({
              functionName: "recordMatch",
              args: [0, 0, 1], // Use position (0,0) and candy type 1 (red)
            });
            console.log(`Recorded match ${i + 1}/${matchesToRecord}`);
          }

          console.log("Blockchain high score updated successfully!");
          setIsSyncingHighScore(false);

          // Force refetch player score from blockchain to confirm the update
          setTimeout(() => {
            console.log("Refreshing player score from blockchain...");
          }, 2000);
        } else {
          console.log(
            `Blockchain score ${currentScoreNum} is already higher than or equal to ${newHighScore}, no update needed`,
          );
        }
      } catch (error) {
        console.error("Error updating high score on blockchain:", error);
        setIsSyncingHighScore(false);
      }
    },
    [address, playerScore, writeCandyCrushGameAsync],
  );

  // Reset high score function - updated to also reset on blockchain
  const resetHighScore = useCallback(() => {
    setHighScore(0);
    if (typeof window !== "undefined") {
      const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
      console.log(`Removing high score from localStorage with key ${storageKey}`);
      localStorage.removeItem(storageKey);
    }
    // Note: We can't reset the blockchain score as the contract doesn't have this functionality
    console.log("Local high score reset. Note: Blockchain score cannot be reset as the contract doesn't support this.");
  }, [address]);

  // Load high score from localStorage on component mount
  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
      const savedHighScore = localStorage.getItem(storageKey);
      console.log(`Checking for saved high score with key ${storageKey}`);

      if (savedHighScore) {
        const score = parseInt(savedHighScore, 10);
        console.log(`Found saved high score: ${score}`);
        setHighScore(score);
      } else if (address) {
        // If wallet is connected but no high score for this wallet, reset high score
        console.log(`No saved high score found for address ${address}, resetting to 0`);
        setHighScore(0);
      }
    }
  }, [address]);

  // Read matches made from contract
  const { data: matchesMade } = useScaffoldReadContract({
    contractName: "CandyCrushGame",
    functionName: "getMatchesMade",
    args: address ? [address as `0x${string}`] : undefined,
    enabled: !!address,
  } as any);

  // Initialize game board with random candies but avoid automatic matches
  const initializeBoard = useCallback(() => {
    // Create a new board with random candies
    let newBoard = Array(8)
      .fill(0)
      .map(() =>
        Array(8)
          .fill(0)
          .map(() => Math.floor(Math.random() * 5) + 1),
      );

    // Keep regenerating candies until there are no matches
    let attemptCount = 0;
    let noMatches = false;

    while (!noMatches && attemptCount < 10) {
      // Check for existing matches
      const existingMatches = checkForMatchesInBoard(newBoard);

      if (existingMatches.length === 0) {
        noMatches = true;
      } else {
        // For each match, replace with a different random candy
        existingMatches.forEach(match => {
          let newType;
          do {
            newType = Math.floor(Math.random() * 5) + 1;
          } while (
            // Avoid creating new horizontal matches
            (match.x > 0 &&
              match.x < 7 &&
              newType === newBoard[match.y][match.x - 1] &&
              newType === newBoard[match.y][match.x + 1]) ||
            (match.x > 1 && newType === newBoard[match.y][match.x - 1] && newType === newBoard[match.y][match.x - 2]) ||
            (match.x < 6 && newType === newBoard[match.y][match.x + 1] && newType === newBoard[match.y][match.x + 2]) ||
            // Avoid creating new vertical matches
            (match.y > 0 &&
              match.y < 7 &&
              newType === newBoard[match.y - 1][match.x] &&
              newType === newBoard[match.y + 1][match.x]) ||
            (match.y > 1 && newType === newBoard[match.y - 1][match.x] && newType === newBoard[match.y - 2][match.x]) ||
            (match.y < 6 && newType === newBoard[match.y + 1][match.x] && newType === newBoard[match.y + 2][match.x])
          );

          newBoard[match.y][match.x] = newType;
        });

        attemptCount++;
      }
    }

    // If we couldn't resolve all matches after multiple attempts, just create a new random board
    if (!noMatches) {
      newBoard = createNoMatchBoard();
    }

    setScore(0);
    setGameBoard(newBoard);
    setSelectedCandy(null);
    setMatches([]);
    setGameStatus("New game started! Match 3 or more candies in a row or column.");
  }, []);

  // Helper function to create a board with no matches
  const createNoMatchBoard = () => {
    const board = Array(8)
      .fill(0)
      .map(() => Array(8).fill(0));

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Get candy types that would not create a match
        const invalidTypes = new Set<number>();

        // Check horizontal
        if (x >= 2 && board[y][x - 1] === board[y][x - 2]) {
          invalidTypes.add(board[y][x - 1]);
        }
        if (x >= 1 && x < 7 && board[y][x - 1] === board[y][x + 1]) {
          invalidTypes.add(board[y][x - 1]);
        }

        // Check vertical
        if (y >= 2 && board[y - 1][x] === board[y - 2][x]) {
          invalidTypes.add(board[y - 1][x]);
        }
        if (y >= 1 && y < 7 && board[y - 1][x] === board[y + 1][x]) {
          invalidTypes.add(board[y - 1][x]);
        }

        // Choose a valid candy type
        let validTypes = [1, 2, 3, 4, 5].filter(t => !invalidTypes.has(t));

        // If no valid types (shouldn't happen), just pick a different type than neighbors
        if (validTypes.length === 0) {
          validTypes = [1, 2, 3, 4, 5];
        }

        board[y][x] = validTypes[Math.floor(Math.random() * validTypes.length)];
      }
    }

    return board;
  };

  // Initialize the board when the component loads
  useEffect(() => {
    // Initialize the match sound
    if (typeof window !== "undefined") {
      matchSoundRef.current = new Audio("/match.mp3");
    }

    // Original initialization code
    initializeBoard();

    // Add the debug CSS for chain reactions
    if (typeof document !== "undefined") {
      const style = document.createElement("style");
      style.innerHTML = `
        .chain-reaction {
          animation: flash-bg 0.3s;
        }
        @keyframes flash-bg {
          0% { background-color: rgba(255, 0, 0, 0); }
          50% { background-color: rgba(255, 0, 0, 0.3); }
          100% { background-color: rgba(255, 0, 0, 0); }
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }
  }, [initializeBoard]);

  // Forward declaration of the refillBoard function
  let realRefillBoard: (board: number[][], checkForChainMatches?: boolean) => void;

  // Create a debounced refill function to prevent multiple refills happening at once
  const debouncedRefill = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;

      return (board: number[][], checkForChainMatches = true) => {
        // Clear any existing timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Set a new timeout
        timeoutId = setTimeout(() => {
          if (realRefillBoard) {
            realRefillBoard(board, checkForChainMatches);
          }
          timeoutId = null;
        }, 50);
      };
    })(),
    [], // Empty dependency array as realRefillBoard will be assigned later
  );

  // Helper function to check for matches in any board
  const checkForMatchesInBoard = useCallback((board: number[][]) => {
    console.log("Checking for matches in board");
    const foundMatches: { x: number; y: number; type: number }[] = [];

    // Check horizontal matches (3+ in a row)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const type = board[y][x];
        if (type !== 0 && type === board[y][x + 1] && type === board[y][x + 2]) {
          // Found at least 3 in a row
          let matchLength = 3;
          // Check if there are more than 3 in a row
          for (let i = 3; x + i < 8; i++) {
            if (board[y][x + i] === type) {
              matchLength++;
            } else {
              break;
            }
          }

          // Add all matches to the array
          for (let i = 0; i < matchLength; i++) {
            foundMatches.push({ x: x + i, y, type });
          }

          // Log the horizontal match found
          console.log(`Found horizontal match at (${x},${y}) of type ${type} with length ${matchLength}`);

          // Skip the matched candies
          x += matchLength - 1;
        }
      }
    }

    // Check vertical matches (3+ in a column)
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        const type = board[y][x];
        if (type !== 0 && type === board[y + 1][x] && type === board[y + 2][x]) {
          // Found at least 3 in a column
          let matchLength = 3;
          // Check if there are more than 3 in a column
          for (let i = 3; y + i < 8; i++) {
            if (board[y + i][x] === type) {
              matchLength++;
            } else {
              break;
            }
          }

          // Add all matches to the array
          for (let i = 0; i < matchLength; i++) {
            foundMatches.push({ x, y: y + i, type });
          }

          // Log the vertical match found
          console.log(`Found vertical match at (${x},${y}) of type ${type} with length ${matchLength}`);

          // Skip the matched candies
          y += matchLength - 1;
        }
      }
    }

    // Note: Diagonal matches are not checked or processed in this game

    // Remove duplicates to handle overlapping matches
    const uniqueMatches = foundMatches.filter(
      (match, index, self) => index === self.findIndex(m => m.x === match.x && m.y === match.y),
    );

    console.log(`Found ${uniqueMatches.length} total matches`);
    return uniqueMatches;
  }, []);

  // Check for matches in the current board
  const checkForMatches = useCallback(() => {
    return checkForMatchesInBoard(gameBoard);
  }, [gameBoard, checkForMatchesInBoard]);

  // Check if there are any valid moves left on the board
  const checkForValidMoves = useCallback(
    (board: number[][]) => {
      // Check horizontal swaps
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 7; x++) {
          // Skip empty spaces
          if (board[y][x] === 0 || board[y][x + 1] === 0) continue;

          // Try swapping
          const tempBoard = [...board.map(row => [...row])];
          const temp = tempBoard[y][x];
          tempBoard[y][x] = tempBoard[y][x + 1];
          tempBoard[y][x + 1] = temp;

          // Check if this creates a match
          if (checkForMatchesInBoard(tempBoard).length > 0) {
            return true;
          }
        }
      }

      // Check vertical swaps
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 7; y++) {
          // Skip empty spaces
          if (board[y][x] === 0 || board[y + 1][x] === 0) continue;

          // Try swapping
          const tempBoard = [...board.map(row => [...row])];
          const temp = tempBoard[y][x];
          tempBoard[y][x] = tempBoard[y + 1][x];
          tempBoard[y + 1][x] = temp;

          // Check if this creates a match
          if (checkForMatchesInBoard(tempBoard).length > 0) {
            return true;
          }
        }
      }

      // No valid moves found
      return false;
    },
    [checkForMatchesInBoard],
  );

  // Reset combo counter when restarting game
  const resetGame = useCallback(() => {
    initializeBoard();
    setComboCounter(0);
    setScoreMultiplier(1);
  }, [initializeBoard]);

  // Helper function to process transactions in batches without blocking the UI
  const processBatchTransactions = async (matches: { x: number; y: number; type: number }[], playerAddress: string) => {
    console.log(`Processing ${matches.length} matches with connected wallet ${playerAddress}`);

    // Process matches in batches to avoid overwhelming the relayer
    const batchSize = 5;
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize);

      // Process batch in parallel
      await Promise.all(
        batch.map(async match => {
          try {
            const response = await fetch("/api/relayer/candymatch", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                x: match.x,
                y: match.y,
                candyType: match.type,
                playerAddress: playerAddress, // Add player address to transaction
              }),
            });

            if (response.ok) {
              setTxCount(prev => prev + 1);
            } else {
              console.error("Error response from relayer:", await response.text());
            }
          } catch (error) {
            console.error("Error processing match:", error);
          }
        }),
      );
    }
  };

  // Refill the board with new candies without creating matches (forward declaration)
  const refillBoard = useCallback((board: number[][], checkForChainMatches = true) => {
    if (realRefillBoard) {
      realRefillBoard(board, checkForChainMatches);
    }
  }, []);

  // Function to play match sound
  const playMatchSound = useCallback(() => {
    if (matchSoundRef.current) {
      // Reset the audio to start position and play
      matchSoundRef.current.currentTime = 0;
      matchSoundRef.current.play().catch(error => {
        // Handle any browser autoplay restrictions
        console.log("Error playing sound:", error);
      });
    }
  }, []);

  // Process a chain match (automatic match after refill)
  const processChainMatch = useCallback(
    (board: number[][], chainMatches: { x: number; y: number; type: number }[]) => {
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

      // Process transactions if wallet is connected
      if (address) {
        setTimeout(() => {
          processBatchTransactions(chainMatches, address);
        }, 0);
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
    },
    [
      comboCounter,
      scoreMultiplier,
      address,
      processBatchTransactions,
      debouncedRefill,
      setGameBoard,
      setMatches,
      setScore,
      setComboCounter,
      setScoreMultiplier,
      setGameStatus,
      playMatchSound,
    ],
  );

  // Real implementation of refillBoard
  const realRefillBoardImpl = useCallback(
    (board: number[][], checkForChainMatches = true) => {
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
          if (
            y < 6 &&
            newBoard[y + 1][x] !== 0 &&
            newBoard[y + 2][x] !== 0 &&
            newBoard[y + 1][x] === newBoard[y + 2][x]
          ) {
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
              processChainMatch(boardCopy, chainMatches);
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
    },
    [score, highScore, address, checkForMatchesInBoard, processChainMatch, updateHighScoreOnChain],
  );

  // Assign the implementation to our forward declaration
  realRefillBoard = realRefillBoardImpl;

  // Process matches - forward declaration
  const processMatches = useCallback(async () => {
    return false;
  }, []);

  // Real implementation of processMatches with dependencies
  const realProcessMatches = useCallback(async () => {
    const currentMatches = checkForMatches();

    if (currentMatches.length > 0) {
      // Play match sound
      playMatchSound();

      // Start a new combo sequence when player initiates a match
      setComboCounter(1);
      setMatches(currentMatches);
      setGameStatus(`Found ${currentMatches.length} matches! Processing...`);

      // Update the board immediately
      const newBoard = gameBoard.map(row => [...row]); // Ensure deep clone
      currentMatches.forEach(match => {
        newBoard[match.y][match.x] = 0;
      });
      setGameBoard(newBoard);

      // Calculate score with multiplier
      const basePoints = currentMatches.length * 10;
      const pointsWithMultiplier = Math.floor(basePoints * scoreMultiplier);
      const newScore = score + pointsWithMultiplier;
      setScore(newScore);

      // Update high score if needed
      if (newScore > highScore) {
        setHighScore(newScore);
        // Save to localStorage
        if (typeof window !== "undefined") {
          const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
          localStorage.setItem(storageKey, newScore.toString());
          console.log(`Saved high score ${newScore} to localStorage with key ${storageKey}`);
        }

        // Update high score on blockchain if user is connected
        if (address) {
          updateHighScoreOnChain(newScore);
        }
      }

      // Process matches in the background
      if (address) {
        // Process transactions in the background without blocking the UI
        setTimeout(() => {
          processBatchTransactions(currentMatches, address);
        }, 0);
      } else {
        setGameStatus("Connect your wallet to record matches on the blockchain!");
      }

      // Log the initial match for debugging
      console.log(`Initial match: ${currentMatches.length} matches. Starting chain reaction...`);

      // Refill the board with a slight delay to allow UI to update
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log("Refilling board after initial match");
          // Use debounced refill to avoid race conditions
          debouncedRefill(newBoard, true);
        }, 600);
      });

      return true;
    }

    return false;
  }, [
    checkForMatches,
    gameBoard,
    score,
    highScore,
    address,
    scoreMultiplier,
    updateHighScoreOnChain,
    debouncedRefill,
    setMatches,
    setGameBoard,
    setScore,
    setHighScore,
    setGameStatus,
    setComboCounter,
    playMatchSound,
  ]);

  // Update the real implementation of processMatches
  Object.assign(processMatches, { current: realProcessMatches });

  // Handle candy selection
  const handleCandyClick = async (x: number, y: number) => {
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

        // Swap candies
        const temp = newBoard[y][x];
        newBoard[y][x] = newBoard[selectedCandy.y][selectedCandy.x];
        newBoard[selectedCandy.y][selectedCandy.x] = temp;

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

          // Update high score if needed
          if (newScore > highScore) {
            setHighScore(newScore);
            // Save to localStorage
            if (typeof window !== "undefined") {
              const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
              localStorage.setItem(storageKey, newScore.toString());
              console.log(`Saved high score ${newScore} to localStorage with key ${storageKey}`);
            }

            // Update high score on blockchain if user is connected
            if (address) {
              updateHighScoreOnChain(newScore);
            }
          }

          // Process transactions if wallet is connected
          if (address) {
            setTimeout(() => {
              processBatchTransactions(boardMatches, address);
            }, 0);
          }

          // Trigger refill after a delay
          setTimeout(() => {
            debouncedRefill(updatedBoard, true);
          }, 600);
        } else {
          // If no match, swap back
          console.log("No matches found, swapping back");
          setGameStatus("No matches found. Swapping back.");

          // Create a fresh copy for the swap back
          const revertedBoard = newBoard.map(row => [...row]);
          revertedBoard[y][x] = newBoard[selectedCandy.y][selectedCandy.x];
          revertedBoard[selectedCandy.y][selectedCandy.x] = temp;

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

  // Update high score if contract score is higher
  useEffect(() => {
    if (playerScore && typeof playerScore === "bigint" && address) {
      const scoreValue = Number(playerScore);
      console.log(`Checking blockchain score (${scoreValue}) against local high score (${highScore})`);

      if (scoreValue > highScore) {
        console.log(
          `Blockchain score ${scoreValue} is higher than local high score ${highScore}, updating local record`,
        );
        setHighScore(scoreValue);

        // Save to localStorage
        if (typeof window !== "undefined") {
          const storageKey = `candyCrushHighScore-${address}`;
          localStorage.setItem(storageKey, scoreValue.toString());
          console.log(`Updated local high score to match blockchain: ${scoreValue}`);
        }
      }
    }
  }, [playerScore, highScore, address]);

  return (
    <div className="flex flex-col items-center flex-grow w-full px-4 pt-10 md:px-8">
      <div className="flex flex-col items-center justify-center w-full">
        {/* Left Column - Game Board */}
        <div className="h-full shadow-xl card bg-base-100 w-[50%]">
          <div className="card-body">
            <h2 className="card-title">Crush</h2>
            <p className="mb-4 text-sm">Match 3 or more items!</p>

            <div className="mb-4 shadow stats">
              <div className="stat">
                <div className="stat-title">Your Score</div>
                <div className="text-2xl stat-value">{score || 0}</div>
              </div>

              <div className="stat">
                <div className="stat-title">High Score</div>
                <div className="text-2xl stat-value">{highScore || 0}</div>
                {isSyncingHighScore && (
                  <div className="stat-desc text-info">
                    <span className="mr-1 loading loading-spinner loading-xs"></span>
                    Syncing to blockchain...
                  </div>
                )}
                {/* {!isSyncingHighScore && address && (
                  <div className="stat-desc text-success">
                    Saved on blockchain
                    {playerScore && <span className="ml-1">({Number(playerScore)})</span>}
                  </div>
                )} */}
                {/* <div className="stat-actions">
                  <button className="btn btn-xs" onClick={resetHighScore}>
                    Reset
                  </button>
                </div> */}
              </div>

              <div className="stat">
                <div className="stat-title">Transactions</div>
                <div className="text-2xl stat-value">{txCount || 0}</div>
              </div>

              {scoreMultiplier > 1 && (
                <div className="stat">
                  <div className="stat-title text-accent">Combo Multiplier</div>
                  <div className="text-2xl stat-value text-accent">×{scoreMultiplier.toFixed(1)}</div>
                  <div className="stat-desc">{comboCounter} consecutive matches</div>
                </div>
              )}

              {!walletConnected && (
                <div className="stat">
                  <div className="stat-title">Wallet Status</div>
                  <div className="text-sm stat-value text-warning">Not Connected</div>
                  <div className="stat-desc">Connect wallet to record scores on-chain</div>
                </div>
              )}
            </div>

            <div className="relative">
              {/* <div className="mb-4 alert">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6 stroke-info shrink-0"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                <span>{gameStatus}</span>
              </div> */}

              <div className="grid grid-cols-8 gap-1 p-2 bg-gray-800 rounded-lg">
                {gameBoard.map((row, y) =>
                  row.map((candy, x) => (
                    <div
                      key={`${x}-${y}`}
                      className={`aspect-square rounded-md flex items-center justify-center cursor-pointer transition-all transform
                                ${selectedCandy && selectedCandy.x === x && selectedCandy.y === y ? "ring-4 ring-white scale-110" : ""}
                                ${matches.some(m => m.x === x && m.y === y) ? "animate-pulse" : ""}`}
                      style={{
                        backgroundColor: CANDY_TYPES[candy as keyof typeof CANDY_TYPES],
                        opacity: candy === 0 ? 0.2 : 1,
                      }}
                      onClick={() => handleCandyClick(x, y)}
                    >
                      {candy !== 0 && (
                        <div className="flex items-center justify-center w-8 h-8 text-xl font-bold text-white rounded-full shadow-inner md:w-10 md:h-10">
                          {candy}
                        </div>
                      )}
                    </div>
                  )),
                )}
              </div>
            </div>

            <div className="justify-center mt-6 card-actions">
              <button className="btn btn-primary btn-lg" onClick={resetGame}>
                Reset Game
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Instructions */}
        {/* <div className="h-full shadow-xl card bg-base-100">
          <div className="card-body">
            <h2 className="card-title">How It Works</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold">Game Rules:</h3>
                <ul className="pl-5 mt-2 space-y-2 list-disc">
                  <li>Click on a candy to select it</li>
                  <li>Click on an adjacent candy to swap them (only horizontal and vertical swaps, not diagonal)</li>
                  <li>
                    Match 3 or more identical candies in a row or column (horizontal or vertical only, not diagonal)
                  </li>
                  <li>
                    Matches <strong>only</strong> happen when you make a move - no automatic matches
                  </li>
                  <li className="text-accent">
                    <strong>Chain Reaction:</strong> When candies fall, new matches are automatically processed!
                  </li>
                  <li className="text-accent">
                    <strong>Combo Bonus:</strong> Make 5 consecutive matches to get a 1.1× score multiplier!
                  </li>
                  <li>Each match sends a blockchain transaction!</li>
                  <li className="text-success">Your high scores are permanently saved on the blockchain!</li>
                  <li>The board refills with candies that don't create automatic matches</li>
                </ul>
              </div>

              <div className="divider"></div>

              <div>
                <h3 className="text-lg font-bold">Blockchain Integration:</h3>
                <ul className="pl-5 mt-2 space-y-2 list-disc">
                  <li>Each match triggers a blockchain transaction</li>
                  <li>The relayer uses multiple private keys to process transactions in parallel</li>
                  <li>When you make a match, the request is queued on the server</li>
                  <li>Available private keys are assigned to process transactions from the queue</li>
                  <li>
                    Each transaction calls the <code>recordMatch()</code> function on the CandyCrushGame contract
                  </li>
                  <li className="text-success">
                    Your high score is permanently saved on the blockchain with your wallet address
                  </li>
                  <li>Your score and match count are stored on the blockchain</li>
                </ul>
              </div>

              <div className="divider"></div>

              <div>
                <h3 className="text-lg font-bold">Candy Types:</h3>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map(type => (
                    <div key={type} className="flex flex-col items-center">
                      <div
                        className="flex items-center justify-center w-10 h-10 text-xl font-bold text-white rounded-full"
                        style={{ backgroundColor: CANDY_TYPES[type as keyof typeof CANDY_TYPES] }}
                      >
                        {type}
                      </div>
                      <span className="mt-1 text-xs">{CANDY_NAMES[type as keyof typeof CANDY_NAMES]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 alert alert-info">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6 stroke-current shrink-0"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default Home;

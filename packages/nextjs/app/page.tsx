"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NextPage } from "next";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// Define candy types and their colors
const CANDY_TYPES = {
  0: "transparent", // Empty
  1: "#5D3FD3", // Purple for MONAD hat creature
  2: "#674ea7", // Darker purple for hedgehog creature
  3: "#8A2BE2", // Blue-violet for fly
  4: "#9370DB", // Medium purple for fox
  5: "#6b5b95", // Purple for pixel character
};

// Define candy names and images
const CANDY_NAMES = {
  0: "Empty",
  1: "Monad",
  2: "Hedgehog",
  3: "Fly",
  4: "Fox",
  5: "Pixel",
};

// Image paths for monanimal types
const CANDY_IMAGES = {
  1: "/monad.png", // MONAD hat creature
  2: "/hedgehog.png", // Purple hedgehog
  3: "/fly.png", // Purple fly
  4: "/fox.png", // Purple fox
  5: "/pixel.png", // Pixel character
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
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [pendingTxCount, setPendingTxCount] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingHashes, setIsLoadingHashes] = useState(false);

  // Add a ref for the match sound
  const matchSoundRef = useRef<HTMLAudioElement | null>(null);

  // Function to fetch transaction hashes from the backend API
  const fetchTxHashesFromApi = useCallback(async () => {
    if (!isDrawerOpen) return; // Only fetch when drawer is open

    setIsLoadingHashes(true);
    try {
      const response = await fetch("/api/relayer/candymatch"); // Use GET endpoint
      if (response.ok) {
        const data = await response.json();
        setTxHashes(data.hashes || []); // Update state with fetched hashes
        // We don't get pending count from GET, maybe update based on last POST response?
        console.log(`Fetched ${data.hashes?.length || 0} hashes from backend.`);
      } else {
        console.error("Error fetching transaction hashes:", await response.text());
        setTxHashes([]);
      }
    } catch (error) {
      console.error("Error fetching transaction hashes:", error);
      setTxHashes([]);
    } finally {
      setIsLoadingHashes(false);
    }
  }, [isDrawerOpen]); // Depend on isDrawerOpen to refetch when opened

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
            // Need to find a way to trigger refetch if using useScaffoldReadContract
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

  // Reset high score function
  const resetHighScore = useCallback(() => {
    setHighScore(0);
    if (typeof window !== "undefined") {
      const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
      console.log(`Removing high score from localStorage with key ${storageKey}`);
      localStorage.removeItem(storageKey);
    }
    console.log("Local high score reset. Note: Blockchain score cannot be reset easily.");
  }, [address]);

  // Load high score from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageKey = address ? `candyCrushHighScore-${address}` : "candyCrushHighScore";
      const savedHighScore = localStorage.getItem(storageKey);
      if (savedHighScore) {
        setHighScore(parseInt(savedHighScore, 10));
      } else if (address) {
        setHighScore(0); // Reset if new address with no saved score
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
      const existingMatches = checkForMatchesInBoard(newBoard);
      if (existingMatches.length === 0) {
        noMatches = true;
      } else {
        // Replace matched candies
        existingMatches.forEach(match => {
          let newType;
          do {
            newType = Math.floor(Math.random() * 5) + 1;
            // Add checks to prevent immediate new matches if possible
          } while (
            // Simple check: Avoid direct match with neighbors
            (match.x > 0 && newType === newBoard[match.y][match.x - 1]) ||
            (match.x < 7 && newType === newBoard[match.y][match.x + 1]) ||
            (match.y > 0 && newType === newBoard[match.y - 1][match.x]) ||
            (match.y < 7 && newType === newBoard[match.y + 1][match.x])
          );
          newBoard[match.y][match.x] = newType;
        });
        attemptCount++;
      }
    }

    if (!noMatches) {
      console.warn("Could not generate initial board without matches, creating best effort board.");
      // If still matches after attempts, use the potentially flawed board or try createNoMatchBoard
      newBoard = createNoMatchBoard();
    }

    setScore(0);
    setGameBoard(newBoard);
    setSelectedCandy(null);
    setMatches([]);
    setPendingTxCount(0); // Reset pending count
    setGameStatus("New game started! Match 3 or more candies.");
  }, []);

  // Helper function to create a board with no matches
  const createNoMatchBoard = () => {
    const board = Array(8)
      .fill(0)
      .map(() => Array(8).fill(0));

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const invalidTypes = new Set<number>();
        // Check horizontal
        if (x >= 2 && board[y][x - 1] === board[y][x - 2]) invalidTypes.add(board[y][x - 1]);
        // Check vertical
        if (y >= 2 && board[y - 1][x] === board[y - 2][x]) invalidTypes.add(board[y - 1][x]);

        let validTypes = [1, 2, 3, 4, 5].filter(t => !invalidTypes.has(t));
        if (validTypes.length === 0) validTypes = [1, 2, 3, 4, 5];
        board[y][x] = validTypes[Math.floor(Math.random() * validTypes.length)];
      }
    }
    return board;
  };

  // Initialize the board when the component loads and setup localStorage cleanup
  useEffect(() => {
    // Initialize the match sound
    if (typeof window !== "undefined") {
      matchSoundRef.current = new Audio("/match.mp3");
      // No need to fetch hashes on load anymore
    }

    // Original initialization code
    initializeBoard();

    // Add the debug CSS for chain reactions
    let styleElement: HTMLStyleElement | null = null;
    if (typeof document !== "undefined") {
      styleElement = document.createElement("style");
      styleElement.innerHTML = `
        .chain-reaction {
          animation: flash-bg 0.3s;
        }
        @keyframes flash-bg {
          0% { background-color: rgba(255, 0, 0, 0); }
          50% { background-color: rgba(255, 0, 0, 0.3); }
          100% { background-color: rgba(255, 0, 0, 0); }
        }
      `;
      document.head.appendChild(styleElement);
    }

    // Combined cleanup function for style
    return () => {
      // Remove style element
      if (styleElement && document) {
        document.head.removeChild(styleElement);
      }
    };
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

    // Check horizontal matches (3+)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        const type = board[y][x];
        if (type !== 0 && type === board[y][x + 1] && type === board[y][x + 2]) {
          let matchLength = 3;
          while (x + matchLength < 8 && board[y][x + matchLength] === type) {
            matchLength++;
          }
          for (let i = 0; i < matchLength; i++) foundMatches.push({ x: x + i, y, type });
          x += matchLength - 1;
        }
      }
    }

    // Check vertical matches (3+)
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        const type = board[y][x];
        if (type !== 0 && type === board[y + 1][x] && type === board[y + 2][x]) {
          let matchLength = 3;
          while (y + matchLength < 8 && board[y + matchLength][x] === type) {
            matchLength++;
          }
          for (let i = 0; i < matchLength; i++) foundMatches.push({ x, y: y + i, type });
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
    setIsDrawerOpen(false);
    setTxHashes([]); // Clear displayed hashes
    setPendingTxCount(0); // Reset pending count
    setTxCount(0); // Reset optimistic count
    // No need to clear localStorage hashes here anymore
  }, [initializeBoard]);

  // Helper function to POST matches to the relayer API
  const postMatchesToRelayer = useCallback(
    async (matchesToPost: { x: number; y: number; type: number }[]) => {
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
              // playerAddress: address // Backend doesn't seem to use this anymore
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
            // Handle error - maybe show a status message?
            setGameStatus("Error submitting match to relayer.");
          }
        } catch (error) {
          console.error("Error posting match to relayer:", error);
          setGameStatus("Network error submitting match.");
        }
        // Add a small delay between posts if needed to avoid rate limits?
        // await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    [address], // Dependency on address
  );

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

      // Update transaction count optimistically based on number of matches
      setTxCount(prev => prev + chainMatches.length);

      // Post chain matches to the relayer
      postMatchesToRelayer(chainMatches);

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
      postMatchesToRelayer,
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

  realRefillBoard = realRefillBoardImpl; // Assign implementation

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

            // Update high score on blockchain if user is connected
            if (address) {
              updateHighScoreOnChain(newScore);
            }
          }

          // Post these initial matches to the relayer
          postMatchesToRelayer(boardMatches);

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

  // Fetch transaction hashes when the drawer is opened
  useEffect(() => {
    if (isDrawerOpen) {
      fetchTxHashesFromApi();
    }
  }, [isDrawerOpen, fetchTxHashesFromApi]);

  return (
    <>
      {/* Main content */}
      <div className="flex flex-col items-center flex-grow w-full pt-10 md:px-8">
        <div className="flex flex-col items-center justify-center w-full">
          {/* Left Column - Game Board */}
          <div className="h-full shadow-xl card bg-base-100 w-full md:w-[50%]">
            <div className="md:card-body">
              <div className="flex items-center justify-between px-3 py-3">
                <h2 className="card-title">Monad Match</h2>
                <button
                  className="btn btn-sm btn-accent btn-outline"
                  onClick={() => {
                    setIsDrawerOpen(true);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  History
                </button>
              </div>
              <p className="px-3 mb-4 text-sm">{gameStatus}</p>

              <div className="px-3 mb-4 shadow stats">
                <div className="stat">
                  <div className="stat-title">Score</div>
                  <div className="text-base md:text-2xl stat-value">{score || 0}</div>
                </div>

                <div className="stat">
                  <div className="stat-title">High Score</div>
                  <div className="text-base md:text-2xl stat-value">{highScore || 0}</div>
                </div>

                <div className="stat">
                  <div className="stat-title">Matches Sent</div>
                  <div className="text-base md:text-2xl stat-value">{txCount || 0}</div>
                  <div className="text-xs stat-desc text-info">~{pendingTxCount} pending</div>
                </div>

                {scoreMultiplier > 1 && (
                  <div className="stat">
                    <div className="stat-title text-accent">Combo</div>
                    <div className="text-base md:text-2xl stat-value text-accent">×{scoreMultiplier.toFixed(1)}</div>
                    <div className="stat-desc">{comboCounter} chain</div>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="grid grid-cols-8 gap-1 md:gap-[6px] p-2 md:p-3 bg-gray-800 rounded-lg">
                  {gameBoard.map((row, y) =>
                    row.map((candy, x) => (
                      <div
                        key={`${x}-${y}`}
                        className={`aspect-square rounded-sm md:rounded-md flex items-center justify-center cursor-pointer transition-all transform
                                  ${selectedCandy && selectedCandy.x === x && selectedCandy.y === y ? "ring-4 ring-purple-300 scale-110" : ""}
                                  ${matches.some(m => m.x === x && m.y === y) ? "animate-pulse bg-purple-400" : ""}`}
                        style={{
                          backgroundColor: candy === 0 ? "transparent" : "#F4E7EA",
                          opacity: candy === 0 ? 0.2 : 1,
                        }}
                        onClick={() => handleCandyClick(x, y)}
                      >
                        {candy !== 0 && (
                          <div className="flex items-center justify-center w-full h-full">
                            <img
                              src={CANDY_IMAGES[candy as keyof typeof CANDY_IMAGES]}
                              alt={CANDY_NAMES[candy as keyof typeof CANDY_NAMES]}
                              className="object-contain w-full h-full p-[6px] md:p-2"
                            />
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
                <button className="ml-4 btn btn-secondary btn-sm" onClick={resetHighScore}>
                  Reset High Score (Local)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50">
          {/* Close overlay when clicking outside */}
          <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)}></div>

          {/* History Panel */}
          <div className="relative z-10 min-h-screen p-4 overflow-y-auto border-l border-purple-300 shadow-xl w-full md:w-[30%] bg-base-200 text-base-content">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-accent">Transaction History</h3>
              <button className="btn btn-sm btn-circle" onClick={() => setIsDrawerOpen(false)}>
                ✕
              </button>
            </div>
            <div className="divider"></div>

            {/* Pending Transactions Info */}
            {pendingTxCount > 0 && (
              <div className="p-3 mb-4 rounded-lg bg-info/10 text-info-content">
                <p className="text-sm font-semibold">~{pendingTxCount} transactions pending in the next batch.</p>
                <p className="text-xs">Hashes will appear below once processed by the relayer.</p>
              </div>
            )}

            {isLoadingHashes ? (
              <div className="flex flex-col items-center justify-center p-8">
                <span className="loading loading-spinner loading-lg text-accent"></span>
                <p className="mt-4 text-sm">Loading transaction history...</p>
              </div>
            ) : txHashes.length > 0 ? (
              <div className="space-y-2">
                <p className="mb-2 text-sm text-base-content/80">Recent confirmed transactions: {txHashes.length}</p>
                <div className="overflow-y-auto max-h-[70vh]">
                  {txHashes.map((hash, index) => (
                    <div key={index} className="pb-3 mb-3 border-b border-base-300">
                      <div className="mb-1 text-xs text-base-content/60">Transaction #{txHashes.length - index}</div>
                      <a
                        href={`https://monad-testnet.socialscan.io/tx/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block font-mono text-sm break-all link link-accent hover:text-clip"
                      >
                        {hash}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-12 h-12 text-base-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="mt-4">No confirmed transaction hashes found.</p>
                {pendingTxCount === 0 && (
                  <p className="mt-2 text-sm">Make some matches to see your blockchain transactions!</p>
                )}
                {pendingTxCount > 0 && <p className="mt-2 text-sm">Check back shortly for confirmed transactions.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Home;

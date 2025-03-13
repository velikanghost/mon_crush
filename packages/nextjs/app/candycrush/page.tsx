"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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

const CandyCrushGame = () => {
  const { address } = useAccount(); // Get the connected wallet address
  const [gameBoard, setGameBoard] = useState<number[][]>(
    Array(8)
      .fill(0)
      .map(() => Array(8).fill(0)),
  );
  const [selectedCandy, setSelectedCandy] = useState<{ x: number; y: number } | null>(null);
  const [matches, setMatches] = useState<{ x: number; y: number; type: number }[]>([]);
  const [score, setScore] = useState(0);
  const [txCount, setTxCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameStatus, setGameStatus] = useState("Ready to play!");
  const [walletConnected, setWalletConnected] = useState(false);

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

    setGameBoard(newBoard);
    setSelectedCandy(null);
    setMatches([]);
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
    initializeBoard();
  }, [initializeBoard]);

  // Helper function to check for matches in any board
  const checkForMatchesInBoard = useCallback((board: number[][]) => {
    const foundMatches: { x: number; y: number; type: number }[] = [];

    // Check horizontal matches
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

          // Skip the matched candies
          x += matchLength - 1;
        }
      }
    }

    // Check vertical matches
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

          // Skip the matched candies
          y += matchLength - 1;
        }
      }
    }

    // Remove duplicates
    const uniqueMatches = foundMatches.filter(
      (match, index, self) => index === self.findIndex(m => m.x === match.x && m.y === match.y),
    );

    return uniqueMatches;
  }, []);

  // Check for matches in the current board
  const checkForMatches = useCallback(() => {
    return checkForMatchesInBoard(gameBoard);
  }, [gameBoard, checkForMatchesInBoard]);

  // Refill the board with new candies without creating matches
  const refillBoard = useCallback((board: number[][]) => {
    const newBoard = [...board];

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

    setGameBoard(newBoard);

    // Don't check for matches after refilling since we should have ensured no matches
    setGameStatus("Ready for next move!");
  }, []);

  // Update the refillBoard dependencies
  Object.assign(refillBoard, {
    __dependencies: [],
  });

  // Process matches - forward declaration
  const processMatches = useCallback(async () => {
    return false;
  }, []);

  // Real implementation of processMatches with dependencies
  const realProcessMatches = useCallback(async () => {
    const currentMatches = checkForMatches();

    if (currentMatches.length > 0) {
      setMatches(currentMatches);
      setGameStatus(`Found ${currentMatches.length} matches! Processing...`);

      // Process each match as a separate transaction
      setLoading(true);

      if (!address) {
        setGameStatus("Connect your wallet to record matches on the blockchain!");
        // Still update the UI to show matches and update score locally
        const newBoard = [...gameBoard];
        currentMatches.forEach(match => {
          newBoard[match.y][match.x] = 0;
        });
        setGameBoard(newBoard);
        setScore(prev => prev + currentMatches.length * 10);

        // Wait a bit then refill the board without checking for new matches
        setTimeout(() => {
          refillBoard(newBoard);
          setLoading(false);
        }, 1000);

        return true;
      }

      // If wallet is connected, send transactions
      try {
        console.log(`Processing ${currentMatches.length} matches with connected wallet ${address}`);

        // Process matches in batches to avoid overwhelming the relayer
        const batchSize = 5;
        for (let i = 0; i < currentMatches.length; i += batchSize) {
          const batch = currentMatches.slice(i, i + batchSize);

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
      } catch (error) {
        console.error("Error in match processing:", error);
        setGameStatus("Error processing matches. Try again!");
      }

      // Update the board after matches are processed
      const newBoard = [...gameBoard];
      currentMatches.forEach(match => {
        newBoard[match.y][match.x] = 0;
      });
      setGameBoard(newBoard);

      // Update score
      setScore(prev => prev + currentMatches.length * 10);

      // Wait a bit then refill the board without checking for new matches
      setTimeout(() => {
        refillBoard(newBoard);
        setLoading(false);
      }, 1000);

      return true;
    }

    return false;
  }, [checkForMatches, gameBoard, score, address, refillBoard]);

  // Update the real implementation of processMatches
  Object.assign(processMatches, { current: realProcessMatches });

  // Handle candy selection
  const handleCandyClick = async (x: number, y: number) => {
    if (loading) return;

    const candyType = gameBoard[y][x];
    if (candyType === 0) return;

    if (!selectedCandy) {
      // First candy selected
      setSelectedCandy({ x, y });
      setGameStatus(`Selected ${CANDY_NAMES[candyType as keyof typeof CANDY_NAMES]} at (${x},${y})`);
    } else {
      // Second candy selected - check if it's adjacent
      const isAdjacent =
        (Math.abs(selectedCandy.x - x) === 1 && selectedCandy.y === y) ||
        (Math.abs(selectedCandy.y - y) === 1 && selectedCandy.x === x);

      if (isAdjacent) {
        // Swap candies
        const newBoard = [...gameBoard];
        const temp = newBoard[y][x];
        newBoard[y][x] = newBoard[selectedCandy.y][selectedCandy.x];
        newBoard[selectedCandy.y][selectedCandy.x] = temp;
        setGameBoard(newBoard);

        setGameStatus(`Swapped candies! Checking for matches...`);

        // Check for matches after swap
        setTimeout(async () => {
          const matchFound = await realProcessMatches();

          if (!matchFound) {
            // If no match, swap back
            setGameStatus("No matches found. Swapping back.");
            const revertedBoard = [...newBoard];
            revertedBoard[y][x] = newBoard[selectedCandy.y][selectedCandy.x];
            revertedBoard[selectedCandy.y][selectedCandy.x] = newBoard[y][x];
            setGameBoard(revertedBoard);
          }

          setSelectedCandy(null);
        }, 500);
      } else {
        // Not adjacent, select the new candy instead
        setSelectedCandy({ x, y });
        setGameStatus(`Selected ${CANDY_NAMES[candyType as keyof typeof CANDY_NAMES]} at (${x},${y})`);
      }
    }
  };

  return (
    <div className="flex flex-col items-center flex-grow w-full px-4 pt-10 md:px-8">
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 max-w-7xl">
        {/* Left Column - Game Board */}
        <div className="h-full shadow-xl card bg-base-100">
          <div className="card-body">
            <h2 className="card-title">Blockchain Candy Crush</h2>
            <p className="mb-4 text-sm">Match 3 or more candies to record transactions on the blockchain!</p>

            <div className="mb-4 shadow stats">
              <div className="stat">
                <div className="stat-title">Your Score</div>
                <div className="text-2xl stat-value">{playerScore?.toString() || score}</div>
              </div>

              <div className="stat">
                <div className="stat-title">Transactions</div>
                <div className="text-2xl stat-value">{matchesMade?.toString() || txCount}</div>
              </div>

              {!walletConnected && (
                <div className="stat">
                  <div className="stat-title">Wallet Status</div>
                  <div className="text-sm stat-value text-warning">Not Connected</div>
                  <div className="stat-desc">Connect wallet to record scores on-chain</div>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="mb-4 alert">
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
              </div>

              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black rounded-lg bg-opacity-30">
                  <span className="loading loading-spinner loading-lg text-primary"></span>
                </div>
              )}

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
              <button className="btn btn-primary btn-lg" onClick={initializeBoard} disabled={loading}>
                Reset Game
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Instructions */}
        <div className="h-full shadow-xl card bg-base-100">
          <div className="card-body">
            <h2 className="card-title">How It Works</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold">Game Rules:</h3>
                <ul className="pl-5 mt-2 space-y-2 list-disc">
                  <li>Click on a candy to select it</li>
                  <li>Click on an adjacent candy to swap them</li>
                  <li>Match 3 or more identical candies in a row or column</li>
                  <li>
                    Matches <strong>only</strong> happen when you make a move - no automatic matches
                  </li>
                  <li>Each match sends a blockchain transaction!</li>
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
                <div>
                  <h3 className="font-bold">Tech Stack:</h3>
                  <ul className="text-sm">
                    <li>Smart Contract: Solidity + Foundry</li>
                    <li>Frontend: Next.js, React, TailwindCSS</li>
                    <li>Relayer: Multiple private keys for parallel transactions</li>
                    <li>Scaffold-ETH 2 for Ethereum integration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandyCrushGame;

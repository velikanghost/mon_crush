import { create } from "zustand";
import { getTxHashesFromDB } from "~~/services/indexeddb/transactionDB";
import { CANDY_NAMES } from "~~/utils/helpers";

export interface MatchData {
  x: number;
  y: number;
  type: number;
}

export interface CandyPosition {
  x: number;
  y: number;
}

export interface GameState {
  // Game board and gameplay
  gameBoard: number[][];
  selectedCandy: CandyPosition | null;
  matches: MatchData[];
  score: number;
  highScore: number;
  txCount: number;
  gameStatus: string;
  comboCounter: number;
  scoreMultiplier: number;
  isSyncingHighScore: boolean;

  // User state
  address?: string;
  gameWalletPrivateKey?: string;
  gameWalletAddress?: string;
  isInitialized: boolean;

  // Transaction state
  txHashes: string[];
  isDrawerOpen: boolean;
  isLoadingHashes: boolean;

  // Actions
  setGameBoard: (board: number[][]) => void;
  setSelectedCandy: (candy: CandyPosition | null) => void;
  setMatches: (matches: MatchData[]) => void;
  setScore: (scoreOrUpdater: number | ((prev: number) => number)) => void;
  setHighScore: (score: number) => void;
  setTxCount: (countOrUpdater: number | ((prev: number) => number)) => void;
  setGameStatus: (status: string) => void;
  setComboCounter: (count: number) => void;
  setScoreMultiplier: (multiplier: number) => void;
  setIsSyncingHighScore: (isSyncing: boolean) => void;
  setTxHashes: (hashes: string[]) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
  setIsLoadingHashes: (isLoading: boolean) => void;

  // Game wallet methods
  setGameWalletPrivateKey: (privateKey: string) => void;
  setGameWalletAddress: (address: string) => void;

  // Additional required methods
  setAddress: (address: string) => void;
  updateHighScoreOnChain: (chainScore: number, callback: (newHighScore: number) => void) => void;
  initGame: () => void;

  // Game logic helpers
  createNoMatchBoard: () => number[][];
  checkForMatchesInBoard: (board: number[][]) => MatchData[];

  // Game logic actions
  initializeBoard: () => void;
  resetGame: () => void;
  handleCandyClick: (x: number, y: number) => Promise<void>;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  gameBoard: Array(8)
    .fill(0)
    .map(() => Array(8).fill(0)),
  selectedCandy: null,
  matches: [],
  score: 0,
  highScore: 0,
  txCount: 0,
  gameStatus: "Ready to play!",
  comboCounter: 0,
  scoreMultiplier: 1,
  isSyncingHighScore: false,
  address: undefined,
  gameWalletPrivateKey: undefined,
  gameWalletAddress: undefined,
  isInitialized: false,
  txHashes: [],
  isDrawerOpen: false,
  isLoadingHashes: false,

  // State setters
  setGameBoard: board => set({ gameBoard: board }),
  setSelectedCandy: candy => set({ selectedCandy: candy }),
  setMatches: matches => set({ matches }),
  setScore: scoreOrUpdater => {
    set(state => {
      const newScore = typeof scoreOrUpdater === "function" ? scoreOrUpdater(state.score) : scoreOrUpdater;

      // Update localStorage with the new score
      if (typeof window !== "undefined") {
        localStorage.setItem("monadMatchScore", newScore.toString());
      }

      // Check if this is a new high score
      if (newScore > state.highScore) {
        // Update high score in localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("monadMatchHighScore", newScore.toString());
        }

        // Return updated state with new score and high score
        return {
          score: newScore,
          highScore: newScore,
        };
      }

      // Otherwise just update the score
      return { score: newScore };
    });
  },
  setHighScore: score => {
    set({ highScore: score });

    // Save high score to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("monadMatchHighScore", score.toString());
    }
  },
  setTxCount: countOrUpdater => {
    set(state => {
      const newCount = typeof countOrUpdater === "function" ? countOrUpdater(state.txCount) : countOrUpdater;
      return { txCount: newCount };
    });

    // Save tx count to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("monadMatchTxCount", get().txCount.toString());
    }
  },
  setGameStatus: status => set({ gameStatus: status }),
  setComboCounter: count => set({ comboCounter: count }),
  setScoreMultiplier: multiplier => set({ scoreMultiplier: multiplier }),
  setIsSyncingHighScore: isSyncing => set({ isSyncingHighScore: isSyncing }),
  setTxHashes: hashes => set({ txHashes: hashes }),
  setIsDrawerOpen: isOpen => {
    set({ isDrawerOpen: isOpen });
  },
  setIsLoadingHashes: isLoading => set({ isLoadingHashes: isLoading }),

  // Game wallet methods
  setGameWalletPrivateKey: privateKey => set({ gameWalletPrivateKey: privateKey }),
  setGameWalletAddress: address => set({ gameWalletAddress: address }),

  // Additional required methods
  setAddress: address => {
    console.log(`Setting address: ${address}`);
    set({ address });
  },

  updateHighScoreOnChain: (chainScore, callback) => {
    const { highScore } = get();
    console.log(`Comparing chain score ${chainScore} with local high score ${highScore}`);

    if (highScore > chainScore) {
      console.log(`Local high score ${highScore} is higher than chain score ${chainScore}`);
      // If local score is higher, update the chain via callback
      callback(highScore);
    } else if (chainScore > highScore) {
      // If chain score is higher, update our local high score
      console.log(`Updating local high score to match chain: ${chainScore}`);
      set({ highScore: chainScore });
    }
  },

  initGame: () => {
    const { initializeBoard } = get();
    console.log("Initializing game...");

    // Load high score from localStorage if available
    if (typeof window !== "undefined") {
      const savedHighScore = localStorage.getItem("monadMatchHighScore");
      if (savedHighScore) {
        set({ highScore: parseInt(savedHighScore, 10) });
      }

      // Load score and txCount from localStorage if available
      const savedScore = localStorage.getItem("monadMatchScore");
      if (savedScore) {
        set({ score: parseInt(savedScore, 10) });
      }

      const savedTxCount = localStorage.getItem("monadMatchTxCount");
      if (savedTxCount) {
        set({ txCount: parseInt(savedTxCount, 10) });
      }

      // Load transaction hashes from IndexedDB
      set({ isLoadingHashes: true });
      getTxHashesFromDB()
        .then(hashes => {
          if (hashes && hashes.length > 0) {
            set({ txHashes: hashes });
            console.log(`Loaded ${hashes.length} transaction hashes from IndexedDB`);
          }
        })
        .catch(error => {
          console.error("Failed to load transaction hashes from IndexedDB:", error);
        })
        .finally(() => {
          set({ isLoadingHashes: false });
        });
    }

    // Initialize the game board
    initializeBoard();
  },

  // Initialize or reset the game board
  initializeBoard: () => {
    const newBoard = get().createNoMatchBoard();
    set({
      gameBoard: newBoard,
      selectedCandy: null,
      matches: [],
      comboCounter: 0,
      scoreMultiplier: 1,
      isInitialized: true,
    });
  },

  // Reset the game
  resetGame: () => {
    set({
      score: 0,
      txCount: 0,
      comboCounter: 0,
      scoreMultiplier: 1,
      gameStatus: "Game reset! Ready to play!",
    });

    // Update localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("monadMatchScore", "0");
      localStorage.setItem("monadMatchTxCount", "0");
    }

    // Re-initialize the board
    get().initializeBoard();
  },

  // Create no-match board (to prevent matches on initialization)
  createNoMatchBoard: () => {
    const board = Array(8)
      .fill(0)
      .map(() => Array(8).fill(0));

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        // Determine what candy types would create matches
        const invalidTypes = new Set<number>();

        // Check horizontal matches (left side)
        if (x >= 2 && board[y][x - 1] === board[y][x - 2]) {
          invalidTypes.add(board[y][x - 1]);
        }

        // Check vertical matches (top side)
        if (y >= 2 && board[y - 1][x] === board[y - 2][x]) {
          invalidTypes.add(board[y - 1][x]);
        }

        // Choose a valid candy type
        let validTypes = [1, 2, 3, 4, 5].filter(t => !invalidTypes.has(t));

        // If no valid types (shouldn't happen), use any type
        if (validTypes.length === 0) {
          validTypes = [1, 2, 3, 4, 5];
        }

        // Set a random valid candy type
        board[y][x] = validTypes[Math.floor(Math.random() * validTypes.length)];
      }
    }
    return board;
  },

  // Check for matches in board
  checkForMatchesInBoard: initialBoard => {
    const matches: MatchData[] = [];
    // Copy the board to avoid mutations
    const board = initialBoard.map(row => [...row]);

    // Check horizontal matches
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 6; x++) {
        if (board[y][x] !== 0 && board[y][x] === board[y][x + 1] && board[y][x] === board[y][x + 2]) {
          // Found a horizontal match - determine its full length
          let matchLen = 3;
          let startX = x;
          while (startX > 0 && board[y][startX - 1] === board[y][x]) {
            startX--;
            matchLen++;
          }
          while (x + matchLen < 8 && board[y][x + matchLen] === board[y][x]) {
            matchLen++;
          }

          // Add all candies in this match
          for (let i = 0; i < matchLen; i++) {
            const matchX = startX + i;
            // Check if this position is already part of a match
            if (!matches.some(m => m.x === matchX && m.y === y)) {
              matches.push({ x: matchX, y, type: board[y][x] });
            }
          }

          // Skip the rest of this match
          x = startX + matchLen - 1;
        }
      }
    }

    // Check vertical matches
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 6; y++) {
        if (board[y][x] !== 0 && board[y][x] === board[y + 1][x] && board[y][x] === board[y + 2][x]) {
          // Found a vertical match - determine its full length
          let matchLen = 3;
          let startY = y;
          while (startY > 0 && board[startY - 1][x] === board[y][x]) {
            startY--;
            matchLen++;
          }
          while (y + matchLen < 8 && board[y + matchLen][x] === board[y][x]) {
            matchLen++;
          }

          // Add all candies in this match
          for (let i = 0; i < matchLen; i++) {
            const matchY = startY + i;
            // Check if this position is already part of a match
            if (!matches.some(m => m.x === x && m.y === matchY)) {
              matches.push({ x, y: matchY, type: board[y][x] });
            }
          }

          // Skip the rest of this match
          y = startY + matchLen - 1;
        }
      }
    }

    return matches;
  },

  // Handle candy click - implemented in gameLogic.ts
  handleCandyClick: async () => {
    console.warn("handleCandyClick not implemented yet");
    return Promise.resolve();
  },
}));

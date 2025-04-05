import { create } from "zustand";
import {
  addTxHashToDB,
  addVerificationIdToDB,
  clearTxHashesFromDB,
  clearVerificationIdsFromDB,
  getGameStatsFromDB,
  getPendingTxCountFromDB,
  getTxHashesFromDB,
  getVerificationIdsFromDB,
  initIndexedDB,
  resetGameStatsInDB,
  saveGameStatsToDB,
  updatePendingTxCountInDB,
} from "~~/services/indexeddb/transactionDB";
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
  isInitialized: boolean;

  // Transaction state
  txHashes: string[];
  verificationIds: string[];
  pendingTxCount: number;
  isDrawerOpen: boolean;
  isLoadingHashes: boolean;

  // Actions
  setGameBoard: (board: number[][]) => void;
  setSelectedCandy: (candy: CandyPosition | null) => void;
  setMatches: (matches: MatchData[]) => void;
  setScore: (scoreOrUpdater: number | ((prev: number) => number)) => void;
  setHighScore: (score: number) => void;
  setTxCount: (countOrUpdater: number | ((prev: number) => number)) => void;
  setPendingTxCount: (count: number) => void;
  setGameStatus: (status: string) => void;
  setComboCounter: (count: number) => void;
  setScoreMultiplier: (multiplier: number) => void;
  setIsSyncingHighScore: (isSyncing: boolean) => void;
  setTxHashes: (hashes: string[]) => void;
  setVerificationIds: (ids: string[]) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
  setIsLoadingHashes: (isLoading: boolean) => void;

  // Additional required methods
  setAddress: (address: string) => void;
  updateHighScoreOnChain: (chainScore: number, callback: (newHighScore: number) => void) => void;
  initGame: () => void;

  // API interaction
  fetchTxHashesFromApi: () => Promise<void>;
  addTxHash: (hash: string) => Promise<void>;
  addVerificationId: (id: string) => Promise<void>;

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
  isInitialized: false,
  txHashes: [],
  verificationIds: [],
  pendingTxCount: 0,
  isDrawerOpen: false,
  isLoadingHashes: false,

  // State setters
  setGameBoard: board => set({ gameBoard: board }),
  setSelectedCandy: candy => set({ selectedCandy: candy }),
  setMatches: matches => set({ matches }),
  setScore: scoreOrUpdater => {
    set(state => {
      const newScore = typeof scoreOrUpdater === "function" ? scoreOrUpdater(state.score) : scoreOrUpdater;

      // Save the new score to IndexedDB
      saveGameStatsToDB({ score: newScore, txCount: state.txCount }).catch(error =>
        console.error("Failed to save score to IndexedDB:", error),
      );

      return { score: newScore };
    });
  },
  setHighScore: score => {
    set({ highScore: score });

    // Save high score to localStorage for backward compatibility
    if (typeof window !== "undefined") {
      localStorage.setItem("candyCrushHighScore", score.toString());
    }
  },
  setTxCount: countOrUpdater => {
    set(state => {
      const newCount = typeof countOrUpdater === "function" ? countOrUpdater(state.txCount) : countOrUpdater;

      // Save the new count to IndexedDB
      saveGameStatsToDB({ score: state.score, txCount: newCount }).catch(error =>
        console.error("Failed to save txCount to IndexedDB:", error),
      );

      return { txCount: newCount };
    });
  },
  setPendingTxCount: count => {
    set({ pendingTxCount: count });
    // Also update in IndexedDB
    updatePendingTxCountInDB(count);
  },
  setGameStatus: status => set({ gameStatus: status }),
  setComboCounter: count => set({ comboCounter: count }),
  setScoreMultiplier: multiplier => set({ scoreMultiplier: multiplier }),
  setIsSyncingHighScore: isSyncing => set({ isSyncingHighScore: isSyncing }),
  setTxHashes: hashes => set({ txHashes: hashes }),
  setVerificationIds: ids => set({ verificationIds: ids }),
  setIsDrawerOpen: isOpen => {
    set({ isDrawerOpen: isOpen });
    // If opening drawer, fetch transaction hashes from IndexedDB
    if (isOpen) {
      get().fetchTxHashesFromApi();
    }
  },
  setIsLoadingHashes: isLoading => set({ isLoadingHashes: isLoading }),

  // Additional required methods
  setAddress: address => {
    console.log(`Setting address: ${address}`);
    set({ address });
    // Initialize IndexedDB when address is set
    initIndexedDB().catch(error => console.error("Failed to initialize IndexedDB:", error));
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

    // Initialize IndexedDB
    initIndexedDB().catch(error => console.error("Failed to initialize IndexedDB:", error));

    // Load high score from localStorage if available
    if (typeof window !== "undefined") {
      const savedHighScore = localStorage.getItem("candyCrushHighScore");
      if (savedHighScore) {
        set({ highScore: parseInt(savedHighScore, 10) });
      }
    }

    // Load game stats (score, txCount) from IndexedDB
    getGameStatsFromDB()
      .then(stats => {
        console.log("Loaded game stats from IndexedDB:", stats);
        set({
          score: stats.score,
          txCount: stats.txCount,
        });
        // Initialize the game board after loading stats
        initializeBoard();
      })
      .catch(error => {
        console.error("Failed to load game stats from IndexedDB:", error);
        // Initialize the game board even if loading stats fails
        initializeBoard();
      });

    // Load pending tx count from IndexedDB if available
    getPendingTxCountFromDB()
      .then(count => {
        set({ pendingTxCount: count });
      })
      .catch(error => {
        console.error("Failed to load pending transaction count from IndexedDB:", error);
      });
  },

  // API interaction - Now uses IndexedDB instead of API
  fetchTxHashesFromApi: async () => {
    const state = get();
    if (!state.isDrawerOpen) return; // Only fetch when drawer is open

    set({ isLoadingHashes: true });
    try {
      // Get transaction hashes from IndexedDB instead of API
      const hashes = await getTxHashesFromDB();
      set({ txHashes: hashes });
      console.log(`Loaded ${hashes.length} transaction hashes from IndexedDB`);

      // Get pending verification IDs from IndexedDB
      const verificationIds = await getVerificationIdsFromDB();
      set({ verificationIds });
      console.log(`Loaded ${verificationIds.length} verification IDs from IndexedDB`);

      // Get pending transaction count from IndexedDB
      const pendingCount = await getPendingTxCountFromDB();
      set({ pendingTxCount: pendingCount });
    } catch (error) {
      console.error("Error fetching data from IndexedDB:", error);
      set({ txHashes: [], verificationIds: [] });
    } finally {
      set({ isLoadingHashes: false });
    }
  },

  // Add a transaction hash to the store and IndexedDB
  addTxHash: async (hash: string) => {
    // Add to IndexedDB
    await addTxHashToDB(hash);

    // Update state with new hash at the beginning of the array
    const { txHashes } = get();
    set({ txHashes: [hash, ...txHashes] });

    // Reduce pending count
    set(state => {
      const newCount = Math.max(0, state.pendingTxCount - 1);
      updatePendingTxCountInDB(newCount);
      return { pendingTxCount: newCount };
    });
  },

  // Add a verification ID to the store and IndexedDB
  addVerificationId: async (id: string) => {
    // Add to IndexedDB
    await addVerificationIdToDB(id);

    // Update state with new ID at the beginning of the array
    const { verificationIds } = get();
    set({ verificationIds: [id, ...verificationIds] });
  },

  // Helper function to create a board with no matches
  createNoMatchBoard: () => {
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
  },

  // Helper function to check for matches
  checkForMatchesInBoard: (board: number[][]) => {
    console.log("Checking for matches in board");
    const foundMatches: MatchData[] = [];

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

    // Remove duplicates to handle overlapping matches
    const uniqueMatches = foundMatches.filter(
      (match, index, self) => index === self.findIndex(m => m.x === match.x && m.y === match.y),
    );

    console.log(`Found ${uniqueMatches.length} total matches`);
    return uniqueMatches;
  },

  // Initialize game board - but don't reset the score
  initializeBoard: () => {
    const {
      checkForMatchesInBoard,
      createNoMatchBoard,
      setGameBoard,
      setSelectedCandy,
      setMatches,
      setPendingTxCount,
      setGameStatus,
    } = get();

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
        existingMatches.forEach((match: MatchData) => {
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

    // Note: We're not resetting the score here anymore
    setGameBoard(newBoard);
    setSelectedCandy(null);
    setMatches([]);
    setPendingTxCount(0); // Reset pending count
    setGameStatus("New game started! Match 3 or more candies.");
  },

  // Reset game
  resetGame: () => {
    const {
      initializeBoard,
      setComboCounter,
      setScoreMultiplier,
      setIsDrawerOpen,
      setTxHashes,
      setPendingTxCount,
      setTxCount,
      setScore,
      setVerificationIds,
    } = get();

    // Reset score and txCount
    setScore(0);
    setTxCount(0);

    // Reset game state
    setComboCounter(0);
    setScoreMultiplier(1);
    setIsDrawerOpen(false);
    setTxHashes([]); // Clear displayed hashes
    setVerificationIds([]); // Clear verification IDs
    setPendingTxCount(0); // Reset pending count

    // Initialize a new game board
    initializeBoard();

    // Reset game stats in IndexedDB
    resetGameStatsInDB().catch(error => console.error("Failed to reset game stats in IndexedDB:", error));

    // Clear transaction hashes from IndexedDB
    clearTxHashesFromDB().catch(error => console.error("Failed to clear transaction hashes from IndexedDB:", error));

    // Clear verification IDs from IndexedDB
    clearVerificationIdsFromDB().catch(error =>
      console.error("Failed to clear verification IDs from IndexedDB:", error),
    );

    // Note: We do NOT reset the high score as specified by the requirements
  },

  // Handle candy click - This should be filled in with the handleCandyClick implementation
  // For now we'll just provide a placeholder that will be implemented in a separate file
  handleCandyClick: async (x, y) => {
    // This will be implemented when we refactor page.tsx
    console.log(`Clicked candy at ${x}, ${y}`);
    // The actual implementation will be added in page.tsx
  },
}));

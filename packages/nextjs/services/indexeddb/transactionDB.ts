/**
 * TransactionDB: A service for managing transaction hashes using IndexedDB
 * This provides a more persistent storage solution than relying on backend memory
 */

// Define the database structure
interface TransactionDB {
  db: IDBDatabase | null;
  isInitialized: boolean;
}

// Game stats interface
interface GameStats {
  score: number;
  txCount: number;
}

// Global IndexedDB instance
const txDB: TransactionDB = {
  db: null,
  isInitialized: false,
};

// Database name and version
const DB_NAME = "MonadMatchTransactions";
const DB_VERSION = 3;

/**
 * Initialize the IndexedDB database
 * @returns Promise resolving to the IDBDatabase instance
 */
export const initIndexedDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (txDB.isInitialized && txDB.db) {
      resolve(txDB.db);
      return;
    }

    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available in this environment"));
      return;
    }

    // Try to delete the database if it exists with errors to force a clean upgrade
    const deleteRequest = window.indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      console.log("Old database deleted successfully, creating new one");
      openDatabase();
    };

    deleteRequest.onerror = () => {
      console.log("Could not delete database, opening as is");
      openDatabase();
    };

    deleteRequest.onblocked = () => {
      console.log("Database deletion was blocked, opening as is");
      openDatabase();
    };

    function openDatabase() {
      // Open the database (creates it if it doesn't exist)
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = event => {
        console.error("IndexedDB error:", event);
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = event => {
        txDB.db = (event.target as IDBOpenDBRequest).result;
        txDB.isInitialized = true;
        console.log("IndexedDB initialized successfully with version", txDB.db.version);
        resolve(txDB.db);
      };

      request.onupgradeneeded = event => {
        console.log(`Database upgrade needed from ${event.oldVersion} to ${event.newVersion}`);
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores based on version upgrade path
        // Create object store for transaction hashes
        if (!db.objectStoreNames.contains("txHashes")) {
          const txStore = db.createObjectStore("txHashes", { keyPath: "id", autoIncrement: true });
          txStore.createIndex("hash", "hash", { unique: true });
          txStore.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Created txHashes object store");
        }

        // Create object store for verification IDs (pending transaction requests)
        if (!db.objectStoreNames.contains("verificationIds")) {
          const verificationStore = db.createObjectStore("verificationIds", { keyPath: "id", autoIncrement: true });
          verificationStore.createIndex("verificationId", "verificationId", { unique: true });
          verificationStore.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Created verificationIds object store");
        }

        // Create object store for pending transaction count
        if (!db.objectStoreNames.contains("pendingTxCount")) {
          const pendingStore = db.createObjectStore("pendingTxCount", { keyPath: "id" });
          console.log("Created pendingTxCount object store");
        }

        // Create object store for game stats
        if (!db.objectStoreNames.contains("gameStats")) {
          const gameStatsStore = db.createObjectStore("gameStats", { keyPath: "id" });
          console.log("Created gameStats object store");
        }
      };
    }
  });
};

/**
 * Add a transaction hash to IndexedDB
 * @param hash The transaction hash to store
 * @returns Promise that resolves when the hash is stored
 */
export const addTxHashToDB = async (hash: string): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("txHashes", "readwrite");
      const store = transaction.objectStore("txHashes");

      const txRecord = {
        hash,
        timestamp: Date.now(),
      };

      const request = store.add(txRecord);

      request.onsuccess = () => {
        console.log("Transaction hash added to IndexedDB");
        resolve();
      };

      request.onerror = event => {
        console.error("Error adding transaction hash to IndexedDB:", event);
        reject(new Error("Failed to add transaction hash to IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to add transaction hash to IndexedDB:", error);
    throw error;
  }
};

/**
 * Get all transaction hashes from IndexedDB
 * @returns Promise resolving to an array of transaction hashes
 */
export const getTxHashesFromDB = async (): Promise<string[]> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("txHashes", "readonly");
      const store = transaction.objectStore("txHashes");
      const index = store.index("timestamp");

      // Get all records sorted by timestamp (newest first)
      const request = index.openCursor(null, "prev");
      const hashes: string[] = [];

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          hashes.push(cursor.value.hash);
          cursor.continue();
        } else {
          resolve(hashes);
        }
      };

      request.onerror = event => {
        console.error("Error getting transaction hashes from IndexedDB:", event);
        reject(new Error("Failed to get transaction hashes from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to get transaction hashes from IndexedDB:", error);
    return [];
  }
};

/**
 * Clear all transaction hashes from IndexedDB
 * @returns Promise that resolves when all hashes are cleared
 */
export const clearTxHashesFromDB = async (): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("txHashes", "readwrite");
      const store = transaction.objectStore("txHashes");

      const request = store.clear();

      request.onsuccess = () => {
        console.log("All transaction hashes cleared from IndexedDB");
        resolve();
      };

      request.onerror = event => {
        console.error("Error clearing transaction hashes from IndexedDB:", event);
        reject(new Error("Failed to clear transaction hashes from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to clear transaction hashes from IndexedDB:", error);
    throw error;
  }
};

/**
 * Update pending transaction count in IndexedDB
 * @param count The new pending transaction count
 * @returns Promise that resolves when the count is updated
 */
export const updatePendingTxCountInDB = async (count: number): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pendingTxCount", "readwrite");
      const store = transaction.objectStore("pendingTxCount");

      const request = store.put({ id: 1, count });

      request.onsuccess = () => {
        console.log(`Updated pending transaction count to ${count} in IndexedDB`);
        resolve();
      };

      request.onerror = event => {
        console.error("Error updating pending transaction count in IndexedDB:", event);
        reject(new Error("Failed to update pending transaction count in IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to update pending transaction count in IndexedDB:", error);
    throw error;
  }
};

/**
 * Get pending transaction count from IndexedDB
 * @returns Promise resolving to the pending transaction count
 */
export const getPendingTxCountFromDB = async (): Promise<number> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pendingTxCount", "readonly");
      const store = transaction.objectStore("pendingTxCount");

      const request = store.get(1);

      request.onsuccess = event => {
        const result = (event.target as IDBRequest).result;
        resolve(result?.count || 0);
      };

      request.onerror = event => {
        console.error("Error getting pending transaction count from IndexedDB:", event);
        reject(new Error("Failed to get pending transaction count from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to get pending transaction count from IndexedDB:", error);
    return 0;
  }
};

/**
 * Save game stats to IndexedDB
 * @param stats The game stats to save
 * @returns Promise that resolves when the stats are saved
 */
export const saveGameStatsToDB = async (stats: GameStats): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("gameStats", "readwrite");
      const store = transaction.objectStore("gameStats");

      const request = store.put({
        id: 1,
        ...stats,
        lastUpdated: Date.now(),
      });

      request.onsuccess = () => {
        console.log("Game stats saved to IndexedDB:", stats);
        resolve();
      };

      request.onerror = event => {
        console.error("Error saving game stats to IndexedDB:", event);
        reject(new Error("Failed to save game stats to IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to save game stats to IndexedDB:", error);
    throw error;
  }
};

/**
 * Get game stats from IndexedDB
 * @returns Promise resolving to the game stats
 */
export const getGameStatsFromDB = async (): Promise<GameStats> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("gameStats", "readonly");
      const store = transaction.objectStore("gameStats");

      const request = store.get(1);

      request.onsuccess = event => {
        const result = (event.target as IDBRequest).result;
        if (result) {
          const { score, txCount } = result;
          resolve({ score, txCount });
        } else {
          resolve({ score: 0, txCount: 0 });
        }
      };

      request.onerror = event => {
        console.error("Error getting game stats from IndexedDB:", event);
        reject(new Error("Failed to get game stats from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to get game stats from IndexedDB:", error);
    return { score: 0, txCount: 0 };
  }
};

/**
 * Reset game stats in IndexedDB (except high score)
 * @returns Promise that resolves when the stats are reset
 */
export const resetGameStatsInDB = async (): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("gameStats", "readwrite");
      const store = transaction.objectStore("gameStats");

      // Only reset score and txCount, preserve other stats
      const request = store.put({
        id: 1,
        score: 0,
        txCount: 0,
        lastUpdated: Date.now(),
      });

      request.onsuccess = () => {
        console.log("Game stats reset in IndexedDB");
        resolve();
      };

      request.onerror = event => {
        console.error("Error resetting game stats in IndexedDB:", event);
        reject(new Error("Failed to reset game stats in IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to reset game stats in IndexedDB:", error);
    throw error;
  }
};

/**
 * Add a verification ID to IndexedDB
 * @param verificationId The verification ID to store
 * @returns Promise that resolves when the ID is stored
 */
export const addVerificationIdToDB = async (verificationId: string): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("verificationIds", "readwrite");
      const store = transaction.objectStore("verificationIds");

      const verificationRecord = {
        verificationId,
        timestamp: Date.now(),
        processed: false,
      };

      const request = store.add(verificationRecord);

      request.onsuccess = () => {
        console.log("Verification ID added to IndexedDB");
        resolve();
      };

      request.onerror = event => {
        console.error("Error adding verification ID to IndexedDB:", event);
        reject(new Error("Failed to add verification ID to IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to add verification ID to IndexedDB:", error);
    throw error;
  }
};

/**
 * Get all verification IDs from IndexedDB
 * @returns Promise resolving to an array of verification IDs
 */
export const getVerificationIdsFromDB = async (): Promise<string[]> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("verificationIds", "readonly");
      const store = transaction.objectStore("verificationIds");
      const index = store.index("timestamp");

      // Get all records sorted by timestamp (newest first)
      const request = index.openCursor(null, "prev");
      const ids: string[] = [];

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          ids.push(cursor.value.verificationId);
          cursor.continue();
        } else {
          resolve(ids);
        }
      };

      request.onerror = event => {
        console.error("Error getting verification IDs from IndexedDB:", event);
        reject(new Error("Failed to get verification IDs from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to get verification IDs from IndexedDB:", error);
    return [];
  }
};

/**
 * Clear all verification IDs from IndexedDB
 * @returns Promise that resolves when all IDs are cleared
 */
export const clearVerificationIdsFromDB = async (): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("verificationIds", "readwrite");
      const store = transaction.objectStore("verificationIds");

      const request = store.clear();

      request.onsuccess = () => {
        console.log("All verification IDs cleared from IndexedDB");
        resolve();
      };

      request.onerror = event => {
        console.error("Error clearing verification IDs from IndexedDB:", event);
        reject(new Error("Failed to clear verification IDs from IndexedDB"));
      };
    });
  } catch (error) {
    console.error("Failed to clear verification IDs from IndexedDB:", error);
    throw error;
  }
};

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployedContracts from "~~/contracts/deployedContracts";
import { monadTestnet } from "~~/scaffold.config";
import { CONTRACT_ABI } from "~~/utils/scaffold-eth/abi";

// Get the contract address from deployedContracts (assuming MonadMatch is the contract name now)
const CONTRACT_ADDRESS = deployedContracts[10143].MonadMatch.address;

// Create transport
const transport = http(process.env.NEXT_PUBLIC_MONAD_RPC_URL);

// Batch processing configuration
const BATCH_SIZE = 15; // Exact size of a batch to process
const BATCH_TIMEOUT = 60000; // Process batch after 1 minute (60000ms) if fewer than BATCH_SIZE items

// Queue for match transactions
interface MatchQueueItem {
  x: number;
  y: number;
  type: number;
  onSuccess?: (hash: string) => void;
  onError?: (error: any) => void;
}

// Batch processing queue state
const txQueue: MatchQueueItem[] = [];
let batchTimeoutId: NodeJS.Timeout | null = null;
let isProcessingBatch = false;

/**
 * Send a transaction using the game wallet to record a match on-chain
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 * @param x The x coordinate of the match
 * @param y The y coordinate of the match
 * @param candyType The type of candy matched
 * @returns The transaction hash if successful
 */
export const sendMatchTransaction = async (
  gameWalletPrivateKey: string,
  x: number,
  y: number,
  candyType: number,
): Promise<string> => {
  if (!gameWalletPrivateKey) {
    throw new Error("Game wallet private key is required");
  }

  try {
    // Convert private key to proper format
    const formattedPrivateKey = gameWalletPrivateKey.startsWith("0x")
      ? (gameWalletPrivateKey as `0x${string}`)
      : (`0x${gameWalletPrivateKey}` as `0x${string}`);

    // Create account and wallet client
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });

    // console.log(`Sending transaction from game wallet: ${account.address}`);
    // console.log(`Recording match at position (${x},${y}) with candy type ${candyType}`);

    // Send the transaction
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "recordMatch",
      args: [x, y, candyType],
      chain: monadTestnet,
    });

    //console.log("Transaction sent successfully:", hash);
    return hash;
  } catch (error) {
    console.error("Error sending match transaction:", error);
    throw new Error(`Failed to send match transaction: ${error}`);
  }
};

/**
 * Add a match to the processing queue and return a promise that resolves when it's processed
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 * @param match The match data (x, y, type)
 * @returns Promise that resolves to the transaction hash
 */
export const queueMatchTransaction = (
  gameWalletPrivateKey: string,
  match: { x: number; y: number; type: number },
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Add the match to the queue with callbacks
    txQueue.push({
      ...match,
      onSuccess: hash => resolve(hash),
      onError: error => reject(error),
    });

    console.log(`Added match at (${match.x},${match.y}) to queue. Queue size: ${txQueue.length}`);

    // Start the timeout if this is the first item in the queue
    if (txQueue.length === 1 && !batchTimeoutId) {
      console.log(`Starting batch timeout of 1 minute for batch with < ${BATCH_SIZE} items`);
      batchTimeoutId = setTimeout(() => processBatch(gameWalletPrivateKey), BATCH_TIMEOUT);
    }

    // Process immediately if we've reached exactly BATCH_SIZE items
    if (txQueue.length === BATCH_SIZE && !isProcessingBatch) {
      console.log(`Queue reached exactly ${BATCH_SIZE} items. Processing batch now.`);
      // Clear any existing timeout
      if (batchTimeoutId) {
        clearTimeout(batchTimeoutId);
        batchTimeoutId = null;
      }
      processBatch(gameWalletPrivateKey);
    }
  });
};

/**
 * Process the current batch of matches
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 */
const processBatch = async (gameWalletPrivateKey: string) => {
  if (isProcessingBatch || txQueue.length === 0) return;

  isProcessingBatch = true;

  // Process either when we have BATCH_SIZE items or when timeout occurred with fewer items
  const isFullBatch = txQueue.length >= BATCH_SIZE;
  console.log(
    `Processing batch of ${txQueue.length} transactions (${isFullBatch ? "full batch" : "timeout triggered"})`,
  );

  // Clear any existing timeout
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }

  try {
    // Convert private key to proper format
    const formattedPrivateKey = gameWalletPrivateKey.startsWith("0x")
      ? (gameWalletPrivateKey as `0x${string}`)
      : (`0x${gameWalletPrivateKey}` as `0x${string}`);

    // Validate private key format right before use
    if (!/^0x[0-9a-fA-F]{64}$/.test(formattedPrivateKey)) {
      throw new Error("Invalid private key format inside processBatch");
    }

    // Create account and wallet client
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });

    // Create public client for nonce management
    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport,
    });

    console.log(`Sending ${txQueue.length} transactions from game wallet: ${account.address}`);

    // Process current queue items
    const currentBatch = [...txQueue]; // Copy the current queue
    txQueue.length = 0; // Clear the queue for new items

    // Get the starting nonce only once at the beginning
    let currentNonce = BigInt(
      await publicClient.getTransactionCount({
        address: account.address,
      }),
    );

    console.log(`Starting with nonce: ${currentNonce}`);

    // // Set gas parameters for all transactions for consistent priority
    // const gasParams = {
    //   maxFeePerGas: 80000000000n, // 80 gwei
    //   maxPriorityFeePerGas: 20000000000n, // 20 gwei
    //   gasLimit: 150000n, // 150k gas limit
    // };

    // Process transactions sequentially with explicit nonce management
    for (const item of currentBatch) {
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          console.log(`Sending transaction for match at (${item.x},${item.y}) with nonce ${currentNonce}`);

          const hash = await walletClient.writeContract({
            account,
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "recordMatch",
            args: [item.x, item.y, item.type],
            chain: monadTestnet,
            nonce: Number(currentNonce),
          });

          console.log(`Transaction for match at (${item.x},${item.y}) sent: ${hash}`);

          // Increment nonce for next transaction
          currentNonce = currentNonce + 1n;

          // Call the success callback
          if (item.onSuccess) {
            item.onSuccess(hash);
          }

          success = true;

          // Small delay between transactions to allow network to catch up
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          retryCount++;

          // If error is "nonce too low", increment nonce and retry immediately
          if (error.message && error.message.includes("nonce too low")) {
            console.log(`Nonce too low error for (${item.x},${item.y}). Incrementing nonce.`);
            currentNonce = currentNonce + 1n;
            continue;
          }

          // If it's the last retry or other error, report failure
          if (retryCount >= maxRetries) {
            console.error(`Failed to process match at (${item.x},${item.y}) after ${maxRetries} retries:`, error);

            // Call the error callback
            if (item.onError) {
              item.onError(error);
            }
          } else {
            // Wait longer between retries
            const delay = retryCount * 500; // 500ms, 1000ms, 1500ms
            console.log(`Retry ${retryCount}/${maxRetries} for match at (${item.x},${item.y}) in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    console.log("Batch processing complete");
  } catch (error) {
    console.error("Error processing batch:", error);

    // Report errors to all callbacks in the batch
    for (const item of txQueue) {
      if (item.onError) {
        item.onError(error);
      }
    }
  } finally {
    isProcessingBatch = false;

    // If there are new items in the queue, start a new timer
    if (txQueue.length > 0) {
      console.log(`${txQueue.length} items remaining in queue. Starting new timeout.`);
      batchTimeoutId = setTimeout(() => processBatch(gameWalletPrivateKey), BATCH_TIMEOUT);
    }
  }
};

/**
 * Send multiple match transactions using the game wallet
 * This now adds matches to a queue for batch processing
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 * @param matches Array of match data (x, y, type)
 * @returns Array of transaction hashes (or failed entries as null)
 */
export const sendBatchMatchTransactions = async (
  gameWalletPrivateKey: string,
  matches: { x: number; y: number; type: number }[],
): Promise<string[]> => {
  if (!gameWalletPrivateKey) {
    throw new Error("Game wallet private key is required");
  }

  if (matches.length === 0) {
    return [];
  }

  try {
    // Convert private key to proper format
    const formattedPrivateKey = gameWalletPrivateKey.startsWith("0x")
      ? (gameWalletPrivateKey as `0x${string}`)
      : (`0x${gameWalletPrivateKey}` as `0x${string}`);

    console.log(`Queuing ${matches.length} matches for processing`);
    // Never log private keys, even for debugging

    // Add all matches to the queue and collect promises
    const txPromises = matches.map(match => queueMatchTransaction(formattedPrivateKey, match));

    // Wait for all transactions to be processed
    const hashes = await Promise.all(
      txPromises.map(p =>
        p.catch(error => {
          console.error("Match transaction failed:", error);
          return null;
        }),
      ),
    );

    // Filter out null values (failed transactions)
    const successfulHashes = hashes.filter((hash): hash is string => hash !== null);

    console.log(`Batch queuing complete. ${successfulHashes.length}/${matches.length} successful`);
    return successfulHashes;
  } catch (error) {
    console.error("Error queuing batch transactions:", error);
    throw new Error(`Failed to queue batch transactions: ${error}`);
  }
};

/**
 * Send a transaction using the game wallet to submit a score for a versus game
 * Also updates the score in real-time via websocket
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 * @param gameId The id of the game to submit a score for
 * @param score The score to submit
 * @param playerAddress The address of the player submitting the score
 * @returns boolean indicating success or failure
 */
export const submitVersusGameScore = async (
  gameWalletPrivateKey: string,
  gameId: string,
  score: number,
  playerAddress: string,
): Promise<boolean> => {
  if (!gameWalletPrivateKey) {
    throw new Error("Game wallet private key is required");
  }

  // Make sure we have a valid score (prevent submitting 0 accidentally)
  if (score <= 0) {
    console.warn("Warning: Attempting to submit a score of 0 or less. This might be unintended.");
  }

  console.log("Submitting score via websocket and blockchain:", score);

  try {
    // Convert private key to proper format
    const formattedPrivateKey = gameWalletPrivateKey.startsWith("0x")
      ? (gameWalletPrivateKey as `0x${string}`)
      : (`0x${gameWalletPrivateKey}` as `0x${string}`);

    // Create account and wallet client
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport,
    });

    // Send the transaction to update score on-chain
    const hash = await walletClient.writeContract({
      address: deployedContracts[10143].GameEscrow.address,
      abi: deployedContracts[10143].GameEscrow.abi,
      functionName: "submitScore",
      args: [gameId as `0x${string}`, playerAddress as `0x${string}`, BigInt(score)],
      chain: monadTestnet,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("Score submitted successfully to blockchain:", receipt);
    return true;
  } catch (error) {
    console.error("Error submitting versus game score:", error);
    throw new Error(`Failed to submit versus game score: ${error}`);
  }
};

/**
 * End a versus game and distribute the prize to the winner
 * Can optionally use scores from the websocket instead of relying on blockchain submissions
 *
 * @param gameWalletPrivateKey The private key of the game wallet
 * @param gameId The id of the game to end
 * @param player1Score Optional score for player 1 from websocket
 * @param player2Score Optional score for player 2 from websocket
 * @param player1Address Optional address of player 1
 * @param player2Address Optional address of player 2
 */
export const endVersusGame = async (
  gameWalletPrivateKey: string,
  gameId: string,
  player1Score?: number,
  player2Score?: number,
  player1Address?: string,
  player2Address?: string,
): Promise<void> => {
  if (!gameWalletPrivateKey) {
    throw new Error("Game wallet private key is required");
  }

  try {
    // Convert private key to proper format
    const formattedPrivateKey = gameWalletPrivateKey.startsWith("0x")
      ? (gameWalletPrivateKey as `0x${string}`)
      : (`0x${gameWalletPrivateKey}` as `0x${string}`);

    // Create account and wallet client
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });

    const publicClient = createPublicClient({
      chain: monadTestnet,
      transport,
    });

    // If we have scores from the websocket, submit them before ending the game
    if (player1Score !== undefined && player1Address) {
      console.log(`Submitting player 1 score from websocket: ${player1Score}`);
      try {
        // Submit player 1 score
        const scoreHash1 = await walletClient.writeContract({
          address: deployedContracts[10143].GameEscrow.address,
          abi: deployedContracts[10143].GameEscrow.abi,
          functionName: "submitScore",
          args: [gameId as `0x${string}`, player1Address as `0x${string}`, BigInt(player1Score)],
          chain: monadTestnet,
        });
        await publicClient.waitForTransactionReceipt({ hash: scoreHash1 });
        console.log("Player 1 score submitted:", player1Score);
      } catch (err) {
        console.error("Error submitting player 1 score:", err);
        // Continue to end game even if score submission fails
      }
    }

    if (player2Score !== undefined && player2Address) {
      console.log(`Submitting player 2 score from websocket: ${player2Score}`);
      try {
        // Submit player 2 score
        const scoreHash2 = await walletClient.writeContract({
          address: deployedContracts[10143].GameEscrow.address,
          abi: deployedContracts[10143].GameEscrow.abi,
          functionName: "submitScore",
          args: [gameId as `0x${string}`, player2Address as `0x${string}`, BigInt(player2Score)],
          chain: monadTestnet,
        });
        await publicClient.waitForTransactionReceipt({ hash: scoreHash2 });
        console.log("Player 2 score submitted:", player2Score);
      } catch (err) {
        console.error("Error submitting player 2 score:", err);
        // Continue to end game even if score submission fails
      }
    }

    // Send the transaction to end the game
    console.log("Ending game with ID:", gameId);
    const hash = await walletClient.writeContract({
      address: deployedContracts[10143].GameEscrow.address,
      abi: deployedContracts[10143].GameEscrow.abi,
      functionName: "endGame",
      args: [gameId as `0x${string}`],
      chain: monadTestnet,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("Game ended successfully:", receipt);
  } catch (error) {
    console.error("Error ending versus game:", error);
    throw new Error(`Failed to end versus game: ${error}`);
  }
};

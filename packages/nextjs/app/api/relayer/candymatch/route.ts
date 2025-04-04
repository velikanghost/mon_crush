import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, formatEther, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import deployedContracts from "~~/contracts/deployedContracts";
import { monadTestnet } from "~~/scaffold.config";
import { CONTRACT_ABI } from "~~/utils/scaffold-eth/abi";

// Create transport and clients
const transport = http(process.env.NEXT_PUBLIC_MONAD_RPC_URL);
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport,
});

// Initialize private keys
const PRIVATE_KEYS = [
  process.env.RELAYER_PRIVATE_KEY_1,
  process.env.RELAYER_PRIVATE_KEY_2,
  process.env.RELAYER_PRIVATE_KEY_3,
  process.env.RELAYER_PRIVATE_KEY_4,
  process.env.RELAYER_PRIVATE_KEY_5,
  process.env.RELAYER_PRIVATE_KEY_6,
  process.env.RELAYER_PRIVATE_KEY_7,
  process.env.RELAYER_PRIVATE_KEY_8,
  process.env.RELAYER_PRIVATE_KEY_9,
  process.env.RELAYER_PRIVATE_KEY_10,
  process.env.RELAYER_PRIVATE_KEY_11,
  process.env.RELAYER_PRIVATE_KEY_12,
  process.env.RELAYER_PRIVATE_KEY_13,
  process.env.RELAYER_PRIVATE_KEY_14,
  process.env.RELAYER_PRIVATE_KEY_15,
  process.env.RELAYER_PRIVATE_KEY_16,
  process.env.RELAYER_PRIVATE_KEY_17,
  process.env.RELAYER_PRIVATE_KEY_18,
  process.env.RELAYER_PRIVATE_KEY_19,
  process.env.RELAYER_PRIVATE_KEY_20,
  process.env.RELAYER_PRIVATE_KEY_21,
  process.env.RELAYER_PRIVATE_KEY_22,
  process.env.RELAYER_PRIVATE_KEY_23,
  process.env.RELAYER_PRIVATE_KEY_24,
  process.env.RELAYER_PRIVATE_KEY_25,
  process.env.RELAYER_PRIVATE_KEY_26,
  process.env.RELAYER_PRIVATE_KEY_27,
  process.env.RELAYER_PRIVATE_KEY_28,
  process.env.RELAYER_PRIVATE_KEY_29,
  process.env.RELAYER_PRIVATE_KEY_30,
  process.env.RELAYER_PRIVATE_KEY_31,
  process.env.RELAYER_PRIVATE_KEY_32,
  process.env.RELAYER_PRIVATE_KEY_33,
  process.env.RELAYER_PRIVATE_KEY_34,
  process.env.RELAYER_PRIVATE_KEY_35,
  process.env.RELAYER_PRIVATE_KEY_36,
  process.env.RELAYER_PRIVATE_KEY_37,
  process.env.RELAYER_PRIVATE_KEY_38,
  process.env.RELAYER_PRIVATE_KEY_39,
  process.env.RELAYER_PRIVATE_KEY_40,
  process.env.RELAYER_PRIVATE_KEY_41,
  process.env.RELAYER_PRIVATE_KEY_42,
  process.env.RELAYER_PRIVATE_KEY_43,
  process.env.RELAYER_PRIVATE_KEY_44,
  process.env.RELAYER_PRIVATE_KEY_45,
  process.env.RELAYER_PRIVATE_KEY_46,
  process.env.RELAYER_PRIVATE_KEY_47,
  process.env.RELAYER_PRIVATE_KEY_48,
  process.env.RELAYER_PRIVATE_KEY_49,
  process.env.RELAYER_PRIVATE_KEY_50,
].filter((key): key is string => !!key);

if (PRIVATE_KEYS.length === 0) {
  console.error("No relayer private keys found in environment variables!");
}

// Contract details
const CONTRACT_ADDRESS = deployedContracts[monadTestnet.id]?.CandyCrushGame?.address;
if (!CONTRACT_ADDRESS) {
  throw new Error("CandyCrushGame contract address not found for the target network.");
}

// Batch settings
const BATCH_SIZE = 20; // Number of transactions to send in a batch
const batchQueue: { x: number; y: number; type: number }[] = [];
let isProcessingBatch = false;
let currentKeyIndex = 0; // Cycle through keys for batches
let lastBatchProcessTime = Date.now(); // Track when we last processed a batch

// Store transaction hashes (optional, could be replaced by frontend handling)
const MAX_STORED_HASHES = 200;
const txHashes: string[] = [];
const storeTxHash = (hash: string) => {
  txHashes.unshift(hash);
  if (txHashes.length > MAX_STORED_HASHES) {
    txHashes.pop();
  }
};

// Type definition for a single match
type Match = { x: number; y: number; type: number };

async function processBatchTransactions(batch: { x: number; y: number; type: number }[]) {
  if (PRIVATE_KEYS.length === 0) {
    console.error("No private keys available to process batch.");
    return [];
  }

  isProcessingBatch = true;
  const startTime = Date.now();
  let hashes: string[] = [];

  // Try each key until we find one with enough gas
  let keysTried = 0;
  let successfulKey = false;

  while (keysTried < PRIVATE_KEYS.length && !successfulKey) {
    const privateKey = PRIVATE_KEYS[currentKeyIndex];
    const formattedPrivateKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletAddress = account.address;

    // Check gas balance before trying
    try {
      const balance = await publicClient.getBalance({ address: walletAddress });
      // Minimum balance required (0.01 MONAD should be enough for a batch)
      const minBalance = parseEther("0.01");

      if (balance < minBalance) {
        console.warn(`Key ${currentKeyIndex} has low balance: ${formatEther(balance)} MONAD. Skipping...`);
        // Move to next key
        currentKeyIndex = (currentKeyIndex + 1) % PRIVATE_KEYS.length;
        keysTried++;
        continue;
      }

      console.log(`Using key ${currentKeyIndex} with balance: ${formatEther(balance)} MONAD`);
      successfulKey = true;

      const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport,
      });

      // Get the current nonce for the account
      const nonce = await publicClient.getTransactionCount({ address: walletAddress });
      console.log(`Starting nonce for batch: ${nonce}`);

      const transactionPromises = batch.map(async (tx, index) => {
        const currentNonce = nonce + index;
        console.log(`Sending tx ${index + 1}/${batch.length} with nonce ${currentNonce}`);
        try {
          const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "recordMatch",
            args: [tx.x, tx.y, tx.type],
            chain: monadTestnet,
            nonce: currentNonce,
            // Adding gas limit to avoid reverts
            gas: BigInt(100000),
          });
          console.log(`Tx ${index + 1} sent, hash: ${hash}`);
          storeTxHash(hash); // Store hash locally
          return hash;
        } catch (txError) {
          console.error(`Error sending tx ${index + 1} (nonce ${currentNonce}):`, txError);
          return null; // Indicate failure for this specific transaction
        }
      });

      // Wait for all transactions in the batch to be sent
      const results = await Promise.all(transactionPromises);
      // Filter out failed transactions (null values) and ensure correct type
      hashes = results.filter((hash): hash is `0x${string}` => hash !== null);

      console.log(`Batch sent. Hashes: ${hashes.join(", ")}`);
    } catch (error) {
      console.error(`Error with key ${currentKeyIndex}:`, error);
      currentKeyIndex = (currentKeyIndex + 1) % PRIVATE_KEYS.length;
      keysTried++;
    }
  }

  // If we've tried all keys and none worked
  if (!successfulKey) {
    console.error("All keys have insufficient gas or other issues. Could not process batch.");
  } else {
    // Move to the next key for the next batch
    currentKeyIndex = (currentKeyIndex + 1) % PRIVATE_KEYS.length;
  }

  isProcessingBatch = false;
  console.log(`Batch processing finished. Time taken: ${Date.now() - startTime}ms`);
  // Trigger processing of the next batch if the queue is not empty
  triggerBatchProcessing();

  return hashes; // Return the hashes of successfully sent transactions
}

function triggerBatchProcessing() {
  const currentTime = Date.now();
  // Process if queue has enough items OR it's been more than 60 seconds since last batch
  if (
    !isProcessingBatch &&
    (batchQueue.length >= BATCH_SIZE || (batchQueue.length > 0 && currentTime - lastBatchProcessTime > 60000))
  ) {
    // Process either a full batch or whatever we have if it's been waiting too long
    const batchSize = Math.min(batchQueue.length, BATCH_SIZE);
    const batchToSend = batchQueue.splice(0, batchSize);
    lastBatchProcessTime = currentTime; // Update the last batch time
    processBatchTransactions(batchToSend); // Process async, don't await here
  } else if (!isProcessingBatch && batchQueue.length > 0) {
    console.log(`Queue has ${batchQueue.length} items, waiting for ${BATCH_SIZE} to form a batch or timeout.`);
  }
}

// Add a periodic check to process partial batches
let intervalId: NodeJS.Timeout | null = null;
if (typeof setInterval !== "undefined") {
  intervalId = setInterval(() => {
    // Check if we have pending items that haven't been processed in a while
    if (!isProcessingBatch && batchQueue.length > 0 && Date.now() - lastBatchProcessTime > 60000) {
      console.log(`Processing partial batch of ${batchQueue.length} items due to timeout`);
      triggerBatchProcessing();
    }
  }, 15000); // Check every 15 seconds
}

export async function GET() {
  return NextResponse.json({
    hashes: txHashes,
    count: txHashes.length,
    pendingCount: batchQueue.length,
  });
}

export async function POST(req: Request) {
  try {
    if (PRIVATE_KEYS.length === 0) {
      return NextResponse.json({ error: "No relayer keys configured" }, { status: 500 });
    }
    if (!CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "Contract address not configured" }, { status: 500 });
    }

    const body = await req.json();
    console.log("Received match data:", body);
    const { x, y, candyType } = body;

    // Basic validation
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof candyType !== "number" ||
      x < 0 ||
      x >= 8 || // Assuming BOARD_SIZE is 8
      y < 0 ||
      y >= 8 ||
      candyType <= 0 ||
      candyType > 5 // Assuming max candy type is 5
    ) {
      console.error("Invalid match data found in batch:", body);
      return NextResponse.json({ error: "Invalid match data found in batch." }, { status: 400 });
    }

    // Add to batch queue - Using 'type' internally even though frontend sends as 'candyType'
    batchQueue.push({ x, y, type: candyType });
    console.log(`Added to batch queue: {${x}, ${y}, ${candyType}}. Queue size: ${batchQueue.length}`);

    // Check if we can send immediately (optimization for immediate feedback)
    // Only attempt immediate processing if we have the right conditions
    let immediateHash: string | null = null;

    // Only try immediate processing if queue was empty before this request
    // This prevents request blocking and ensures responsive UX
    if (batchQueue.length === 1 && !isProcessingBatch && PRIVATE_KEYS.length > 0) {
      try {
        // Get current key
        const privateKey = PRIVATE_KEYS[currentKeyIndex];
        const formattedPrivateKey = privateKey.startsWith("0x")
          ? (privateKey as `0x${string}`)
          : (`0x${privateKey}` as `0x${string}`);
        const account = privateKeyToAccount(formattedPrivateKey);

        // Quick check if key has enough balance (fast check)
        const balance = await publicClient.getBalance({ address: account.address });
        const minBalance = parseEther("0.001"); // Lower threshold for single tx

        if (balance >= minBalance) {
          const walletClient = createWalletClient({
            account,
            chain: monadTestnet,
            transport,
          });

          // Try to send this single transaction immediately
          const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "recordMatch",
            args: [x, y, candyType],
            chain: monadTestnet,
            gas: BigInt(100000),
          });

          // If successful, remove from queue and store hash
          batchQueue.pop(); // Remove the item we just processed
          storeTxHash(hash); // Store in server memory
          immediateHash = hash; // Return to client
          console.log(`Immediate processing successful, hash: ${hash}`);
        }
      } catch (immediateError) {
        console.log("Immediate processing failed, falling back to batch mode:", immediateError);
        // Continue with normal batch processing if immediate attempt fails
      }
    }

    // Trigger batch processing for any remaining queue items
    triggerBatchProcessing();

    // Response with immediate hash if available
    if (immediateHash) {
      return NextResponse.json({
        success: true,
        message: `Match processed immediately. Current queue size: ${batchQueue.length}`,
        hash: immediateHash,
      });
    } else {
      return NextResponse.json({
        success: true,
        message: `Match added to batch queue. Current queue size: ${batchQueue.length}`,
        // No immediate hash, will be processed in batch
      });
    }
  } catch (error) {
    console.error("Error in candy match POST route:", error);
    return NextResponse.json({ error: "Failed to process candy match" }, { status: 500 });
  }
}

// Clean up interval on shutdown
if (typeof process !== "undefined") {
  process.on("SIGTERM", () => {
    if (intervalId) clearInterval(intervalId);
    // Process any remaining items in the queue
    if (batchQueue.length > 0 && !isProcessingBatch) {
      console.log(`Processing remaining ${batchQueue.length} items before shutdown`);
      const batchToSend = batchQueue.splice(0, batchQueue.length);
      processBatchTransactions(batchToSend);
    }
  });
}

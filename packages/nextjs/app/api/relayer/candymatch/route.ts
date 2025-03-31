import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
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
const batchQueue: { x: number; y: number; candyType: number }[] = [];
let isProcessingBatch = false;
let currentKeyIndex = 0; // Cycle through keys for batches

// Store transaction hashes (optional, could be replaced by frontend handling)
const MAX_STORED_HASHES = 100;
const txHashes: string[] = [];
const storeTxHash = (hash: string) => {
  txHashes.unshift(hash);
  if (txHashes.length > MAX_STORED_HASHES) {
    txHashes.pop();
  }
};

async function processBatchTransactions(batch: { x: number; y: number; candyType: number }[]) {
  if (PRIVATE_KEYS.length === 0) {
    console.error("No private keys available to process batch.");
    return [];
  }

  const privateKey = PRIVATE_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % PRIVATE_KEYS.length; // Move to the next key

  const startTime = Date.now();
  isProcessingBatch = true;
  let hashes: string[] = [];

  try {
    console.log(`Processing batch of ${batch.length} transactions using key index ${currentKeyIndex}...`);

    const formattedPrivateKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
    const account = privateKeyToAccount(formattedPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });
    const walletAddress = account.address;

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
          args: [tx.x, tx.y, tx.candyType],
          chain: monadTestnet,
          nonce: currentNonce,
          // Consider adding gas estimations or fixed values if needed
          // gas: BigInt(100000), // Example fixed gas limit
          // maxFeePerGas: parseGwei('20'), // Example EIP-1559 fees
          // maxPriorityFeePerGas: parseGwei('1'),
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

    // Optional: Wait for confirmations (can significantly increase response time)
    /*
    if (hashes.length > 0) {
      console.log("Waiting for batch confirmations...");
      const receipts = await Promise.all(hashes.map(hash => publicClient.waitForTransactionReceipt({ hash })));
      console.log("Batch confirmed in blocks:", receipts.map(r => r.blockNumber).join(", "));
    }
    */
  } catch (error) {
    console.error("Error processing batch transactions:", error);
    // Handle batch-level errors (e.g., nonce fetching failed)
  } finally {
    isProcessingBatch = false;
    console.log(`Batch processing finished. Time taken: ${Date.now() - startTime}ms`);
    // Trigger processing of the next batch if the queue is not empty
    triggerBatchProcessing();
  }
  return hashes; // Return the hashes of successfully sent transactions
}

function triggerBatchProcessing() {
  // Only start a new batch if not already processing and queue has enough items
  if (!isProcessingBatch && batchQueue.length >= BATCH_SIZE) {
    const batchToSend = batchQueue.splice(0, BATCH_SIZE);
    processBatchTransactions(batchToSend); // Process async, don't await here
  } else if (!isProcessingBatch && batchQueue.length > 0) {
    // Optional: Process remaining items if fewer than BATCH_SIZE?
    // Or wait for more items to accumulate. Current logic waits.
    console.log(`Queue has ${batchQueue.length} items, waiting for ${BATCH_SIZE} to form a batch.`);
  }
}

export async function GET() {
  // Returns locally stored hashes (consider if still needed)
  return NextResponse.json({
    hashes: txHashes,
    count: txHashes.length,
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
    const { x, y, candyType } = body;

    // Basic validation
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof candyType !== "number" ||
      x < 0 ||
      x >= 8 ||
      y < 0 ||
      y >= 8 ||
      candyType <= 0 ||
      candyType > 5
    ) {
      return NextResponse.json({ error: "Invalid input parameters" }, { status: 400 });
    }

    // Add to batch queue
    batchQueue.push({ x, y, candyType });
    console.log(`Added to batch queue: {${x}, ${y}, ${candyType}}. Queue size: ${batchQueue.length}`);

    // Trigger batch processing if conditions are met
    triggerBatchProcessing();

    // --- Response Modification ---
    // Since batching is async, we can't return the *final* hashes immediately.
    // Option 1: Return success immediately, frontend polls/waits.
    // Option 2: (More complex) Hold the request open until the batch containing this tx is processed.
    // Option 3: Return the current queue status.

    // Let's go with Option 1: Acknowledge receipt.
    return NextResponse.json({
      success: true,
      message: `Match added to batch queue. Current queue size: ${batchQueue.length}`,
      // Cannot return specific hash here as it's processed async in a batch
    });
  } catch (error) {
    console.error("Error in candy match POST route:", error);
    return NextResponse.json({ error: "Failed to process candy match" }, { status: 500 });
  }
}

// Optional: Add a mechanism to process remaining items on shutdown or periodically
// cleanup function, e.g. process.on('SIGTERM', async () => { ... });

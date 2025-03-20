import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
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
  // ... Include all private keys as in the original relayer
].filter((key): key is string => !!key);

// Contract details - Get the CandyCrushGame contract address from deployedContracts
const CONTRACT_ADDRESS = deployedContracts[10143].CandyCrushGame.address;

// Queue and wallet tracking
type QueuedTx = {
  x: number;
  y: number;
  candyType: number;
};
const txQueue: QueuedTx[] = [];
const busyKeys = new Set<string>();
let isCheckingQueue = false;

// Store transaction hashes in memory
// We'll limit the size to avoid memory issues
const MAX_STORED_HASHES = 100;
export const txHashes: string[] = [];

export const storeTxHash = (hash: string) => {
  // Add to beginning of array (newest first)
  txHashes.unshift(hash);

  // Keep only the most recent MAX_STORED_HASHES
  if (txHashes.length > MAX_STORED_HASHES) {
    txHashes.pop();
  }
};

// Add a function to clear transaction hashes
export const clearTxHashes = () => {
  txHashes.length = 0; // Clear the array
};

async function getAvailableKey(): Promise<string | undefined> {
  const key = PRIVATE_KEYS.find(key => !busyKeys.has(key));
  console.log("Available keys:", PRIVATE_KEYS.filter(key => !busyKeys.has(key)).length);
  return key;
}

async function processSingleTransaction(privateKey: string, tx: QueuedTx) {
  const startTime = Date.now();
  try {
    // Execute transaction and get the hash
    const formattedPrivateKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
    const account = privateKeyToAccount(formattedPrivateKey);
    const wallet = createWalletClient({
      account,
      chain: monadTestnet,
      transport,
    });

    const hash = await wallet.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "recordMatch",
      args: [tx.x, tx.y, tx.candyType],
      chain: monadTestnet,
    });

    // Store the transaction hash
    storeTxHash(hash);

    console.log("Candy match transaction sent:", hash, "waiting for confirmation...");

    // Wait for transaction to be confirmed
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Transaction confirmed in block:", receipt.blockNumber);
  } catch (error) {
    console.error("Error processing tx:", error);
  } finally {
    busyKeys.delete(privateKey);
    console.log("Freed key:", privateKey.slice(-4), "Time taken:", Date.now() - startTime, "ms");
  }
}

async function processQueue() {
  if (isCheckingQueue) return;
  isCheckingQueue = true;

  while (txQueue.length > 0) {
    const privateKey = await getAvailableKey();
    if (!privateKey) {
      // If no keys available, wait 100ms and check again
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }

    console.log("Using key:", privateKey.slice(-4), "Queue length:", txQueue.length);
    busyKeys.add(privateKey);
    const tx = txQueue.shift();
    if (tx) {
      // Process transaction without waiting for it
      processSingleTransaction(privateKey, tx);
    } else {
      busyKeys.delete(privateKey);
    }
  }

  isCheckingQueue = false;
}

export async function GET() {
  try {
    // Return the stored transaction hashes
    return NextResponse.json({
      hashes: txHashes,
      count: txHashes.length,
    });
  } catch (error) {
    console.error("Error retrieving transaction hashes:", error);
    return NextResponse.json({ error: "Failed to retrieve transaction hashes" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { slug: string[] } }) {
  try {
    if (PRIVATE_KEYS.length === 0) {
      return NextResponse.json({ error: "No private keys configured" }, { status: 500 });
    }

    // Parse the request body
    const body = await req.json();
    const { x, y, candyType } = body;

    // Validate input data
    if (typeof x !== "number" || typeof y !== "number" || typeof candyType !== "number") {
      return NextResponse.json({ error: "Invalid input parameters" }, { status: 400 });
    }

    if (x < 0 || x >= 8 || y < 0 || y >= 8) {
      return NextResponse.json({ error: "Coordinates out of bounds" }, { status: 400 });
    }

    if (candyType <= 0 || candyType > 5) {
      return NextResponse.json({ error: "Invalid candy type" }, { status: 400 });
    }

    // Add transaction to queue
    txQueue.push({ x, y, candyType });

    // Try to process queue
    processQueue();

    return NextResponse.json({ success: true, message: "Match queued for processing" });
  } catch (error) {
    console.error("Error in candy match route:", error);
    return NextResponse.json({ error: "Failed to record candy match" }, { status: 500 });
  }
}

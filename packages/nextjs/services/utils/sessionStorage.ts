import { decryptData, deriveEncryptionKey, encryptData } from "./crypto";

// Interface for session data
interface SessionData {
  signature: string;
  expiresAt: number;
}

// Three days in milliseconds
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Store a user session with the signature, encrypted with a key derived from the address or FID+address
 * Set to expire after 3 days
 *
 * @param address The user's identifier (can be wallet address or fid_address for Farcaster users)
 * @param signature The signature to store
 */
export const storeUserSession = (address: string, signature: string): void => {
  if (!address || !signature) return;

  try {
    // Create session data with expiration
    const sessionData: SessionData = {
      signature,
      expiresAt: Date.now() + THREE_DAYS_MS,
    };

    // Convert to string and encrypt
    const sessionDataString = JSON.stringify(sessionData);
    const encryptionKey = deriveEncryptionKey(address);
    const encryptedData = encryptData(sessionDataString, encryptionKey);

    // Store in localStorage
    localStorage.setItem(`monadMatch_session_${address}`, encryptedData);

    console.log(`Session stored for ${address}, expires in 3 days`);
  } catch (error) {
    console.error("Failed to store user session:", error);
  }
};

/**
 * Retrieve a stored user session if it exists and hasn't expired
 *
 * @param address The user's identifier (can be wallet address or fid_address for Farcaster users)
 * @returns The signature if valid, or null if expired or not found
 */
export const getUserSession = (address: string): string | null => {
  if (!address) return null;

  try {
    // Get encrypted session data
    const encryptedData = localStorage.getItem(`monadMatch_session_${address}`);
    if (!encryptedData) return null;

    // Decrypt the data
    const encryptionKey = deriveEncryptionKey(address);
    const sessionDataString = decryptData(encryptedData, encryptionKey);
    const sessionData = JSON.parse(sessionDataString) as SessionData;

    // Check if session has expired
    if (sessionData.expiresAt < Date.now()) {
      console.log(`Session for ${address} has expired, removing`);
      localStorage.removeItem(`monadMatch_session_${address}`);
      return null;
    }

    // Return the valid signature
    return sessionData.signature;
  } catch (error) {
    console.error("Failed to retrieve user session:", error);
    // Clean up any corrupted data
    localStorage.removeItem(`monadMatch_session_${address}`);
    return null;
  }
};

/**
 * Extend the user session by another 3 days
 *
 * @param address The user's identifier (can be wallet address or fid_address for Farcaster users)
 */
export const extendUserSession = (address: string): void => {
  if (!address) return;

  try {
    // Get the current session
    const signature = getUserSession(address);
    if (!signature) return;

    // Store it again with a new expiration date
    storeUserSession(address, signature);

    console.log(`Session extended for ${address}`);
  } catch (error) {
    console.error("Failed to extend user session:", error);
  }
};

/**
 * Clear the user session
 *
 * @param address The user's identifier (can be wallet address or fid_address for Farcaster users)
 */
export const clearUserSession = (address: string): void => {
  if (!address) return;

  localStorage.removeItem(`monadMatch_session_${address}`);
  console.log(`Session cleared for ${address}`);
};

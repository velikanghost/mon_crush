import crypto from "crypto";

//Function to derive encryption key - supports both formats
export const deriveEncryptionKey = (input: string): Buffer => {
  return crypto.createHash("sha256").update(input).digest();
};

// export const deriveEncryptionKey = (walletAddress: string, signature: string) => {
//   const compositeKey = `${walletAddress}:${signature}`;
//   // Use a KDF to derive a strong encryption key
//   return crypto.createHash("sha256").update(compositeKey).digest();
// };

const normalizeKey = (key: Buffer | string): Buffer => {
  if (typeof key === "string") {
    // Derive a 32-byte key from the input string
    return crypto.createHash("sha256").update(key).digest();
  }
  return key;
};

// Function to encrypt data using AES-256-CBC
export const encryptData = (data: string, key: Buffer | string): string => {
  const normalizedKey = normalizeKey(key);
  const iv = crypto.randomBytes(16); // Generate a random IV
  const cipher = crypto.createCipheriv("aes-256-cbc", normalizedKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`; // Store IV along with the encrypted data
};

// Function to decrypt data - supports both old and new formats
export const decryptData = (encryptedData: string, key: Buffer | string): string => {
  try {
    const [ivHex, encryptedHex] = encryptedData.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "unknown error"}`);
  }
};

import CryptoJS from "crypto-js";

// Derive a consistent encryption key from the signature
export const deriveEncryptionKey = (signature: string): string => {
  // Use SHA256 to hash the signature, ensuring a fixed-length key
  return CryptoJS.SHA256(signature).toString(CryptoJS.enc.Hex);
};

// Encrypt data using AES
export const encryptData = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

// Decrypt data using AES
export const decryptData = (encryptedData: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

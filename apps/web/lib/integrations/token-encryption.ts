import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const ALGORITHM = "aes-256-gcm";

/**
 * Encrypts an OAuth token for secure storage in the database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @param token - The plaintext token to encrypt
 * @returns Encrypted token in format: iv:authTag:ciphertext (all hex-encoded)
 * @throws Error if TOKEN_ENCRYPTION_KEY is not configured
 */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is not configured"
    );
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an OAuth token retrieved from the database.
 *
 * @param encryptedToken - The encrypted token in format: iv:authTag:ciphertext
 * @returns The original plaintext token
 * @throws Error if TOKEN_ENCRYPTION_KEY is not configured or decryption fails
 */
export function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is not configured"
    );
  }

  const [ivHex, authTagHex, encrypted] = encryptedToken.split(":");

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted token format");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Checks if a token appears to be encrypted (has the expected format).
 *
 * @param token - The token to check
 * @returns true if the token appears to be in encrypted format
 */
export function isEncryptedToken(token: string): boolean {
  const parts = token.split(":");
  // Encrypted format: iv (32 hex chars) : authTag (32 hex chars) : ciphertext
  return (
    parts.length === 3 &&
    parts[0].length === 32 &&
    parts[1].length === 32 &&
    /^[0-9a-f]+$/i.test(parts[0]) &&
    /^[0-9a-f]+$/i.test(parts[1])
  );
}

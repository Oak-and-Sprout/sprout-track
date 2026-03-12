import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const FILES_DIR = path.join(process.cwd(), 'Files');

function getEncryptionKey(): Buffer {
  const hash = process.env.ENC_HASH;
  if (!hash) {
    throw new Error('ENC_HASH environment variable is not set');
  }
  return Buffer.from(hash, 'hex');
}

function ensureFilesDir(): void {
  if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
  }
}

/**
 * Encrypt a buffer and write to disk as [IV (16)][AuthTag (16)][CipherText]
 * Returns the stored filename (uuid.enc)
 */
export function encryptAndStore(data: Buffer, storedName: string): string {
  ensureFilesDir();
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const output = Buffer.concat([iv, authTag, encrypted]);
  const filePath = path.join(FILES_DIR, storedName);
  fs.writeFileSync(filePath, output);

  return storedName;
}

/**
 * Read an encrypted file from disk and decrypt it
 * Returns the decrypted buffer
 */
export function decryptFile(storedName: string): Buffer {
  const key = getEncryptionKey();
  const filePath = path.join(FILES_DIR, storedName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Encrypted file not found: ${storedName}`);
  }

  const fileData = fs.readFileSync(filePath);
  const iv = fileData.subarray(0, IV_LENGTH);
  const authTag = fileData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = fileData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Delete an encrypted file from disk
 */
export function deleteEncryptedFile(storedName: string): void {
  const filePath = path.join(FILES_DIR, storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Generate a unique stored filename
 */
export function generateStoredName(): string {
  return `${crypto.randomUUID()}.enc`;
}

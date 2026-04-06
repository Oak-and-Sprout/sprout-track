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

function resolveDir(subdir?: string): string {
  const dir = subdir ? path.join(FILES_DIR, subdir) : FILES_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Encrypt a buffer and write to disk as [IV (16)][AuthTag (16)][CipherText]
 * @param subdir Optional subdirectory within Files/ (e.g. 'feedback')
 * Returns the stored filename (uuid.enc)
 */
export function encryptAndStore(data: Buffer, storedName: string, subdir?: string): string {
  const dir = resolveDir(subdir);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const output = Buffer.concat([iv, authTag, encrypted]);
  const filePath = path.join(dir, storedName);
  fs.writeFileSync(filePath, output);

  return storedName;
}

/**
 * Read an encrypted file from disk and decrypt it
 * @param subdir Optional subdirectory within Files/ (e.g. 'feedback')
 * Returns the decrypted buffer
 */
export function decryptFile(storedName: string, subdir?: string): Buffer {
  const dir = resolveDir(subdir);
  const key = getEncryptionKey();
  const filePath = path.join(dir, storedName);

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
 * @param subdir Optional subdirectory within Files/ (e.g. 'feedback')
 */
export function deleteEncryptedFile(storedName: string, subdir?: string): void {
  const dir = resolveDir(subdir);
  const filePath = path.join(dir, storedName);
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

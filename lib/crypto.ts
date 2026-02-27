import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Derives an encryption key from the master secret
 */
/**
 * Modern key derivation (used for v1: prefixed data)
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  // Accept raw UTF-8, hex or base64 encoded secrets.
  let buf: Buffer;
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length >= 64) {
    buf = Buffer.from(secret, "hex");
  } else if (/^[A-Za-z0-9+/=]+$/.test(secret) && secret.length % 4 === 0) {
    try {
      buf = Buffer.from(secret, "base64");
    } catch (_) {
      buf = Buffer.from(secret, "utf-8");
    }
  } else {
    buf = Buffer.from(secret, "utf-8");
  }

  if (buf.length < KEY_LENGTH) {
    throw new Error("ENCRYPTION_KEY must decode to at least 32 bytes (256 bits)");
  }

  return buf.slice(0, KEY_LENGTH);
}

/**
 * Legacy key derivation (used for data encrypted WITHOUT v1: prefix)
 * Uses the original simple UTF-8 slicing of the secret.
 */
function getLegacyEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  return Buffer.from(secret.slice(0, 32), 'utf-8')
}

/**
 * Encrypt sensitive data (AWS credentials)
 * Returns base64 encoded string with format: salt:iv:tag:encrypted
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key with salt
    // Use a higher iteration count for PBKDF2 to increase KDF cost
    const derivedKey = crypto.pbkdf2Sync(
      key,
      salt,
      150000,
      KEY_LENGTH,
      "sha512",
    );

    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // Combine all parts and prefix with a version marker for future upgrades (legacy compatibility supported)
    const payload = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, "hex"),
    ]);

    return `v1:${payload.toString("base64")}`;
  } catch (error) {
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string): string {
  try {
    // Detect format by v1: prefix
    const isV1 = ciphertext.startsWith('v1:')
    const payloadBase64 = isV1 ? ciphertext.slice(3) : ciphertext

    let key: Buffer
    let iterations: number

    if (isV1) {
      // New format: uses enhanced multi-format key derivation + 150k iterations
      key = getEncryptionKey()
      iterations = 150000
    } else {
      // Legacy format: uses simple UTF-8 key slice + 100k iterations
      key = getLegacyEncryptionKey()
      iterations = 100000
    }

    const data = Buffer.from(payloadBase64, 'base64')

    // Extract parts
    const salt = data.subarray(0, SALT_LENGTH)
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    // Derive per-message key with salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, iterations, KEY_LENGTH, 'sha512')

    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash passwords (bcrypt alternative using native crypto)
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex')
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(`${salt}:${derivedKey.toString('hex')}`)
    })
  })
}

/**
 * Verify password hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':')
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(key === derivedKey.toString('hex'))
    })
  })
}

/**
 * Generate HMAC signature for link validation
 */
export function generateHMAC(data: string): string {
  const key = getEncryptionKey()
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(data: string, signature: string): boolean {
  const expected = generateHMAC(data)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

/**
 * Encryption utilities for OAuth tokens and sensitive data
 * Uses AES-256-GCM for authenticated encryption
 *
 * Security: Never log encryption keys or decrypted tokens
 */

// Environment variable validation
function getEncryptionKey(): string {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return key;
}

/**
 * Generates a random initialization vector for AES-GCM
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)); // 96 bits for GCM
}

/**
 * Converts a string to a CryptoKey for AES-GCM
 */
async function getKey(): Promise<CryptoKey> {
  const keyMaterial = new TextEncoder().encode(getEncryptionKey());

  // Hash the key to ensure it's exactly 256 bits
  const hash = await crypto.subtle.digest('SHA-256', keyMaterial);

  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a token using AES-256-GCM
 * @param token - Plain text token to encrypt
 * @returns Object with encrypted token and IV (both base64 encoded)
 */
export async function encryptToken(token: string): Promise<{
  encryptedToken: string;
  iv: string;
}> {
  try {
    const key = await getKey();
    const iv = generateIV();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);

    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      data
    );

    // Convert to base64 for storage
    const encryptedArray = new Uint8Array(encrypted);
    const encryptedToken = btoa(String.fromCharCode(...encryptedArray));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return {
      encryptedToken,
      iv: ivBase64,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypts a token using AES-256-GCM
 * @param encryptedToken - Base64 encoded encrypted token
 * @param ivBase64 - Base64 encoded initialization vector
 * @returns Decrypted plain text token
 */
export async function decryptToken(
  encryptedToken: string,
  ivBase64: string
): Promise<string> {
  try {
    const key = await getKey();

    // Convert from base64
    const encryptedData = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed');
    throw new Error('Failed to decrypt token - token may be corrupted or tampered with');
  }
}

/**
 * Securely hashes a value for comparison (e.g., webhook signatures)
 * @param value - Value to hash
 * @param algorithm - Hash algorithm (default: SHA-256)
 * @returns Hex-encoded hash
 */
export async function secureHash(
  value: string,
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies HMAC signature for webhook payloads
 * @param payload - Raw payload string
 * @param signature - Expected signature to verify against
 * @param secret - Shared secret key
 * @returns True if signature is valid
 */
export async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(computedSignature, signature.toLowerCase());
  } catch (error) {
    console.error('HMAC verification failed');
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generates a cryptographically secure random string
 * @param length - Length of random string
 * @returns Random hex string
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Sanitizes sensitive data from logs
 * @param obj - Object to sanitize
 * @returns Sanitized object safe for logging
 */
export function sanitizeForLogging(obj: any): any {
  const sensitiveKeys = [
    'token',
    'access_token',
    'refresh_token',
    'password',
    'secret',
    'api_key',
    'apiKey',
    'client_secret',
    'authorization',
  ];

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

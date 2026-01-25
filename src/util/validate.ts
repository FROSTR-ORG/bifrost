/**
 * Validation utilities for Bifrost inputs.
 *
 * These helpers validate common cryptographic inputs before use,
 * helping consumers catch errors early with clear messages.
 *
 * @module
 */

import { Buff } from '@vbyte/buff'

/**
 * Checks if a string is a valid hex-encoded value.
 *
 * @param hex - The string to validate.
 * @returns True if the string is valid hex with even length.
 *
 * @example
 * ```typescript
 * is_valid_hex('deadbeef')  // true
 * is_valid_hex('deadbee')   // false (odd length)
 * is_valid_hex('xyz')       // false (invalid chars)
 * ```
 */
export function is_valid_hex (hex : string) : boolean {
  if (typeof hex !== 'string') return false
  if (hex.length === 0) return false
  if (hex.length % 2 !== 0) return false
  try {
    Buff.hex(hex)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a string is a valid 32-byte hex public key.
 *
 * Accepts both 32-byte (x-only/BIP-340) and 33-byte (compressed) formats.
 *
 * @param pk - The public key string to validate.
 * @returns True if the string is a valid public key format.
 *
 * @example
 * ```typescript
 * is_valid_pubkey('a'.repeat(64))     // true (32 bytes)
 * is_valid_pubkey('02' + 'a'.repeat(64))  // true (33 bytes compressed)
 * is_valid_pubkey('a'.repeat(63))     // false (wrong length)
 * ```
 */
export function is_valid_pubkey (pk : string) : boolean {
  if (typeof pk !== 'string') return false
  // Accept 32-byte x-only (64 hex) or 33-byte compressed (66 hex)
  if (pk.length !== 64 && pk.length !== 66) return false
  try {
    Buff.hex(pk)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a string is a valid 64-byte hex Schnorr signature.
 *
 * @param sig - The signature string to validate.
 * @returns True if the string is a valid signature format.
 *
 * @example
 * ```typescript
 * is_valid_signature('a'.repeat(128))  // true (64 bytes)
 * is_valid_signature('a'.repeat(127))  // false (wrong length)
 * ```
 */
export function is_valid_signature (sig : string) : boolean {
  if (typeof sig !== 'string') return false
  if (sig.length !== 128) return false
  try {
    Buff.hex(sig)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a string is a valid 32-byte hex message hash.
 *
 * @param hash - The hash string to validate.
 * @returns True if the string is a valid 32-byte hash.
 *
 * @example
 * ```typescript
 * is_valid_hash('a'.repeat(64))  // true (32 bytes)
 * is_valid_hash('a'.repeat(63))  // false (wrong length)
 * ```
 */
export function is_valid_hash (hash : string) : boolean {
  if (typeof hash !== 'string') return false
  if (hash.length !== 64) return false
  try {
    Buff.hex(hash)
    return true
  } catch {
    return false
  }
}

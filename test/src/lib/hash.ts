/**
 * Hash Utilities for Tests
 *
 * Provides simplified hash operations for test code readability.
 */

import { Buff }   from '@vbyte/buff'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Hash a string and return as hex.
 *
 * @param s - The string to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hash_string (s : string) : string {
  return Buff.bytes(sha256(Buff.str(s))).hex
}

/**
 * Hash bytes and return as hex.
 *
 * @param data - The bytes to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hash_bytes (data : Uint8Array) : string {
  return Buff.bytes(sha256(data)).hex
}

/**
 * Hash a string and return as Uint8Array.
 *
 * @param s - The string to hash
 * @returns The SHA-256 hash as Uint8Array
 */
export function hash_string_bytes (s : string) : Uint8Array {
  return Buff.bytes(sha256(Buff.str(s)))
}

import { derive_shares_secret } from '@vbyte/frost/lib'
import { Assert }               from '@/util/index.js'

import {
  convert_pubkey,
  get_pubkey
} from '../util/crypto.js'

import type { GroupPackage, SharePackage } from '@/types/index.js'

/**
 * Normalize a public key to x-only (32-byte) format.
 *
 * Removes the leading prefix byte from a 33-byte compressed pubkey
 * to produce a 32-byte x-only pubkey (BIP-340 format).
 *
 * @param pk - The public key (33 or 32 bytes hex).
 * @returns The 32-byte x-only pubkey.
 */
export function normalize_pubkey (pk : string) : string {
  return pk.length === 66 ? pk.slice(2) : pk
}

/**
 * Check if two public keys match, regardless of format.
 *
 * Handles both 33-byte compressed and 32-byte x-only pubkeys.
 *
 * @param pk1 - First public key.
 * @param pk2 - Second public key.
 * @returns True if the pubkeys represent the same key.
 */
export function pubkeys_match (pk1 : string, pk2 : string) : boolean {
  return normalize_pubkey(pk1) === normalize_pubkey(pk2)
}

/**
 * Get the indexes of the members in the group.
 *
 * @param group - The group package.
 * @returns The indexes of the members in the group.
 */
export function get_group_indexes (
  group : GroupPackage
) : number[] {
  return group.members.map(e => e.idx)
}

/**
 * Select a random subset of peers from a list of peers.
 *
 * @param peers - The list of peers.
 * @param thold - The threshold.
 * @returns The selected peers.
 */
export function select_random_peers (
  peers : string[],
  thold : number
) : string[] {
  // Fisher-Yates shuffle with crypto-secure randomness
  const shuffled = [...peers]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randBytes = new Uint32Array(1)
    crypto.getRandomValues(randBytes)
    const j = randBytes[0] % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const count = Math.min(shuffled.length, thold - 1)
  return shuffled.slice(0, count)
}

/**
 * Get the indexes for a given group and list of pubkeys.
 *
 * @param group   - The group package.
 * @param pubkeys - The list of pubkeys.
 * @returns The indexes of the members in the group.
 */
export function get_member_indexes (
  group   : GroupPackage,
  pubkeys : string[]
) : number[] {
  const indexes = group.members
    .filter(e => pubkeys.includes(convert_pubkey(e.pubkey, 'bip340')))
    .map(e => e.idx)
  Assert.ok(indexes.length === pubkeys.length, 'index count does not match pubkey count')
  return indexes
}

/**
 * Recover the secret key from the given shares.
 *
 * @param group  - The group package.
 * @param shares - The list of shares.
 * @returns The secret key.
 */
export function recover_secret_key (
  group  : GroupPackage,
  shares : SharePackage[]
) : string {
  Assert.ok(shares.length >= group.threshold, 'not enough shares provided')
  const pubkeys = group.members.map(e => e.pubkey)
  for (const share of shares) {
    const pk = get_pubkey(share.seckey, 'ecdsa')
    Assert.ok(pubkeys.includes(pk), 'share not found in group: ' + share.idx)
  }
  return derive_shares_secret(shares)
}

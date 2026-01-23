/**
 * Test Utilities
 *
 * NOTE: These utilities have been updated for the nonce pool system.
 * The legacy static nonce functions have been removed. Tests that
 * rely on signing should use the full BifrostNode with NoncePool.
 */

import type {
  SharePackage,
  SignSessionPackage,
} from '@frostr/bifrost'

import { Assert } from '@/util/assert.js'

/**
 * SighashCommit structure for test compatibility.
 */
interface SighashCommit {
  idx       : number
  pubkey    : string
  binder_pn : string
  hidden_pn : string
  sid       : string
  sighash   : string
  bind_hash : string
}

/**
 * Get the member shares for a given session and set of shares.
 *
 * @param session - The session package.
 * @param shares  - The shares.
 */
export function get_member_shares (
  session : SignSessionPackage,
  shares  : SharePackage[]
) : SharePackage[] {
  return session.members.map(idx => {
    const share = shares.find(e => e.idx === idx)
    Assert.exists(share, 'share not found for member: ' + idx)
    return share
  })
}

/**
 * Get a sighash commit from a list of sighash commits.
 *
 * @param commits  - The list of sighash commits.
 * @param idx      - The member index.
 * @param sighash  - The sighash.
 */
export function get_sighash_commit (
  commits  : SighashCommit[],
  idx      : number,
  sighash  : string
) : SighashCommit | undefined {
  return commits.find(e => e.idx === idx && e.sighash === sighash)
}

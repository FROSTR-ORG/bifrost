import { get_pubkey } from '../util/crypto.js'

import { create_dealer_set } from '@vbyte/frost/lib'

import type {
  DealerShareSet,
  SecretShare,
} from '@vbyte/frost'

import type {
  DealerPackage,
  GroupPackage,
  MemberPackage,
  SharePackage,
} from '@/types/index.js'

/**
 * Generate a dealer package. This package contains the group
 * data and a set of secret shares for each member.
 *
 * Nonces are now managed dynamically by the NoncePool, so
 * the share packages no longer contain static nonces.
 *
 * @param threshold   - The threshold for the dealer.
 * @param share_count - The number of shares to generate.
 * @param secrets     - The secrets to use for generating the shares.
 */
export function generate_dealer_package (
  threshold   : number,
  share_count : number,
  secrets     : string[] = []
) : DealerPackage {
  // Generate a group of secret shares.
  const dealer_set = create_dealer_set(threshold, share_count, secrets)
  // Create dealer package.
  return create_dealer_package(dealer_set)
}

/**
 * Convert an existing set of secret shares into a dealer package.
 *
 * @param share_set - The set of shares to create the package from.
 */
export function create_dealer_package (
  share_set : DealerShareSet
) : DealerPackage {
  // Create a share package for each member (simplified - no static nonces).
  const shares : SharePackage[] = share_set.shares.map(e => ({
    idx    : e.idx,
    seckey : e.seckey
  }))

  // Create a member package for each member (simplified - no static nonces).
  const members : MemberPackage[] = share_set.shares.map(e => ({
    idx    : e.idx,
    pubkey : get_pubkey(e.seckey, 'ecdsa')
  }))

  // Create the group package.
  const group_pk  = share_set.group_pk
  const threshold = share_set.vss_commits.length
  const group : GroupPackage = { members, group_pk, threshold }

  // Return the dealer package.
  return { group, shares }
}

/**
 * Create a simplified share package from a secret share.
 *
 * @param share - The secret share to create the package from.
 */
export function create_share_package (
  share : SecretShare
) : SharePackage {
  return {
    idx    : share.idx,
    seckey : share.seckey
  }
}

/**
 * Create a member package from a share package.
 *
 * @param share - The share package.
 */
export function create_member_package (
  share : SharePackage
) : MemberPackage {
  return {
    idx    : share.idx,
    pubkey : get_pubkey(share.seckey, 'ecdsa')
  }
}


import { Buff }       from '@cmdcode/buff'
import { get_pubkey } from './crypto.js'
import { Assert }     from '@/util/assert.js'

import {
  create_dealer_set,
  generate_nonce
} from '@cmdcode/frost/lib'

import type {
  DealerShareSet,
  SecretShare,
} from '@cmdcode/frost'

import type {
  DealerPackage,
  SharePackage,
} from '@/types/index.js'

/**
 * Generate a dealer package. This package contains the group
 * commitment data, and a set of secret shares for each member.
 * 
 * @param threshold   - The threshold for the dealer.
 * @param share_count - The number of shares to generate.
 * @param secrets     - The secrets to use for generating the shares.
 * @param aux_seeds   - The seeds to use for generating the commitments.
 */
export function generate_dealer_pkg (
  threshold   : number,
  share_count : number,
  secrets     : string[] = [],
  aux_seeds   : string[] = []
) : DealerPackage {
  // Generate a group of secret shares.
  const dealer_set = create_dealer_set(threshold, share_count, secrets)
  // Create dealer package.
  return create_dealer_pkg(dealer_set, aux_seeds)
}

/**
 * Convert an existing set of secret shares into a dealer package.
 * 
 * @param share_set - The set of shares to create the package from.
 * @param aux_seeds - The seeds to use for generating the commitments.
 */
export function create_dealer_pkg (
  share_set : DealerShareSet,
  aux_seeds : string[] = []
) : DealerPackage {
  // Create a share package for each member.
  const shares  = share_set.shares.map((e, idx) => create_share_pkg(e, aux_seeds.at(idx)))
  // Create a commitment package for each member.
  const commits = shares.map(e => {
    const binder_pn = get_pubkey(e.binder_sn, 'ecdsa')
    const hidden_pn = get_pubkey(e.hidden_sn, 'ecdsa')
    const pubkey    = get_pubkey(e.seckey,    'ecdsa')
    return { idx: e.idx, binder_pn, hidden_pn, pubkey }
  })
  // Create the group package.
  const group_pk  = share_set.group_pk
  const threshold = share_set.vss_commits.length
  const group     = { commits, group_pk, threshold }
  // Return the dealer package.
  return { group, shares }
}

/**
 * Convert an existing secret share into a member share package.
 * 
 * @param share - The secret share to create the package from.
 * @param aux   - The auxiliary seed to use for generating the share.
 */
export function create_share_pkg (
  share : SecretShare,
  aux?  : string
) : SharePackage {
  // Get the member's index and secret key.
  const { idx, seckey } = share
  // Generate an auxiliary seed if one is not provided.
  const aux_seed  = aux ?? Buff.random(64).hex
  // Validate the auxiliary seed.
  Assert.size(aux_seed, 64, 'auxiliary seed must be 64 bytes')
  // Generate the binder and hidden nonces.
  const hidden_sn = generate_nonce(seckey, aux_seed.slice(0, 32)).hex
  const binder_sn = generate_nonce(seckey, aux_seed.slice(32, 64)).hex
  // Return the share package.
  return { idx, binder_sn, hidden_sn, seckey }
}

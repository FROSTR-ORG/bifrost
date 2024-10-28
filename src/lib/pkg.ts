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

export function create_dealer_pkg (
  share_set : DealerShareSet,
  aux_seeds : string[] = []
) : DealerPackage {
  const shares  = share_set.shares.map((e, idx) => create_share_pkg(e, aux_seeds.at(idx)))
  const commits = shares.map(e => {
    const binder_pn = get_pubkey(e.binder_sn, 'ecdsa')
    const hidden_pn = get_pubkey(e.hidden_sn, 'ecdsa')
    const pubkey    = get_pubkey(e.seckey,    'ecdsa')
    return { idx: e.idx, binder_pn, hidden_pn, pubkey }
  })
  const group_pk  = share_set.group_pk
  const threshold = share_set.shares.length
  const group     = { commits, group_pk, threshold }
  return { group, shares }
}

export function create_share_pkg (
  share : SecretShare,
  aux?  : string
) : SharePackage {
  const { idx, seckey } = share
  const aux_seed  = aux ?? Buff.random(64).hex
  Assert.size(aux_seed, 64, 'auxiliary seed must be 64 bytes')
  const hidden_sn = generate_nonce(seckey, aux_seed.slice(0, 32)).hex
  const binder_sn = generate_nonce(seckey, aux_seed.slice(32, 64)).hex
  return { idx, binder_sn, hidden_sn, seckey }
}

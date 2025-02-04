import { create_key_group } from '@cmdcode/frost/lib'
import { normalize_pubkey } from './crypto.js'
import { Assert }           from '@/util/assert.js'

import {
  generate_nonce,
  get_pubkey
} from '@cmdcode/frost/lib'

import type {
  KeyGroup,
  SecretShare,
} from '@cmdcode/frost'

import type {
  CommitPackage,
  DealerPackage,
  SharePackage,
} from '@/types/index.js'

export function generate_dealer_pkg (
  threshold   : number,
  share_count : number,
  secrets     : string[] = []
) : DealerPackage {
  // Generate a group of secret shares.
  const key_group = create_key_group(threshold, share_count, secrets)
  // Create dealer package.
  return create_dealer_pkg(key_group)
}

export function create_dealer_pkg (
  key_group : KeyGroup
) : DealerPackage {
  // Create commitments
  const shares    = key_group.shares.map(e => create_share_pkg(e))
  const commits   = shares.map(e => {
    return { idx: e.idx, binder_pn: e.binder_pn, hidden_pn: e.hidden_pn, pubkey: e.pubkey }
  })
  const pubkey    = normalize_pubkey(key_group.pubkey)
  const threshold = key_group.shares.length
  const group     = { commits, pubkey, threshold }
  return { group, shares }
}

export function get_commit_by_pubkey (
  commits : CommitPackage[],
  pubkey  : string
) : CommitPackage {
  pubkey = normalize_pubkey(pubkey)
  const commit = commits.find(e => e.pubkey === pubkey)
  Assert.exists(commit, 'commit package not found for pubkey: ' + pubkey)
  return commit
}

export function get_commit_by_idx (
  commits : CommitPackage[],
  idx     : number
) : CommitPackage {
  const commit = commits.find(e => e.idx === idx)
  Assert.exists(commit, 'commit package not found for idx: ' + idx)
  return commit
}

export function create_share_pkg (
  share : SecretShare,
  aux   : string[] = []
) : SharePackage {
  const { idx, seckey } = share
  const pubkey    = normalize_pubkey(get_pubkey(seckey))
  const hidden_sn = generate_nonce(seckey, aux.at(0)).hex
  const hidden_pn = get_pubkey(hidden_sn)
  const binder_sn = generate_nonce(seckey, aux.at(1)).hex
  const binder_pn = get_pubkey(binder_sn)
  return { idx, binder_sn, binder_pn, hidden_sn, hidden_pn, seckey, pubkey }
}

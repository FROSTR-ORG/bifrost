import { create_key_group } from '@cmdcode/frost/lib'
import { normalize_pubkey } from './util.js'
import { Assert }           from '@/util/assert.js'

import {
  create_commit_pkg,
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
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

export function gen_dealer_pkg (
  threshold   : number,
  share_count : number,
  secrets     : string[] = []
) : DealerPackage {
  // Generate a group of secret shares.
  const pkg    = create_key_group(threshold, share_count, secrets)
  // Create group package.
  const group  = create_group_pkg(pkg)
  // Create share packages.
  const shares = pkg.shares.map(e => create_share_pkg(e))
  // Return packages.
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

export function create_group_pkg (
  group : KeyGroup
) : GroupPackage {
  // Create commitments
  const commits : CommitPackage[] = group.shares.map(e => {
    const { idx, binder_pn, hidden_pn } = create_commit_pkg(e)
    let pubkey = get_pubkey(e.seckey)
        pubkey = normalize_pubkey(pubkey)
    return { idx, binder_pn, hidden_pn, pubkey }
  })

  const pubkey    = normalize_pubkey(group.pubkey)
  const threshold = group.commits.length

  return { commits, pubkey, threshold }
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

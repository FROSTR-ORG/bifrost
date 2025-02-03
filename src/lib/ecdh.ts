import { get_commit_by_pubkey } from './group.js'

import {
  create_ecdh_share,
  derive_ecdh_secret
} from '@cmdcode/frost/lib'

import type { SecretShare } from '@cmdcode/frost'

import type {
  ECDHPackage,
  GroupPackage
} from '@/types/index.js'

export function create_ecdh_pkg (
  group    : GroupPackage,
  members  : string[],
  peer_pk  : string,
  secshare : SecretShare
) {
  const commits    = members.map(e => get_commit_by_pubkey(group.commits, e))
  const indexes    = commits.map(e => e.idx)
  const ecdh_share = create_ecdh_share(indexes, secshare, peer_pk)
  return { idx : ecdh_share.idx, keyshare : ecdh_share.pubkey, members, peer_pk }
}

export function combine_ecdh_pkgs (
  pkgs : ECDHPackage[]
) {
  const shares = pkgs.map(e => {
    return { idx : e.idx, pubkey : e.keyshare }
  })
  return derive_ecdh_secret(shares)
}

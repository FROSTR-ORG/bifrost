import { Assert }                from '@/util/assert.js'
import { combine_session_psigs } from './sign.js'

import {
  create_commit_pkg,
  create_ecdh_share,
  derive_ecdh_secret,
  generate_nonce,
  get_pubkey
} from '@cmdcode/frost/lib'

import type {
  KeyGroup,
  SecretShare,
  ShareSignature
} from '@cmdcode/frost'

import type {
  CommitPackage,
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignaturePackage
} from '@/types/index.js'
import { normalize_pubkey } from './util.js'

export function get_commit_pkg (
  group : GroupPackage,
  idx   : number
) : CommitPackage {
  const commit = group.commits.find(e => e.idx === idx)
  Assert.exists(commit, 'commit package not found for index: ' + idx)
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
  share : SecretShare
) : SharePackage {
  const { idx, seckey } = share
  const binder_sn = generate_nonce(seckey).hex
  const hidden_sn = generate_nonce(seckey).hex
  return { idx, binder_sn, hidden_sn, seckey }
}

export function create_psig_pkg (
  share_psig : ShareSignature
) : SignaturePackage {
  const { idx, psig } = share_psig
  const  pubkey = normalize_pubkey(share_psig.pubkey)
  return { idx, psig, pubkey }
}

export function create_ecdh_pkg (
  members : number[],
  peer_pk : string,
  share   : SecretShare
) {
  return create_ecdh_share(members, share, peer_pk)
}

export function combine_ecdh_pkgs (
  pkgs : ECDHPackage[]
) {
  const shares = pkgs.map(e => {
    return { idx : e.idx, pubkey : e.pubshare }
  })
  return derive_ecdh_secret(shares)
}


export function combine_psig_pkgs (
  group   : GroupPackage,
  message : string,
  pkgs    : SignaturePackage[],
  session : SessionPackage
) {
  // Aggregate responses and extract the signature.
  return combine_session_psigs(group, message, pkgs, session)
}

// export function verify_psig_pkg (
//   ctx  : GroupSessionCtx,
//   psig : PartialSignature
// ) {
//   const pnonce = get_record(ctx.pub_nonces, psig.idx)
//   return verify_partial_sig(ctx, pnonce, psig.pubkey, psig.psig)
// }

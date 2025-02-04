import {
  combine_partial_sigs,
  sign_msg,
  verify_partial_sig
} from '@cmdcode/frost/lib'

import {
  get_member_ctx,
  get_member_share,
  verify_session_pkg
} from '@/lib/session.js'

import type { GroupSessionCtx, ShareSignature } from '@cmdcode/frost'

import type {
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignaturePackage
} from '@/types/index.js'

export function create_share_psig (
  ctx   : GroupSessionCtx,
  share : SharePackage
) : ShareSignature {
  const { idx, binder_sn, hidden_sn, seckey } = share
  const secshare = { idx, seckey }
  const secnonce = { idx, binder_sn, hidden_sn }
  const psig     = sign_msg(ctx, secshare, secnonce)
  return { ...psig, pubkey: share.pubkey }
}

export function create_psig_pkg (
  group   : GroupPackage,
  session : SessionPackage,
  share   : SharePackage,
  tweaks? : string[]
) : SignaturePackage {
  const mbr_ctx   = get_member_ctx(group, session, tweaks)
  const mbr_share = get_member_share(group, session, share)
  const mbr_psig  = create_share_psig(mbr_ctx, mbr_share)
  console.log('mbr_psig:', mbr_psig)
  return { ...session, ...mbr_psig }
}

export function verify_psig_pkg (
  group   : GroupPackage,
  psig    : SignaturePackage,
  tweaks? : string[]
) : string | null {
  // Check if the session package is valid:
  if (!verify_session_pkg(group, psig)) {
    return 'session package invalid'
  }
  // Get the context for the signing session.
  const ctx = get_member_ctx(group, psig, tweaks)
  // Fetch the matching public nonce package for the partial signature.
  const pns = group.commits.find(e => e.idx === psig.idx)
  // Iterate though each validation check, return null if everyting passes.
  if (pns === undefined) {
    return 'commit package not found for psig idx: ' + psig.idx
  } else if (pns.pubkey !== psig.pubkey) {
    return 'pubkey from commit package does not match signature'
  } else if (verify_partial_sig(ctx, pns, pns.pubkey, psig.psig)) {
    return 'partial signature invalid'
  } else {
    return null
  }
}

export function combine_psig_pkgs (
  group   : GroupPackage,
  psigs   : SignaturePackage[],
  tweaks? : string[]
) {

  const ctx = get_member_ctx(group, psigs[0], tweaks)
  console.log('combine_psig_pkgs:', psigs)
  return combine_partial_sigs(ctx, psigs)
}

import {
  combine_partial_sigs,
  sign_msg,
  verify_partial_sig
} from '@cmdcode/frost/lib'

import {
  get_ext_session_ctx,
  get_session_share,
  verify_session_pkg
} from '@/lib/session.js'

import type { GroupSessionCtx } from '@cmdcode/frost'

import type {
  GroupPackage,
  SessionPackage,
  SharePackage,
  SignaturePackage
} from '@/types/index.js'

export function sign_message_ctx (
  ctx   : GroupSessionCtx,
  share : SharePackage
) : SignaturePackage {
  const { idx, binder_sn, hidden_sn, seckey } = share
  const secshare = { idx, seckey }
  const secnonce = { idx, binder_sn, hidden_sn }
  return sign_msg(ctx, secshare, secnonce)
}

export function create_session_psig (
  group   : GroupPackage,
  session : SessionPackage,
  share   : SharePackage,
  message : string,
  tweaks? : string[]
) : SignaturePackage {
  const ctx  = get_ext_session_ctx(group, message, session, tweaks)
  const ssk  = get_session_share(session, share)
  return sign_message_ctx(ctx, ssk)
}

export function verify_session_psig (
  group   : GroupPackage,
  session : SessionPackage,
  message : string,
  psig    : SignaturePackage,
  tweaks? : string[]
) : string | null {
  // Check if the session package is valid:
  if (!verify_session_pkg(group, message, session)) {
    return 'session package invalid'
  }
  // Get the context for the signing session.
  const ctx = get_ext_session_ctx(group, message, session, tweaks)
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

export function combine_session_psigs (
  group   : GroupPackage,
  message : string,
  psigs   : SignaturePackage[],
  session : SessionPackage,
  tweaks? : string[]
) {
  const ctx = get_ext_session_ctx(group, message, session, tweaks)
  return combine_partial_sigs(ctx, psigs)
}

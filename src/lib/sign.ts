import {
  combine_partial_sigs,
  sign_msg,
  verify_partial_sig
} from '@cmdcode/frost/lib'

import { get_pubkey }         from './crypto.js'
import { get_session_member } from './session.js'

import type {
  GroupSigningCtx,
  ShareSignature
} from '@cmdcode/frost'

import type {
  SessionContext,
  SharePackage,
  SignaturePackage
} from '@/types/index.js'

export function create_signature_pkg (
  ctx   : SessionContext,
  share : SharePackage
) : SignaturePackage {
  const sid       = ctx.session.sid
  const mbr_share = get_session_member(ctx.session, share)
  const mbr_psig  = create_share_psig(ctx, mbr_share)
  return { ...mbr_psig, sid }
}

export function verify_signature_pkg (
  ctx  : SessionContext,
  psig : SignaturePackage
) : string | null {
  // Fetch the matching public nonce package for the partial signature.
  const pns = ctx.pnonces.find(e => e.idx === psig.idx)
  // Iterate though each validation check, return null if everyting passes.
  if (pns === undefined) {
    return 'commit package not found for psig idx: ' + psig.idx
  } else if (!verify_partial_sig(ctx, pns, psig.pubkey, psig.psig)) {
    return 'partial signature invalid'
  } else {
    return null
  }
}

export function combine_signature_pkgs (
  ctx   : SessionContext,
  psigs : SignaturePackage[]
) {
  return combine_partial_sigs(ctx, psigs)
}

export function create_share_psig (
  ctx   : GroupSigningCtx,
  share : SharePackage
) : ShareSignature {
  const { idx, binder_sn, hidden_sn, seckey } = share
  const pubkey   = get_pubkey(seckey, 'ecdsa')
  const secshare = { idx, seckey }
  const secnonce = { idx, binder_sn, hidden_sn }
  const psig     = sign_msg(ctx, secshare, secnonce)
  return { ...psig, pubkey }
}

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

/**
 * Create a partial signature package for a given session and share package.
 * 
 * @param ctx   - The session context.
 * @param share - The share package.
 * @returns The partial signature package.
 */
export function create_psig_pkg (
  ctx   : SessionContext,
  share : SharePackage
) : SignaturePackage {
  const sid       = ctx.session.sid
  const mbr_share = get_session_member(ctx.session, share)
  const mbr_psig  = create_share_psig(ctx, mbr_share)
  return { ...mbr_psig, sid }
}

/**
 * Verify a partial signature package for a given session and partial signature package.
 * 
 * @param ctx  - The session context.
 * @param psig - The partial signature package.
 * @returns The signature package.
 */
export function verify_psig_pkg (
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

/**
 * Combine a list of partial signature packages into a single signature package.
 * 
 * @param ctx   - The session context.
 * @param psigs - The partial signature packages.
 * @returns The signature package.
 */
export function combine_signature_pkgs (
  ctx   : SessionContext,
  psigs : SignaturePackage[]
) {
  return combine_partial_sigs(ctx, psigs)
}

/**
 * Create a partial signature for a given session and share package.
 * 
 * @param ctx   - The session context.
 * @param share - The share package.
 * @returns The partial signature.
 */
export function create_share_psig (
  ctx   : GroupSigningCtx,
  share : SharePackage
) : ShareSignature {
  // Get the member's index, secret key, binder nonce, and hidden nonce.
  const { idx, binder_sn, hidden_sn, seckey } = share
  // Get the member's public key.
  const pubkey   = get_pubkey(seckey, 'ecdsa')
  // Create the share signature.
  const secshare = { idx, seckey }
  const secnonce = { idx, binder_sn, hidden_sn }
  const psig     = sign_msg(ctx, secshare, secnonce)
  // Return the partial signature.
  return { ...psig, pubkey }
}

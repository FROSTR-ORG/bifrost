import { get_pubkey }            from './crypto.js'
import { create_session_shares } from './session.js'
import { Assert }                from '@/util/assert.js'

import {
  combine_partial_sigs,
  sign_msg,
  verify_partial_sig
} from '@cmdcode/frost/lib'

import type { GroupSigningCtx } from '@cmdcode/frost'

import type {
  SignSessionContext,
  SharePackage,
  PartialSigPackage,
  PartialSigEntry,
  PartialSigRecord,
  SignatureEntry
} from '@/types/index.js'

/**
 * Create a partial signature package for a given session and share package.
 * 
 * @param ctx   - The session context.
 * @param share - The share package.
 * @returns The partial signature package.
 */
export function create_psig_pkg (
  ctx   : SignSessionContext,
  share : SharePackage
) : PartialSigPackage {
  const sid        = ctx.session.sid
  const pubkey     = get_pubkey(share.seckey, 'ecdsa')
  const sighashes  = ctx.session.hashes.map(e => e[0])
  const sig_shares = create_session_shares(ctx.session, share)
  const psigs      = sighashes.map(sighash => {
    const sig_share = sig_shares.find(e => e.sighash === sighash)
    const sig_ctx   = ctx.sigmap.get(sighash)
    Assert.exists(sig_share, 'share not found for sighash: ' + sighash)
    Assert.exists(sig_ctx,   'context not found for sighash: ' + sighash)
    const psig = create_partial_sig(sig_ctx, sig_share)
    return [ sighash, psig ] as PartialSigEntry
  })
  return { idx : share.idx, psigs, pubkey, sid }
}

/**
 * Verify a partial signature package for a given session and partial signature package.
 * 
 * @param ctx  - The session context.
 * @param psig - The partial signature package.
 * @returns The signature package.
 */
export function verify_psig_pkg (
  ctx : SignSessionContext,
  pkg : PartialSigPackage
) : string | null {
  const { idx, psigs, pubkey, sid } = pkg
  // Check if the session id matches.
  if (sid !== ctx.session.sid)       return 'session id mismatch'
  // Check if the pubkey is in the group.
  if (!ctx.pubkeys.includes(pubkey)) return 'pubkey not found in group'
  // For each entry in the signature context map,
  for (const [ sighash, sigctx ] of ctx.sigmap.entries()) {
    // Get the partial signature entry for the current sighash.
    const psig_entry = psigs.find(e => e[0] === sighash)
    // Check if the partial signature entry is undefined.
    if (psig_entry === undefined) return 'partial signature entry not found for sighash: ' + sighash
    // Get the commit package for the package index.
    const pnonces = sigctx.pnonces.find(e => e.idx === idx)
    // Check if the commit package is undefined.
    if (pnonces === undefined) return 'commit package not found for psig idx: ' + idx
    // Verify the partial signature.
    if (!verify_partial_sig(sigctx, pnonces, pubkey, psig_entry[1])) return 'partial signature invalid'
  }
  // Return null if everything passes.
  return null
}

/**
 * Create a list of partial signature records from a list of partial signature packages.
 * 
 * @param pkgs - The partial signature packages.
 * @returns The partial signature records.
 */
export function create_psig_records (
  pkgs : PartialSigPackage[]
) : PartialSigRecord[] {
  return pkgs.map(({ idx, psigs, pubkey, sid }) => {
    return psigs.map(([ sighash, psig ]) => ({ sighash, idx, pubkey, psig, sid }))
  }).flat()
}

/**
 * Combine a list of partial signature packages into a single signature package.
 * 
 * @param ctx   - The session context.
 * @param psigs - The partial signature packages.
 * @returns The signature package.
 */
export function combine_signature_pkgs (
  ctx  : SignSessionContext,
  pkgs : PartialSigPackage[]
) : SignatureEntry[] {
  const count   = ctx.session.members.length
  const records = create_psig_records(pkgs)
  const sigs : SignatureEntry[] = []
  for (const [ sighash, sigctx ] of ctx.sigmap.entries()) {
    const psigs = records.filter(e => e.sighash === sighash)
    Assert.ok(psigs.length === count, 'missing partial signatures for sighash: ' + sighash)
    const sig   = combine_partial_sigs(sigctx, psigs)
    sigs.push([ sighash, sig ])
  }
  return sigs
}

/**
 * Create a partial signature for a given session and share package.
 * 
 * @param ctx   - The session context.
 * @param share - The share package.
 * @returns The partial signature.
 */
export function create_partial_sig (
  ctx   : GroupSigningCtx,
  share : SharePackage
) : string {
  // Get the member's index, secret key, binder nonce, and hidden nonce.
  const { idx, binder_sn, hidden_sn, seckey } = share
  // Create the share signature.
  const secshare = { idx, seckey }
  const secnonce = { idx, binder_sn, hidden_sn }
  const psig_pkg = sign_msg(ctx, secshare, secnonce)
  // Return the partial signature.
  return psig_pkg.psig
}

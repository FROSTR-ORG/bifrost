import type { GroupSigningCtx } from '@vbyte/frost'

import type { MemberPublicNonce, NoncePackage, SigningNonce } from './nonce.js'

/**
 * A sighash vector containing the hash to sign and optional tweaks.
 * The first element is the sighash (message digest), followed by
 * zero or more tweak values for key derivation.
 *
 * @example
 * // Simple message hash
 * const vec: SighashVector = ['abc123def...']
 *
 * // With BIP-32 style tweaks
 * const vec: SighashVector = ['abc123def...', 'tweak1', 'tweak2']
 */
export type SighashVector = [ sighash : string, ...tweaks : string[] ]

/**
 * A partial signature entry containing the sighash and partial signature.
 * Used in PartialSigPackage to represent individual partial signatures.
 *
 * @example ['abc123...', 'psig456...']
 */
export type PartialSigEntry = [ sighash : string, psig : string ]

/**
 * A signature entry containing the signed hash, group public key, and final signature.
 * This is the result type returned from successful signing operations.
 *
 * @example ['abc123...', '02abc...', 'sig789...']
 */
export type SignatureEntry = [ sighash : string, pubkey : string, signature : string ]

export interface SignerConfig {}

/**
 * Dynamic nonce commit for signing sessions.
 */
export interface SigningNonceCommit extends SigningNonce {
  sid       : string,
  sighash   : string,
  bind_hash : string
}

/**
 * Dynamic nonce share for signing.
 */
export interface SigningNonceShare {
  idx       : number
  seckey    : string
  binder_sn : string
  hidden_sn : string
  sid       : string
  sighash   : string
  bind_hash : string
}

export interface SignSessionConfig {
  content : string | null
  stamp   : number
  type    : string
}

export interface SignRequestConfig extends SignSessionConfig {
  peers : string[]
  /** Number of retry attempts on network failure (default: 1) */
  retries? : number
}

export interface SignSessionTemplate extends SignSessionConfig {
  hashes  : SighashVector[]
  members : number[]
}

/**
 * Sign session package with dynamic nonces.
 *
 * Uses a single `nonces` array of MemberPublicNonce which includes:
 * - idx: member index (identifies whose nonce this is)
 * - binder_pn, hidden_pn: public nonce points
 * - code: derivation code for secret recovery
 */
export interface SignSessionPackage extends SignSessionTemplate {
  gid : string
  sid : string
  /** Nonces from all signers for this session (unified format) */
  nonces? : MemberPublicNonce[]
  /** Optional nonce replenishment for recipients */
  replenish? : NoncePackage[]
}

export interface SignSessionContext {
  pubkeys : string[]
  session : SignSessionPackage
  sigmap : Map<string, GroupSigningCtx>
}

/**
 * Enhanced partial signature package with nonce replenishment.
 */
export interface PartialSigPackage {
  idx     : number
  psigs   : PartialSigEntry[]
  pubkey  : string
  sid     : string
  /** Nonce code used for this signature (for tracking/debugging) */
  nonce_code? : string
  /** Optional nonce replenishment for requester */
  replenish? : NoncePackage
}

export interface PartialSigRecord {
  sighash : string,
  idx     : number,
  pubkey  : string,
  psig    : string
}

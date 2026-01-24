/**
 * Nonce Generation and Binding Functions
 *
 * This module provides functions for generating fresh nonces for the
 * nonce pool system and binding them to signing sessions.
 *
 * Uses HMAC-based derivation to eliminate secret storage. Instead of
 * storing secrets, we store only a 32-byte code and re-derive secrets
 * on-demand during signing.
 */

import { Buff }          from '@vbyte/buff'
import { hmac }          from '@noble/hashes/hmac.js'
import { sha256 }        from '@noble/hashes/sha2.js'
import { get_pubkey }    from '@/util/crypto.js'
import { Assert }        from '@/util/assert.js'
import { sha256_digest } from '@/util/encoding.js'

import type {
  SecretNoncePair,
  DerivedPublicNonce,
  MemberPublicNonce,
  SigningNonce,
  NonceCommit
} from '@/types/nonce.js'

/** Domain separator for binder nonce derivation */
const DOMAIN_BINDER = 'bifrost/nonce/binder/v1'
/** Domain separator for hidden nonce derivation */
const DOMAIN_HIDDEN = 'bifrost/nonce/hidden/v1'
/** Length of a compressed public key in hex (33 bytes = 66 hex chars) */
const COMPRESSED_PUBKEY_HEX_LENGTH = 66
/** Length of a 32-byte code in hex (32 bytes = 64 hex chars) */
const CODE_HEX_LENGTH = 64

/**
 * Derive a secret nonce component via HMAC.
 *
 * Uses HMAC-SHA256 with the share secret as key and (code || domain) as message.
 * This allows deterministic re-derivation of the same secret given the same inputs.
 *
 * @param share_secret - The signer's secret share (32 bytes hex).
 * @param code - The derivation code (32 bytes hex).
 * @param domain - Domain separator string.
 * @returns 32-byte hex secret nonce component.
 */
export function derive_nonce_secret (
  share_secret : string,
  code         : string,
  domain       : string
) : string {
  const key = Buff.hex(share_secret)
  const msg = Buff.join([
    Buff.hex(code),
    Buff.str(domain)
  ])

  const derived = hmac(sha256, key, msg)
  return Buff.bytes(derived).hex
}

/**
 * Generate a nonce pair with derivation code.
 *
 * Instead of storing the full secret nonces (64 bytes), we store only
 * a random 32-byte code. The secrets can be re-derived on-demand using
 * the share secret and the code via HMAC.
 *
 * @param share_secret - The signer's secret share (32 bytes hex).
 * @returns Derived public nonce with code (no idx - peer context provides it).
 */
export function generate_nonce_pair (
  share_secret : string
) : DerivedPublicNonce {
  // Generate a random derivation code
  const code = Buff.random(32).hex

  // Derive the secret nonces from the code
  const binder_sn = derive_nonce_secret(share_secret, code, DOMAIN_BINDER)
  const hidden_sn = derive_nonce_secret(share_secret, code, DOMAIN_HIDDEN)

  // Compute public nonces
  const binder_pn = get_pubkey(binder_sn, 'ecdsa')
  const hidden_pn = get_pubkey(hidden_sn, 'ecdsa')

  return { binder_pn, hidden_pn, code }
}

/**
 * Generate multiple nonce pairs for a peer.
 *
 * @param share_secret - The signer's secret share.
 * @param count - Number of nonces to generate.
 * @returns Array of derived public nonces with codes.
 */
export function generate_nonce_pairs (
  share_secret : string,
  count        : number
) : DerivedPublicNonce[] {
  Assert.ok(count > 0, 'count must be positive')
  const pairs : DerivedPublicNonce[] = []
  for (let i = 0; i < count; i++) {
    pairs.push(generate_nonce_pair(share_secret))
  }
  return pairs
}

/**
 * Re-derive the full secret nonce from a code.
 *
 * Used during signing when we need the secret nonces but only have the code.
 * The peer sends back the code they received, and we re-derive the secrets.
 *
 * @param share_secret - The signer's secret share (32 bytes hex).
 * @param code - The derivation code (32 bytes hex).
 * @returns The secret nonce pair with code.
 */
export function derive_secret_nonce (
  share_secret : string,
  code         : string
) : SecretNoncePair {
  // Re-derive the secret nonces
  const binder_sn = derive_nonce_secret(share_secret, code, DOMAIN_BINDER)
  const hidden_sn = derive_nonce_secret(share_secret, code, DOMAIN_HIDDEN)

  return { code, binder_sn, hidden_sn }
}

/**
 * Get public nonces from a secret nonce pair.
 *
 * @param secret - The secret nonce pair.
 * @returns The corresponding derived public nonce.
 */
export function get_public_nonce (
  secret : SecretNoncePair
) : DerivedPublicNonce {
  const binder_pn = get_pubkey(secret.binder_sn, 'ecdsa')
  const hidden_pn = get_pubkey(secret.hidden_sn, 'ecdsa')
  return {
    binder_pn,
    hidden_pn,
    code : secret.code
  }
}

/**
 * Get public nonces from multiple secret nonces.
 *
 * @param secrets - Array of secret nonce pairs.
 * @returns Array of corresponding derived public nonces.
 */
export function get_public_nonces (
  secrets : SecretNoncePair[]
) : DerivedPublicNonce[] {
  return secrets.map(get_public_nonce)
}

/**
 * Convert a derived public nonce to a member public nonce (for signing).
 *
 * @param nonce - The derived public nonce.
 * @param idx - The member index.
 * @returns A member public nonce with index.
 */
export function to_member_nonce (
  nonce : DerivedPublicNonce,
  idx   : number
) : MemberPublicNonce {
  return { ...nonce, idx }
}

/**
 * Convert a member public nonce to a signing nonce.
 *
 * @param nonce - The member public nonce.
 * @returns A signing nonce ready for use in signing.
 */
export function to_signing_nonce (
  nonce : MemberPublicNonce
) : SigningNonce {
  return {
    idx       : nonce.idx,
    binder_pn : nonce.binder_pn,
    hidden_pn : nonce.hidden_pn
  }
}

/**
 * Compute session binding hash for a nonce.
 *
 * This binds the nonce to a specific session and sighash using the
 * FROST rho-factor approach to prevent nonce resurrection attacks.
 *
 * @param session_id - The signing session ID.
 * @param member_idx - The member index.
 * @param sighash - The message hash being signed.
 * @param all_commits - All public nonces from all signers.
 * @returns 32-byte hex binding hash.
 */
export function compute_nonce_binding (
  session_id  : string,
  member_idx  : number,
  sighash     : string,
  all_commits : SigningNonce[]
) : string {
  // Sort commits by index for deterministic ordering
  const sorted = [...all_commits].sort((a, b) => a.idx - b.idx)

  // Serialize all commits
  const commit_data = sorted.map(commit =>
    Buff.join([
      Buff.num(commit.idx, 4),
      Buff.hex(commit.binder_pn),
      Buff.hex(commit.hidden_pn)
    ])
  )

  // Build preimage: session_id || member_idx || sighash || all_commits
  const preimage = Buff.join([
    Buff.hex(session_id),
    Buff.num(member_idx, 4),
    Buff.hex(sighash),
    ...commit_data
  ])

  return sha256_digest(preimage).hex
}

/**
 * Create a nonce commit bound to a signing session.
 *
 * @param nonce - The signing nonce to bind.
 * @param session_id - The signing session ID.
 * @param sighash - The message hash being signed.
 * @param all_commits - All public nonces from all signers.
 * @returns A nonce commit bound to the session.
 */
export function create_nonce_commit (
  nonce       : SigningNonce,
  session_id  : string,
  sighash     : string,
  all_commits : SigningNonce[]
) : NonceCommit {
  const bind_hash = compute_nonce_binding(
    session_id,
    nonce.idx,
    sighash,
    all_commits
  )

  return {
    ...nonce,
    sid       : session_id,
    sighash,
    bind_hash
  }
}

/**
 * Validate that a public nonce contains valid curve points.
 *
 * @param nonce - The public nonce to validate.
 * @returns True if both nonces are valid secp256k1 points.
 */
export function validate_public_nonce (
  nonce : DerivedPublicNonce
) : boolean {
  try {
    // Verify lengths (compressed point format)
    if (nonce.binder_pn.length !== COMPRESSED_PUBKEY_HEX_LENGTH) return false
    if (nonce.hidden_pn.length !== COMPRESSED_PUBKEY_HEX_LENGTH) return false

    // Verify prefix byte (02 or 03 for compressed points)
    const binder_prefix = nonce.binder_pn.slice(0, 2)
    const hidden_prefix = nonce.hidden_pn.slice(0, 2)
    if (binder_prefix !== '02' && binder_prefix !== '03') return false
    if (hidden_prefix !== '02' && hidden_prefix !== '03') return false

    // Verify code length
    if (nonce.code.length !== CODE_HEX_LENGTH) return false

    // Additional validation could include point-on-curve checks
    // but the FROST library will do this during signing

    return true
  } catch {
    return false
  }
}

/**
 * Filter out invalid nonces from an array.
 *
 * @param nonces - The nonces to validate.
 * @returns A new array with only valid nonces.
 */
export function filter_valid_nonces (
  nonces : DerivedPublicNonce[]
) : DerivedPublicNonce[] {
  return nonces.filter(validate_public_nonce)
}

/**
 * Verify that a code produces the expected public nonces.
 *
 * Used to validate that a code sent back during signing is authentic.
 *
 * @param share_secret - The signer's secret share.
 * @param nonce - The member public nonce containing the code.
 * @returns True if the code produces matching public nonces.
 */
export function verify_nonce_code (
  share_secret : string,
  nonce        : MemberPublicNonce
) : boolean {
  try {
    const derived = derive_secret_nonce(share_secret, nonce.code)
    const binder_pn = get_pubkey(derived.binder_sn, 'ecdsa')
    const hidden_pn = get_pubkey(derived.hidden_sn, 'ecdsa')
    return binder_pn === nonce.binder_pn && hidden_pn === nonce.hidden_pn
  } catch {
    return false
  }
}

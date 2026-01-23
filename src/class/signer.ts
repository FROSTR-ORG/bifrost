import { Buff }            from '@cmdcode/buff'
import { schnorr }         from '@noble/curves/secp256k1'
import { get_pubkey }      from '@/util/crypto.js'
import { create_ecdh_pkg, create_batched_ecdh_pkg } from '@/lib/ecdh.js'
import { get_session_ctx } from '@/lib/session.js'
import { create_psig_pkg } from '@/lib/sign.js'

import {
  decrypt_content,
  encrypt_content,
  get_shared_secret
} from '@cmdcode/nostr-p2p/lib'

import {
  parse_share_pkg,
  parse_group_pkg
} from '@/lib/parse.js'

import type {
  SignerConfig,
  ECDHPackage,
  GroupPackage,
  SecretNoncePair,
  SignSessionPackage,
  SharePackage,
  PartialSigPackage
} from '@/types/index.js'

/**
 * Creates the default configuration for a BifrostSigner.
 * @returns An empty SignerConfig object.
 */
const SIGNER_CONFIG : () => SignerConfig = () => {
  return {}
}

/**
 * BifrostSigner handles low-level cryptographic operations for the FROSTR protocol.
 *
 * This class is responsible for:
 * - Generating partial ECDH shares for threshold key exchange
 * - Creating partial signatures for threshold signing sessions
 * - Encrypting and decrypting content for peer communication
 *
 * The signer holds the node's secret share and uses it to participate in
 * threshold cryptographic operations without ever reconstructing the full secret.
 *
 * @example
 * ```typescript
 * const signer = new BifrostSigner(groupPkg, sharePkg)
 *
 * // Generate ECDH share
 * const ecdhShare = signer.gen_ecdh_share([1, 2, 3], remotePublicKey)
 *
 * // Sign a session
 * const partialSig = signer.sign_session(session)
 * ```
 */
export class BifrostSigner {

  /** Signer configuration options. */
  private readonly _config : SignerConfig
  /** The group package containing group public key and members. */
  private readonly _group  : GroupPackage
  /** The share package containing this signer's secret share. */
  private readonly _share  : SharePackage
  /** This signer's public key in BIP-340 format. */
  private readonly _pubkey : string

  /**
   * Creates a new BifrostSigner instance.
   *
   * @param group - The group package containing the group public key and member info.
   * @param share - The share package containing this signer's secret share and index.
   * @param options - Optional signer configuration.
   */
  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    options? : Partial<SignerConfig>
  ) {
    this._config = { ...SIGNER_CONFIG(), ...options }
    this._group  = parse_group_pkg(group)
    this._share  = parse_share_pkg(share)
    this._pubkey = get_pubkey(this._share.seckey, 'bip340')
  }

  /**
   * Gets the signer configuration.
   * @returns The SignerConfig object.
   */
  get config () {
    return this._config
  }

  /**
   * Gets the group package.
   * @returns The GroupPackage containing group public key and member info.
   */
  get group () {
    return this._group
  }

  /**
   * Gets this signer's member index.
   * @returns The member index in the group.
   */
  get idx () {
    return this._share.idx
  }

  /**
   * Gets this signer's public key in BIP-340 format.
   * @returns The 32-byte hex-encoded public key.
   */
  get pubkey () {
    return this._pubkey
  }

  /**
   * Generates an ECDH share for threshold key exchange.
   *
   * Creates a partial ECDH share that can be combined with shares from
   * other group members to derive a shared secret with a remote public key.
   *
   * @param members - Array of member indexes participating in this ECDH operation.
   * @param ecdh_pk - The remote public key to perform ECDH with (hex-encoded).
   * @returns An ECDHPackage containing the partial ECDH share (single entry).
   */
  gen_ecdh_share (
    members : number[],
    ecdh_pk : string
  ) : ECDHPackage {
    return create_ecdh_pkg(members, ecdh_pk, this._share)
  }

  /**
   * Generates ECDH shares for multiple public keys (batched operation).
   *
   * Creates partial ECDH shares for multiple remote public keys that can
   * be combined with shares from other group members.
   *
   * @param members - Array of member indexes participating in this ECDH operation.
   * @param ecdh_pks - The remote public keys to perform ECDH with (hex-encoded).
   * @returns An ECDHPackage containing partial ECDH shares for all keys.
   */
  gen_batched_ecdh_shares (
    members  : number[],
    ecdh_pks : string[]
  ) : ECDHPackage {
    return create_batched_ecdh_pkg(members, ecdh_pks, this._share)
  }

  /**
   * Signs a message using this signer's secret share directly.
   *
   * Note: This creates a regular Schnorr signature using the share's secret key,
   * NOT a threshold signature. Use `sign_session()` for threshold signing.
   *
   * @param message - The message hash to sign (hex-encoded).
   * @param auxrand - Optional auxiliary randomness for signature generation.
   * @returns The Schnorr signature as a hex string.
   */
  sign_message (
    message  : string,
    auxrand? : string | Uint8Array
  ) : string {
    const sig = schnorr.sign(message, this._share.seckey, auxrand)
    return new Buff(sig).hex
  }

  /**
   * Creates a partial signature for a threshold signing session.
   *
   * Generates a partial signature share that can be combined with shares
   * from other group members to create a valid group signature.
   *
   * @param session - The signing session package containing nonces and message hashes.
   * @param nonce - The secret nonce to use for this signature (from NoncePool).
   * @returns A PartialSigPackage containing the partial signature share.
   */
  sign_session (
    session : SignSessionPackage,
    nonce   : SecretNoncePair
  ) : PartialSigPackage {
    const ctx = get_session_ctx(this._group, session)

    return create_psig_pkg(ctx, this._share, nonce)
  }

  /**
   * Decrypts content that was encrypted for this signer.
   *
   * Uses ECDH with the sender's public key to derive a shared secret,
   * then decrypts the content using ChaCha20-Poly1305.
   *
   * @param content - The encrypted content to decrypt.
   * @param pubkey - The sender's public key used for ECDH.
   * @returns The decrypted content as a string.
   */
  unwrap (
    content : string,
    pubkey  : string
  ) {
    const seckey = this._share.seckey
    const secret = get_shared_secret(seckey, pubkey)
    return decrypt_content(secret, content)
  }

  /**
   * Encrypts content for a specific recipient.
   *
   * Uses ECDH with the recipient's public key to derive a shared secret,
   * then encrypts the content using ChaCha20-Poly1305.
   *
   * @param content - The content to encrypt.
   * @param pubkey - The recipient's public key used for ECDH.
   * @returns The encrypted content as a string.
   */
  wrap (
    content : string,
    pubkey  : string
  ) {
    const seckey = this._share.seckey
    const secret = get_shared_secret(seckey, pubkey)
    return encrypt_content(secret, content)
  }

}

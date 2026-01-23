/**
 * Nonce Pool System Types
 *
 * This module defines the types for the nonce pool system which replaces
 * the previous static nonce scheme. Nonces are now generated dynamically
 * and consumed one-per-signature to prevent key extraction attacks.
 *
 * Type hierarchy:
 * - PublicNonce: base nonce (binder_pn, hidden_pn)
 * - DerivedPublicNonce: with derivation code (for pool storage and nonce packages)
 * - MemberPublicNonce: with member index (for signing wire format only)
 * - SecretNoncePair: with secret values (for signing operations)
 */

/**
 * Base public nonce pair.
 * Contains the public commitments to the secret nonces.
 */
export interface PublicNonce {
  /** Public binder nonce (33 bytes hex, compressed point) */
  binder_pn : string
  /** Public hidden nonce (33 bytes hex, compressed point) */
  hidden_pn : string
}

/**
 * Public nonce with derivation code.
 * Used for pool storage and nonce packages (ping/replenish).
 * The code allows the generator to re-derive secrets on-demand.
 */
export interface DerivedPublicNonce extends PublicNonce {
  /** 32-byte derivation code (hex) */
  code : string
}

/**
 * Public nonce with member index for signing.
 * Used only in wire format during sign requests to identify
 * which member each nonce belongs to.
 */
export interface MemberPublicNonce extends DerivedPublicNonce {
  /** The generator's member index */
  idx : number
}

/**
 * Secret nonce pair for signing operations.
 * Contains the code for identification and the secret values.
 */
export interface SecretNoncePair {
  /** 32-byte derivation code (hex) - identifies this nonce */
  code      : string
  /** Secret binder nonce (32 bytes hex) */
  binder_sn : string
  /** Secret hidden nonce (32 bytes hex) */
  hidden_sn : string
}

/**
 * Nonce package for peer-to-peer exchange (ping/replenish).
 * Just an array of derived public nonces - sender/target are
 * implicit from P2P context.
 */
export type NoncePackage = DerivedPublicNonce[]

/**
 * Health metrics for nonce pools.
 */
export interface NoncePoolStatus {
  /** Peer's member index */
  peer_idx   : number
  /** Peer's public key */
  peer_pk    : string
  /** Number of available nonces from this peer */
  available  : number
  /** Whether pool needs replenishment */
  needs_fill : boolean
  /** Whether pool is critically low */
  critical   : boolean
}

/**
 * Configuration for nonce pool behavior.
 */
export interface NoncePoolConfig {
  /** Target pool size per peer (default: 100) */
  pool_size          : number
  /** Trigger replenishment below this threshold (default: 20) */
  min_threshold      : number
  /** Refuse signing below this threshold (default: 5) */
  critical_threshold : number
  /** Number of nonces to send during replenishment (default: 50) */
  replenish_count    : number
}

/**
 * Default nonce pool configuration values.
 */
export const DEFAULT_NONCE_POOL_CONFIG : NoncePoolConfig = {
  pool_size          : 100,
  min_threshold      : 20,
  critical_threshold : 5,
  replenish_count    : 50
}

/**
 * Nonce pair used during signing operations.
 * Contains the public nonces and member index for binding.
 */
export interface SigningNonce {
  /** Member index of the nonce generator */
  idx       : number
  /** Public binder nonce */
  binder_pn : string
  /** Public hidden nonce */
  hidden_pn : string
}

/**
 * Complete nonce commit for a signing session.
 * Extends SigningNonce with session binding information.
 */
export interface NonceCommit extends SigningNonce {
  /** Session ID this nonce is bound to */
  sid       : string
  /** The sighash this nonce is used for */
  sighash   : string
  /** Binding hash for session-specific tweaking */
  bind_hash : string
}

/**
 * Serialized form of peer nonce state (for persistence).
 */
export interface SerializedPeerNonceState {
  /** Array of derived public nonces */
  nonces : DerivedPublicNonce[]
}

/**
 * Serializable state for nonce pool persistence.
 */
export interface NoncePoolState {
  /** Our member index */
  our_idx  : number
  /** Outgoing nonce states keyed by target peer index */
  outgoing : Record<number, SerializedPeerNonceState>
  /** Incoming nonce states keyed by source peer index */
  incoming : Record<number, SerializedPeerNonceState>
}

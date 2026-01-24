/**
 * NoncePool Class
 *
 * Manages the generation, storage, and consumption of nonces for
 * the FROST threshold signing protocol. Each node maintains pools
 * of nonces for each peer:
 *
 * - Outgoing: Nonces we generate for peers to use when signing
 * - Incoming: Nonces received from peers that we use when signing
 *
 * Uses HMAC-based derivation: only stores codes, not secrets.
 * Secrets are derived on-demand during signing.
 *
 * Simplified design:
 * - Uses code as unique identifier (no separate id field)
 * - No idx stored in pool (peer index is implicit from map key)
 * - No spent sets (deletion from map = consumption)
 */

import { EventEmitter } from './emitter.js'

import {
  generate_nonce_pairs,
  validate_public_nonce,
  derive_secret_nonce,
  verify_nonce_code,
  to_member_nonce
} from '@/lib/nonce.js'

import type {
  SecretNoncePair,
  DerivedPublicNonce,
  MemberPublicNonce,
  NoncePackage,
  NoncePoolConfig,
  NoncePoolStatus,
  NoncePoolState
} from '@/types/nonce.js'

import type { MemberPackage } from '@/types/group.js'

/**
 * Events emitted by the NoncePool.
 */
export interface NoncePoolEvent {
  /** Emitted when pool needs replenishment */
  'needs_replenish' : [ peer_idx: number, count: number ]
  /** Emitted when pool is critically low */
  'critical_low'    : [ peer_idx: number, available: number ]
  /** Emitted when nonces are consumed */
  'nonces_consumed' : [ peer_idx: number, count: number ]
  /** Emitted when nonces are received */
  'nonces_received' : [ peer_idx: number, count: number ]
}

/**
 * NoncePool manages nonce generation and consumption for FROST signing.
 *
 * Uses HMAC-based derivation - we store only codes, not secrets.
 * Secrets are re-derived on-demand when needed for signing.
 *
 * Simplified design uses code as the unique key and removes spent tracking.
 */
export class NoncePool extends EventEmitter<NoncePoolEvent> {

  /** Our member index */
  private readonly _our_idx : number
  /** Our secret share for deriving nonces */
  private readonly _seckey  : string
  /** Pool configuration */
  private readonly _config  : NoncePoolConfig
  /** Outgoing nonces (we generated for peers) - Map<peer_idx, Map<code, DerivedPublicNonce>> */
  private readonly _outgoing : Map<number, Map<string, DerivedPublicNonce>>
  /** Incoming nonces (received from peers) - Map<peer_idx, Map<code, DerivedPublicNonce>> */
  private readonly _incoming : Map<number, Map<string, DerivedPublicNonce>>

  /**
   * Creates a new NoncePool.
   *
   * @param our_idx - Our member index.
   * @param seckey - Our secret key for nonce derivation.
   * @param config - Pool configuration options.
   */
  constructor (
    our_idx : number,
    seckey  : string,
    config  : Partial<NoncePoolConfig> = {}
  ) {
    super()
    this._our_idx  = our_idx
    this._seckey   = seckey
    this._config   = { ...get_default_config(), ...config }
    this._outgoing = new Map()
    this._incoming = new Map()
  }

  /**
   * Gets the pool configuration.
   */
  get config () : NoncePoolConfig {
    return this._config
  }

  /**
   * Gets our member index.
   */
  get our_idx () : number {
    return this._our_idx
  }

  /**
   * Initialize pools for a set of peers.
   *
   * @param members - Array of member packages to initialize pools for.
   */
  init_peers (members : MemberPackage[]) : void {
    for (const member of members) {
      if (member.idx === this._our_idx) continue
      this._init_outgoing(member.idx)
      this._init_incoming(member.idx)
    }
  }

  /**
   * Initialize outgoing state for a peer.
   */
  private _init_outgoing (peer_idx : number) : void {
    if (this._outgoing.has(peer_idx)) return
    this._outgoing.set(peer_idx, new Map())
  }

  /**
   * Initialize incoming state for a peer.
   */
  private _init_incoming (peer_idx : number) : void {
    if (this._incoming.has(peer_idx)) return
    this._incoming.set(peer_idx, new Map())
  }

  /**
   * Generate nonces for a peer and return them for transmission.
   *
   * Only stores the derivation codes, not the secrets.
   * Secrets are derived on-demand when needed for signing.
   *
   * @param peer_idx - The target peer's member index.
   * @param count - Number of nonces to generate (default: replenish_count).
   * @returns Array of derived public nonces (NoncePackage) for the peer.
   */
  generate_for_peer (
    peer_idx : number,
    count    : number = this._config.replenish_count
  ) : NoncePackage {
    this._init_outgoing(peer_idx)
    const state = this._outgoing.get(peer_idx)!

    // Generate new nonce pairs (public nonces with codes)
    const nonces = generate_nonce_pairs(this._seckey, count)

    // Store by code
    for (const nonce of nonces) {
      state.set(nonce.code, nonce)
    }

    // Return as NoncePackage (just the array)
    return nonces
  }

  /**
   * Store incoming nonces from a peer.
   * Validates each nonce before storing.
   *
   * @param peer_idx - The source peer's member index.
   * @param nonces - The nonces received from the peer.
   * @returns Number of valid nonces stored.
   */
  store_incoming (peer_idx : number, nonces : NoncePackage) : number {
    this._init_incoming(peer_idx)
    const state = this._incoming.get(peer_idx)!

    let stored = 0
    for (const nonce of nonces) {
      // Validate the nonce (checks point format and code length)
      if (!validate_public_nonce(nonce)) {
        continue
      }

      // Check if already stored (by code)
      if (state.has(nonce.code)) {
        continue
      }

      // Store the nonce by code
      state.set(nonce.code, nonce)
      stored++
    }

    if (stored > 0) {
      this.emit('nonces_received', [ peer_idx, stored ])
    }

    return stored
  }

  /**
   * Consume a nonce from a peer for signing.
   * Returns the nonce as a MemberPublicNonce (with idx) for the signing wire format.
   *
   * @param peer_idx - The source peer's member index.
   * @returns The consumed nonce with idx, or null if none available.
   */
  consume_incoming (peer_idx : number) : MemberPublicNonce | null {
    const state = this._incoming.get(peer_idx)
    if (!state) return null

    // Get first available nonce
    const entry = state.entries().next()
    if (entry.done) return null

    const [ code, nonce ] = entry.value

    // Remove from available (deletion = consumption, no spent set needed)
    state.delete(code)

    // Emit events
    this.emit('nonces_consumed', [ peer_idx, 1 ])

    // Check thresholds
    const available = state.size
    if (available <= this._config.critical_threshold) {
      this.emit('critical_low', [ peer_idx, available ])
    } else if (available <= this._config.min_threshold) {
      this.emit('needs_replenish', [ peer_idx, this._config.replenish_count ])
    }

    // Return as MemberPublicNonce with idx for wire format
    return to_member_nonce(nonce, peer_idx)
  }

  /**
   * Mark an outgoing nonce as spent (used in a signature).
   * Simply removes it from the outgoing pool.
   *
   * @param peer_idx - The peer who used the nonce.
   * @param code - The code of the spent nonce.
   */
  mark_spent (peer_idx : number, code : string) : void {
    const state = this._outgoing.get(peer_idx)
    if (!state) return

    // Remove the nonce (deletion = spent)
    state.delete(code)
  }

  /**
   * Check if we should send nonces to a peer.
   *
   * This checks the OUTGOING pool - do we have enough active nonces for this peer?
   * If we don't know their state, assume they need everything.
   *
   * @param peer_idx - The peer to check.
   * @returns True if we should send nonces to this peer.
   */
  should_send_nonces_to (peer_idx : number) : boolean {
    const state = this._outgoing.get(peer_idx)
    // If no state, we've never sent them anything - they need nonces
    if (!state) return true
    // Count active nonces
    const active = state.size
    return active < this._config.min_threshold
  }

  /**
   * Check if we need nonces from a peer.
   *
   * This checks the INCOMING pool - do we have enough nonces from this peer?
   *
   * @param peer_idx - The peer to check.
   * @returns True if we need more nonces from this peer.
   */
  needs_nonces_from (peer_idx : number) : boolean {
    const state = this._incoming.get(peer_idx)
    if (!state) return true
    return state.size < this._config.min_threshold
  }

  /**
   * Check if we can sign with a peer (have enough nonces).
   *
   * @param peer_idx - The peer to check.
   * @returns True if we have nonces above critical threshold.
   */
  can_sign (peer_idx : number) : boolean {
    const state = this._incoming.get(peer_idx)
    if (!state) return false
    return state.size > this._config.critical_threshold
  }

  /**
   * Get the count of available nonces from a peer.
   *
   * @param peer_idx - The peer to check.
   * @returns Number of available nonces.
   */
  get_available_count (peer_idx : number) : number {
    const state = this._incoming.get(peer_idx)
    if (!state) return 0
    return state.size
  }

  /**
   * Get the count of active nonces we've sent to a peer.
   *
   * @param peer_idx - The peer to check.
   * @returns Number of active (non-spent) nonces.
   */
  get_outgoing_count (peer_idx : number) : number {
    const state = this._outgoing.get(peer_idx)
    if (!state) return 0
    return state.size
  }

  /**
   * Get pool status for all peers.
   *
   * @param peer_pks - Map of peer index to pubkey.
   * @returns Array of pool status objects.
   */
  get_pool_status (peer_pks : Map<number, string>) : NoncePoolStatus[] {
    const statuses : NoncePoolStatus[] = []

    for (const [ peer_idx, peer_pk ] of peer_pks) {
      if (peer_idx === this._our_idx) continue

      const available  = this.get_available_count(peer_idx)
      const needs_fill = available < this._config.min_threshold
      const critical   = available <= this._config.critical_threshold

      statuses.push({
        peer_idx,
        peer_pk,
        available,
        needs_fill,
        critical
      })
    }

    return statuses
  }

  /**
   * Derive a secret nonce from a code for signing.
   *
   * Instead of storing secrets, we re-derive them from codes.
   * The peer sends back the nonce they received, and we derive the secret.
   *
   * @param peer_idx - The peer who sent back the nonce.
   * @param nonce - The member public nonce containing the code.
   * @returns The derived secret nonce, or null if invalid.
   */
  derive_secret_for_signing (
    peer_idx : number,
    nonce    : MemberPublicNonce
  ) : SecretNoncePair | null {
    const state = this._outgoing.get(peer_idx)
    if (!state) return null

    // Verify the code exists in our outgoing pool
    const stored = state.get(nonce.code)
    if (!stored) {
      return null
    }

    // Verify the code produces the expected public nonces
    if (!verify_nonce_code(this._seckey, nonce)) {
      return null
    }

    // Derive and return the secret nonce
    return derive_secret_nonce(this._seckey, nonce.code)
  }

  /**
   * Get a secret nonce for signing.
   *
   * Looks up the code and derives the secret on-demand.
   * Used when we need to produce our partial signature.
   *
   * @param peer_idx - The peer who will use this nonce.
   * @param code - The code of the nonce to retrieve.
   * @returns The secret nonce, or null if not found.
   */
  get_secret_nonce (peer_idx : number, code : string) : SecretNoncePair | null {
    const state = this._outgoing.get(peer_idx)
    if (!state) return null

    const nonce = state.get(code)
    if (!nonce) return null

    // Derive the secret from the stored code
    return derive_secret_nonce(this._seckey, code)
  }

  /**
   * Get all available public nonces from a peer.
   *
   * @param peer_idx - The peer to get nonces from.
   * @returns Array of available derived public nonces.
   */
  get_available_nonces (peer_idx : number) : DerivedPublicNonce[] {
    const state = this._incoming.get(peer_idx)
    if (!state) return []
    return Array.from(state.values())
  }

  /**
   * Get peers we should send nonces to.
   *
   * @returns Array of peer indexes needing nonces from us.
   */
  get_peers_to_replenish () : number[] {
    const peers : number[] = []
    for (const [ peer_idx ] of this._outgoing) {
      if (this.should_send_nonces_to(peer_idx)) {
        peers.push(peer_idx)
      }
    }
    return peers
  }

  /**
   * Get peers we need nonces from.
   *
   * @returns Array of peer indexes we need nonces from.
   */
  get_peers_we_need_from () : number[] {
    const peers : number[] = []
    for (const [ peer_idx ] of this._incoming) {
      if (this.needs_nonces_from(peer_idx)) {
        peers.push(peer_idx)
      }
    }
    return peers
  }

  /**
   * Get peers that we can sign with.
   *
   * @returns Array of peer indexes we can sign with.
   */
  get_signable_peers () : number[] {
    const peers : number[] = []
    for (const [ peer_idx ] of this._incoming) {
      if (this.can_sign(peer_idx)) {
        peers.push(peer_idx)
      }
    }
    return peers
  }

  /**
   * Clear all pool state.
   * Used when reinitializing after disconnect.
   */
  clear () : void {
    this._outgoing.clear()
    this._incoming.clear()
  }

  /**
   * Export pool state for persistence.
   *
   * @returns Serializable pool state.
   */
  export () : NoncePoolState {
    const outgoing : NoncePoolState['outgoing'] = {}
    const incoming : NoncePoolState['incoming'] = {}

    for (const [ idx, state ] of this._outgoing) {
      outgoing[idx] = {
        nonces : Array.from(state.values())
      }
    }

    for (const [ idx, state ] of this._incoming) {
      incoming[idx] = {
        nonces : Array.from(state.values())
      }
    }

    return {
      our_idx  : this._our_idx,
      outgoing,
      incoming
    }
  }

  /**
   * Import pool state from persistence.
   *
   * @param state - The state to import.
   */
  import (state : NoncePoolState) : void {
    // Validate our_idx matches
    if (state.our_idx !== this._our_idx) {
      throw new Error('pool state our_idx mismatch')
    }

    // Clear existing state
    this.clear()

    // Import outgoing state
    for (const [ idx_str, saved ] of Object.entries(state.outgoing)) {
      const idx = parseInt(idx_str, 10)
      if (Number.isNaN(idx)) {
        throw new Error(`invalid peer index in outgoing state: ${idx_str}`)
      }
      const map = new Map<string, DerivedPublicNonce>()
      for (const nonce of saved.nonces) {
        map.set(nonce.code, nonce)
      }
      this._outgoing.set(idx, map)
    }

    // Import incoming state
    for (const [ idx_str, saved ] of Object.entries(state.incoming)) {
      const idx = parseInt(idx_str, 10)
      if (Number.isNaN(idx)) {
        throw new Error(`invalid peer index in incoming state: ${idx_str}`)
      }
      const map = new Map<string, DerivedPublicNonce>()
      for (const nonce of saved.nonces) {
        map.set(nonce.code, nonce)
      }
      this._incoming.set(idx, map)
    }
  }
}

/**
 * Get default nonce pool configuration.
 */
function get_default_config () : NoncePoolConfig {
  return {
    pool_size          : 100,
    min_threshold      : 20,
    critical_threshold : 5,
    replenish_count    : 50
  }
}

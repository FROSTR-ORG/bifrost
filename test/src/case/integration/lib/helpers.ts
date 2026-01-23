/**
 * Integration Test Helpers
 *
 * Utilities for testing nonce pool behavior, event tracking,
 * and test data generation.
 */

import { Buff }           from '@cmdcode/buff'
import { schnorr }        from '@noble/curves/secp256k1'

import type { BifrostNode }    from '@/class/client.js'
import type { SighashVector }  from '@/types/sign.js'
import type { TestNodeMap }    from '@/test/types.js'

/**
 * Drain a node's incoming nonce pool to a target count.
 *
 * @param node - The node whose pool to drain
 * @param peer_idx - The peer index to drain nonces for
 * @param target - Target number of available nonces to keep
 */
export function drain_pool_to (
  node     : BifrostNode,
  peer_idx : number,
  target   : number
) : void {
  while (node.pool.get_available_count(peer_idx) > target) {
    node.pool.consume_incoming(peer_idx)
  }
}

/**
 * Get peer index from a node for a given pubkey.
 *
 * @param node - The node to query
 * @param pubkey - The pubkey to find
 * @returns The peer's member index or undefined
 */
export function get_peer_idx (
  node   : BifrostNode,
  pubkey : string
) : number | undefined {
  const member = node.group.members.find(m => {
    // Handle both formats - compare last 64 chars (x-coordinate)
    const norm_m = m.pubkey.slice(-64)
    const norm_p = pubkey.slice(-64)
    return norm_m === norm_p
  })
  return member?.idx
}

/**
 * Wait for nonce pools to be initialized via ping exchange.
 * This performs a full ping mesh between all nodes, with multiple rounds
 * to ensure pools are properly populated.
 *
 * Due to a known issue with bidirectional nonce exchange in the ping protocol,
 * this function falls back to direct pool population if pings don't succeed.
 *
 * @param nodes - Map of node names to BifrostNode instances
 */
export async function setup_nonce_pools (
  nodes : TestNodeMap
) : Promise<void> {
  const nodeList = Array.from(nodes.values())
  const min_nonces = 10  // Minimum nonces needed per peer

  // First try ping-based exchange (2 rounds)
  for (let round = 0; round < 2; round++) {
    for (const sender of nodeList) {
      for (const receiver of nodeList) {
        if (sender.pubkey !== receiver.pubkey) {
          await sender.req.ping(receiver.pubkey)
        }
      }
    }
    await sleep(100)
  }

  // Check if pools are sufficiently populated
  let needs_direct_populate = false
  for (const node of nodeList) {
    for (const other of nodeList) {
      if (node.pubkey === other.pubkey) continue
      const peer_idx = get_peer_idx(node, other.pubkey)
      if (peer_idx !== undefined) {
        const count = node.pool.get_available_count(peer_idx)
        if (count < min_nonces) {
          needs_direct_populate = true
          break
        }
      }
    }
    if (needs_direct_populate) break
  }

  // Fall back to direct population if needed
  if (needs_direct_populate) {
    populate_nonce_pools(nodes)
  }

  // Final delay
  await sleep(100)
}

/**
 * Event Tracker for monitoring node events during tests.
 */
export class EventTracker {
  private _counts : Map<string, number> = new Map()
  private _events : Map<string, unknown[][]> = new Map()
  private _listeners : Array<() => void> = []

  /**
   * Start tracking an event on a node.
   *
   * @param node - The node to track events on
   * @param event - The event name to track
   */
  track (node : BifrostNode, event : string) : void {
    const listener = (...args: unknown[]) => {
      const count = this._counts.get(event) ?? 0
      this._counts.set(event, count + 1)

      const events = this._events.get(event) ?? []
      events.push(args)
      this._events.set(event, events)
    }

    node.on(event as any, listener)
    this._listeners.push(() => node.off(event as any, listener))
  }

  /**
   * Track a pool event (needs_replenish, critical_low, etc).
   */
  track_pool (node : BifrostNode, event : string) : void {
    const listener = (...args: unknown[]) => {
      const count = this._counts.get(event) ?? 0
      this._counts.set(event, count + 1)

      const events = this._events.get(event) ?? []
      events.push(args)
      this._events.set(event, events)
    }

    node.pool.on(event as any, listener)
    this._listeners.push(() => node.pool.off(event as any, listener))
  }

  /**
   * Get the count of times an event was emitted.
   */
  count (event : string) : number {
    return this._counts.get(event) ?? 0
  }

  /**
   * Get all captured event data for an event.
   */
  get_events (event : string) : unknown[][] {
    return this._events.get(event) ?? []
  }

  /**
   * Clear all tracked events and counts.
   */
  clear () : void {
    this._counts.clear()
    this._events.clear()
  }

  /**
   * Remove all event listeners.
   */
  cleanup () : void {
    this._listeners.forEach(fn => fn())
    this._listeners = []
    this.clear()
  }
}

/**
 * Generate test sighash vectors.
 *
 * @param count - Number of vectors to generate
 * @returns Array of SighashVector tuples
 */
export function generate_messages (count : number) : SighashVector[] {
  const messages : SighashVector[] = []
  for (let i = 0; i < count; i++) {
    messages.push([ Buff.random(32).hex, Buff.random(32).hex ])
  }
  return messages
}

/**
 * Generate valid secp256k1 public keys for ECDH testing.
 * These are proper BIP-340 x-only pubkeys derived from random secret keys.
 *
 * @param count - Number of pubkeys to generate
 * @returns Array of hex-encoded x-only public keys
 */
export function generate_ecdh_pubkeys (count : number) : string[] {
  const pubkeys : string[] = []
  for (let i = 0; i < count; i++) {
    // Generate a random secret key and derive its public key
    const seckey = Buff.random(32).hex
    const pubkey = Buff.bytes(schnorr.getPublicKey(seckey)).hex
    pubkeys.push(pubkey)
  }
  return pubkeys
}

/**
 * Measure execution time of an async function.
 *
 * @param fn - The async function to measure
 * @returns Object with result and duration in ms
 */
export async function measure_time<T> (
  fn : () => Promise<T>
) : Promise<{ result: T, duration: number }> {
  const start = performance.now()
  const result = await fn()
  const duration = performance.now() - start
  return { result, duration }
}

/**
 * Wait for a condition to become true.
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in ms
 * @param interval - Check interval in ms
 */
export async function wait_for (
  condition : () => boolean,
  timeout   : number = 5000,
  interval  : number = 100
) : Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('wait_for timeout exceeded')
    }
    await sleep(interval)
  }
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep (ms : number) : Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get a random node from the map (excluding specified pubkeys).
 */
export function get_random_node (
  nodes   : TestNodeMap,
  exclude : string[] = []
) : BifrostNode {
  const available = Array.from(nodes.values()).filter(n => !exclude.includes(n.pubkey))
  if (available.length === 0) {
    throw new Error('no available nodes')
  }
  return available[Math.floor(Math.random() * available.length)]
}

/**
 * Assert all nodes can sign with each other (have sufficient nonces).
 */
export function assert_can_sign (nodes : TestNodeMap) : boolean {
  for (const node of nodes.values()) {
    const signable = node.pool.get_signable_peers()
    // Should be able to sign with at least threshold - 1 peers
    const required = node.group.threshold - 1
    if (signable.length < required) {
      return false
    }
  }
  return true
}

/**
 * Directly populate nonce pools between nodes.
 *
 * This bypasses the ping mechanism and directly generates/stores nonces
 * between all node pairs. Use this when ping-based exchange isn't reliable.
 *
 * @param nodes - Map of node names to BifrostNode instances
 * @param count - Number of nonces to generate per peer pair (default: 50)
 */
export function populate_nonce_pools (
  nodes : TestNodeMap,
  count : number = 50
) : void {
  const nodeList = Array.from(nodes.values())

  // For each pair of nodes, generate and exchange nonces directly
  for (const sender of nodeList) {
    for (const receiver of nodeList) {
      if (sender.pubkey === receiver.pubkey) continue

      // Get receiver's index from sender's perspective
      const receiver_idx = get_peer_idx(sender, receiver.pubkey)
      if (receiver_idx === undefined) continue

      // Get sender's index from receiver's perspective
      const sender_idx = get_peer_idx(receiver, sender.pubkey)
      if (sender_idx === undefined) continue

      // Generate nonces from sender FOR receiver
      // generate_for_peer now returns NoncePackage (DerivedPublicNonce[])
      const nonces = sender.pool.generate_for_peer(receiver_idx, count)

      // Store those nonces in receiver's incoming pool from sender
      // store_incoming now takes (peer_idx, nonces)
      receiver.pool.store_incoming(sender_idx, nonces)
    }
  }
}

/**
 * Replenish nonce pools for a specific node from all peers.
 *
 * @param node - The node to replenish pools for
 * @param nodes - All nodes in the network
 * @param count - Number of nonces to add
 */
export function replenish_pools_for (
  node   : BifrostNode,
  nodes  : TestNodeMap,
  count  : number = 50
) : void {
  const nodeList = Array.from(nodes.values())

  for (const peer of nodeList) {
    if (peer.pubkey === node.pubkey) continue

    const peer_idx = get_peer_idx(node, peer.pubkey)
    const our_idx  = get_peer_idx(peer, node.pubkey)

    if (peer_idx === undefined || our_idx === undefined) continue

    // Peer generates nonces for us
    // generate_for_peer now returns NoncePackage (DerivedPublicNonce[])
    const nonces = peer.pool.generate_for_peer(our_idx, count)

    // We store them with peer_idx
    // store_incoming now takes (peer_idx, nonces)
    node.pool.store_incoming(peer_idx, nonces)
  }
}

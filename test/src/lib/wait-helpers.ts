/**
 * Wait Helpers
 *
 * Event-driven waiting utilities to replace arbitrary sleeps in tests.
 */

import type { BifrostNode } from '@/index.js'

/** Default timeout for wait operations */
const DEFAULT_TIMEOUT_MS = 10000

/** Default poll interval for condition checking */
const DEFAULT_POLL_INTERVAL_MS = 50

/**
 * Wait for a condition to become true.
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in ms (default: 10000)
 * @param interval - Check interval in ms (default: 50)
 * @throws Error if timeout is exceeded
 */
export async function wait_for_condition (
  condition : () => boolean,
  timeout   : number = DEFAULT_TIMEOUT_MS,
  interval  : number = DEFAULT_POLL_INTERVAL_MS
) : Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`wait_for_condition timeout exceeded (${timeout}ms)`)
    }
    await wait_ms(interval)
  }
}

/**
 * Wait for a specified number of milliseconds.
 *
 * @param ms - Number of milliseconds to wait
 */
export function wait_ms (ms : number) : Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wait for a node to have sufficient nonces from all peers.
 *
 * @param node - The BifrostNode to check
 * @param minPerPeer - Minimum nonces required per peer (default: 10)
 * @param timeout - Maximum time to wait in ms (default: 10000)
 */
export async function wait_for_nonces (
  node       : BifrostNode,
  minPerPeer : number = 10,
  timeout    : number = DEFAULT_TIMEOUT_MS
) : Promise<void> {
  const condition = () => {
    const signable = node.pool.get_signable_peers()
    const required = node.group.threshold - 1
    return signable.length >= required && signable.every(peer => {
      return node.pool.get_available_count(peer) >= minPerPeer
    })
  }
  await wait_for_condition(condition, timeout)
}

/**
 * Wait for all nodes to have sufficient nonces for signing.
 *
 * @param nodes - Array of BifrostNodes to check
 * @param minPerPeer - Minimum nonces required per peer (default: 10)
 * @param timeout - Maximum time to wait in ms (default: 10000)
 */
export async function wait_for_all_nonces (
  nodes      : BifrostNode[],
  minPerPeer : number = 10,
  timeout    : number = DEFAULT_TIMEOUT_MS
) : Promise<void> {
  await Promise.all(nodes.map(node => wait_for_nonces(node, minPerPeer, timeout)))
}

/**
 * Wait for a node to connect to relays.
 *
 * @param node - The BifrostNode to check
 * @param timeout - Maximum time to wait in ms (default: 10000)
 */
export async function wait_for_connection (
  node    : BifrostNode,
  timeout : number = DEFAULT_TIMEOUT_MS
) : Promise<void> {
  const condition = () => node.client.connected
  await wait_for_condition(condition, timeout)
}

/**
 * Wait for all nodes to connect to relays.
 *
 * @param nodes - Array of BifrostNodes to check
 * @param timeout - Maximum time to wait in ms (default: 10000)
 */
export async function wait_for_all_connections (
  nodes   : BifrostNode[],
  timeout : number = DEFAULT_TIMEOUT_MS
) : Promise<void> {
  await Promise.all(nodes.map(node => wait_for_connection(node, timeout)))
}

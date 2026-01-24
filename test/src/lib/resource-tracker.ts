/**
 * Resource Tracker
 *
 * Tracks test resources (BifrostNode, NostrRelay) and ensures ordered cleanup.
 * Cleanup order: Nodes first (they use relays), Relays last.
 * Errors are suppressed during cleanup to ensure all resources are attempted.
 */

import type { BifrostNode } from '@/index.js'
import type { NostrRelay }  from './relay.js'

/** Delay between cleanup phases to allow close frames to propagate */
const CLEANUP_PHASE_DELAY_MS = 150

/**
 * Track and manage test resources for proper cleanup.
 */
export class ResourceTracker {
  private readonly _nodes  : BifrostNode[] = []
  private readonly _relays : NostrRelay[]  = []

  /**
   * Track a BifrostNode for cleanup.
   */
  trackNode (node : BifrostNode) : void {
    this._nodes.push(node)
  }

  /**
   * Track a NostrRelay for cleanup.
   */
  trackRelay (relay : NostrRelay) : void {
    this._relays.push(relay)
  }

  /**
   * Track multiple BifrostNodes for cleanup.
   */
  trackNodes (nodes : BifrostNode[]) : void {
    for (const node of nodes) {
      this._nodes.push(node)
    }
  }

  /**
   * Track multiple NostrRelays for cleanup.
   */
  trackRelays (relays : NostrRelay[]) : void {
    for (const relay of relays) {
      this._relays.push(relay)
    }
  }

  /**
   * Get the number of tracked nodes.
   */
  get nodeCount () : number {
    return this._nodes.length
  }

  /**
   * Get the number of tracked relays.
   */
  get relayCount () : number {
    return this._relays.length
  }

  /**
   * Perform ordered cleanup of all tracked resources.
   *
   * Order: Nodes first (they use relays), then relays.
   * Errors are suppressed to ensure all resources are attempted.
   */
  async cleanup () : Promise<void> {
    // Phase 1: Close all nodes
    for (const node of this._nodes) {
      try {
        await node.close()
      } catch {
        // Suppress errors during cleanup
      }
    }

    // Wait for close frames to propagate
    await this._delay(CLEANUP_PHASE_DELAY_MS)

    // Phase 2: Close all relays
    for (const relay of this._relays) {
      try {
        relay.close()
      } catch {
        // Suppress errors during cleanup
      }
    }

    // Wait for final cleanup
    await this._delay(CLEANUP_PHASE_DELAY_MS)

    // Clear tracked resources
    this._nodes.length = 0
    this._relays.length = 0
  }

  /**
   * Internal delay helper.
   */
  private _delay (ms : number) : Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

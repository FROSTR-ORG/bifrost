/**
 * Onboarding Types
 *
 * This module defines types for the node onboarding process.
 * When a new node joins the group, it needs to:
 * 1. Receive its SharePackage (via out-of-band QR code or secure channel)
 * 2. Connect to relays and contact a peer for onboarding
 * 3. Receive the GroupPackage and initial nonces from the peer
 */

import type { GroupPackage, SharePackage } from './group.js'
import type { NoncePackage }               from './nonce.js'

/**
 * Complete package for bootstrapping a new node.
 * Distributed via QR code or other out-of-band method.
 */
export interface OnboardPackage {
  /** The node's secret share */
  share   : SharePackage
  /** Public key of peer to contact for onboarding */
  peer_pk : string
  /** Relay URLs to use for communication */
  relays  : string[]
}

/**
 * Request sent by a new node to an existing peer for onboarding.
 */
export interface OnboardRequest {
  /** The requesting node's share public key */
  share_pk : string
  /** The requesting node's member index */
  idx      : number
}

/**
 * Response from an existing peer to a new node during onboarding.
 */
export interface OnboardResponse {
  /** The group package with all member info */
  group     : GroupPackage
  /** Initial nonces for the new node from this peer */
  nonces    : NoncePackage
  /** Status message */
  status    : 'ok' | 'error'
  /** Error message if status is 'error' */
  error?    : string
}

/**
 * Extended onboard response with nonces from all available peers.
 * Used when the onboarding peer proxies nonces from other online peers.
 */
export interface FullOnboardResponse extends OnboardResponse {
  /** Additional nonces from other peers (optional) */
  peer_nonces? : NoncePackage[]
}

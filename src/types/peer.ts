import type { NoncePackage, NoncePoolStatus } from './nonce.js'

// Re-export PING_PROTOCOL_VERSION from const.ts for backward compatibility
export { PING_PROTOCOL_VERSION } from '@/const.js'

export type PeerStatus = 'online' | 'offline'

export interface PeerPolicy {
  send : boolean,
  recv : boolean
}

export interface PeerConfig {
  policy : PeerPolicy,
  pubkey : string
}

export interface PeerData extends PeerConfig {
  status  : PeerStatus,
  updated : number
}

/**
 * Enhanced ping request payload with nonce pool information.
 */
export interface PingRequest {
  /** Protocol version for compatibility checking */
  version      : number
  /** Nonce pool status for each peer */
  pool_status? : NoncePoolStatus[]
  /** Nonce package for replenishment (just array of nonces, sender implicit) */
  nonces?      : NoncePackage
}

/**
 * Enhanced ping response payload with nonce pool information.
 */
export interface PingResponse {
  /** Our policy for the requesting peer */
  policy       : PeerPolicy
  /** Nonce pool status for each peer */
  pool_status? : NoncePoolStatus[]
  /** Nonce package for replenishment (just array of nonces, sender implicit) */
  nonces?      : NoncePackage
}


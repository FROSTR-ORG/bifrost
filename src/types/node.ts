import type { BifrostNode }   from '@/class/client.js'
import type { RpcMessageData } from '@vbyte/nostr-sdk'

import type {
  ECDHPackage,
  NoncePoolConfig,
  OnboardResponse,
  PeerConfig,
  PeerData,
  PeerPolicy,
  SignatureEntry,
  SignSessionPackage
} from '@/types/index.js'

/**
 * Middleware functions for filtering and transforming requests.
 *
 * Middleware is called before processing incoming requests, allowing
 * custom validation, logging, or message transformation.
 *
 * @property ecdh - Optional middleware for ECDH requests.
 * @property sign - Optional middleware for signing requests.
 */
export interface BifrostNodeMiddleware {
  ecdh? : (client : BifrostNode, msg : RpcMessageData) => RpcMessageData
  sign? : (client : BifrostNode, msg : RpcMessageData) => RpcMessageData
}

/**
 * Configuration for the underlying @vbyte/nostr-sdk NostrNode.
 *
 * @property msg_timeout - Connection/message timeout in milliseconds (default: 15000).
 * @property sub_timeout - Subscription timeout in milliseconds (default: 30000).
 * @property max_retries - Maximum retry count for failed operations.
 */
export interface NodeConfig {
  msg_timeout? : number
  sub_timeout? : number
  max_retries? : number
}

/**
 * Options for creating a BifrostNode. All fields are optional with sensible defaults.
 *
 * @property debug - Enable debug logging (default: false).
 * @property middleware - Request middleware functions.
 * @property policies - Per-peer send/receive policies.
 * @property default_policy - Default policy for peers not in policies list (default: { send: true, recv: true }).
 * @property sign_interval - Signature batch interval in milliseconds (default: 100).
 * @property max_sign_batch - Max signatures per batch (default: 100).
 * @property ecdh_interval - ECDH batch interval in milliseconds (default: 100).
 * @property max_ecdh_batch - Max ECDH operations per batch (default: 100).
 * @property pool_config - Nonce pool configuration.
 * @property node_config - NostrNode SDK configuration.
 */
export interface BifrostNodeOptions {
  debug?          : boolean
  middleware?     : BifrostNodeMiddleware
  policies?       : PeerConfig[]
  default_policy? : PeerPolicy
  sign_interval?  : number
  max_sign_batch? : number
  ecdh_interval?  : number
  max_ecdh_batch? : number
  pool_config?    : Partial<NoncePoolConfig>
  node_config?    : NodeConfig
}

/**
 * Internal resolved config with all defaults applied.
 * Used internally by BifrostNode after merging user options with defaults.
 */
export interface BifrostNodeConfig {
  debug          : boolean
  middleware     : BifrostNodeMiddleware
  policies       : PeerConfig[]
  default_policy : PeerPolicy
  sign_interval  : number
  max_sign_batch : number
  ecdh_interval  : number
  max_ecdh_batch : number
  pool_config?   : Partial<NoncePoolConfig>
  node_config?   : NodeConfig
}

/**
 * Type map for BifrostNode events.
 *
 * Defines the event names and their payload types for the EventEmitter.
 *
 * Lifecycle events:
 * - `ready` - Emitted when connected to relays and ready for requests.
 * - `closed` - Emitted when disconnected from relays.
 *
 * Message events:
 * - `message` - Emitted for all incoming messages (before filtering).
 * - `bounced` - Emitted when a message fails authorization.
 *
 * Logging events:
 * - `info` - Informational messages.
 * - `debug` - Debug messages (when debug mode enabled).
 * - `error` - Error messages.
 *
 * API events (per endpoint, per phase):
 * - `/{api}/handler/req` - Request received by handler.
 * - `/{api}/handler/res` - Response sent by handler.
 * - `/{api}/handler/rej` - Handler error.
 * - `/{api}/sender/res` - Response received from peer.
 * - `/{api}/sender/rej` - Request to peer failed.
 * - `/{api}/sender/ret` - Operation completed successfully.
 * - `/{api}/sender/err` - Operation failed after receiving response.
 */
export interface BifrostNodeEvent {
  '*'                    : [ string, unknown ]
  'info'                 : unknown
  'debug'                : unknown
  'error'                : unknown
  'ready'                : BifrostNode
  'closed'               : BifrostNode
  'bounced'              : [ string, RpcMessageData   ]
  'message'              : RpcMessageData
  '/ecdh/sender/req'     : RpcMessageData
  '/ecdh/sender/res'     : RpcMessageData[]
  '/ecdh/sender/rej'     : [ string, ECDHPackage     ]
  '/ecdh/sender/ret'     : [ string, string          ]
  '/ecdh/sender/err'     : [ string, RpcMessageData[] ]
  '/ecdh/handler/req'    : RpcMessageData
  '/ecdh/handler/res'    : RpcMessageData
  '/ecdh/handler/rej'    : [ string, RpcMessageData   ]
  '/echo/handler/req'    : RpcMessageData
  '/echo/handler/res'    : RpcMessageData
  '/echo/handler/rej'    : [ string, RpcMessageData   ]
  '/echo/sender/req'     : RpcMessageData
  '/echo/sender/res'     : RpcMessageData
  '/echo/sender/rej'     : [ string, RpcMessageData | null ]
  '/echo/sender/ret'     : [ string ]
  '/echo/sender/err'     : [ string, RpcMessageData ]
  '/onboard/handler/req' : RpcMessageData
  '/onboard/handler/res' : RpcMessageData
  '/onboard/handler/rej' : [ string, RpcMessageData   ]
  '/onboard/sender/res'  : RpcMessageData
  '/onboard/sender/rej'  : [ string, RpcMessageData | null ]
  '/onboard/sender/ret'  : [ OnboardResponse, number ]
  '/onboard/sender/err'  : [ string, RpcMessageData | null ]
  '/ping/handler/req'    : RpcMessageData
  '/ping/handler/res'    : RpcMessageData
  '/ping/handler/rej'    : [ string, RpcMessageData   ]
  '/ping/handler/ret'    : [ string, string          ]
  '/ping/sender/req'     : RpcMessageData
  '/ping/sender/res'     : RpcMessageData
  '/ping/sender/rej'     : [ string, RpcMessageData | null ]
  '/ping/sender/ret'     : PeerData
  '/ping/sender/err'     : [ string, RpcMessageData ]
  '/sign/sender/req'     : RpcMessageData
  '/sign/sender/res'     : RpcMessageData[]
  '/sign/sender/rej'     : [ string, SignSessionPackage | null ]
  '/sign/sender/ret'     : [ string, SignatureEntry[]    ]
  '/sign/sender/err'     : [ string, RpcMessageData[]     ]
  '/sign/handler/req'    : RpcMessageData
  '/sign/handler/res'    : RpcMessageData
  '/sign/handler/rej'    : [ string, RpcMessageData   ]
}

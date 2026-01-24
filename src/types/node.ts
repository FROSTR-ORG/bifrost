import type { BifrostNode }   from '@/class/client.js'
import type { RpcMessageData } from '@vbyte/nostr-sdk'

import type {
  ECDHPackage,
  NoncePoolConfig,
  OnboardResponse,
  PeerConfig,
  PeerData,
  SighashVector,
  SignatureEntry,
  SignSessionPackage
} from '@/types/index.js'

/**
 * Cache for storing encrypted ECDH shared secrets.
 *
 * The cache maps remote public keys to encrypted shared secrets.
 * Secrets are encrypted with the node's key before storage to
 * prevent exposure in memory dumps.
 *
 * @property ecdh - Map from ECDH public key (hex) to encrypted shared secret.
 */
export interface BifrostNodeCache {
  ecdh : Map<string, string>
}

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
 * Configuration options for the underlying @vbyte/nostr-sdk.
 *
 * @property msg_timeout - Connection/message timeout in milliseconds (default: 10000).
 * @property sub_timeout - Subscription timeout in milliseconds (default: 60000).
 * @property max_retries - Maximum retry count for failed operations (default: 3).
 */
export interface SdkConfig {
  msg_timeout? : number
  sub_timeout? : number
  max_retries? : number
}

/**
 * Configuration options for a BifrostNode.
 *
 * @property debug - Enable debug logging when true.
 * @property middleware - Request middleware functions.
 * @property policies - Per-peer send/receive policies.
 * @property sign_interval - Signature batch interval in milliseconds.
 * @property ecdh_interval - ECDH batch interval in milliseconds.
 * @property nonce_pool - Optional nonce pool configuration.
 * @property sdk_config - Optional @vbyte/nostr-sdk configuration overrides.
 */
export interface BifrostNodeConfig {
  debug      : boolean
  middleware : BifrostNodeMiddleware
  policies   : PeerConfig[]
  sign_interval  : number
  ecdh_interval  : number
  nonce_pool : Partial<NoncePoolConfig>
  sdk_config : Partial<SdkConfig>
}

/**
 * Options for creating a new BifrostNode.
 *
 * Extends BifrostNodeConfig with additional optional settings.
 *
 * @property cache - Optional pre-populated cache for ECDH secrets.
 */
export interface BifrostNodeOptions extends Partial<BifrostNodeConfig> {
  cache? : BifrostNodeCache
}

/**
 * A queued signature request in the SignerQueue.
 *
 * Contains the sighash vector to sign and Promise callbacks
 * for resolving or rejecting the request when batch processing completes.
 *
 * @property sigvec - The sighash vector [id, ...metadata] to sign.
 * @property resolve - Callback to resolve the Promise with the signature.
 * @property reject - Callback to reject the Promise with an error.
 */
export interface SignRequest {
  sigvec  : SighashVector
  resolve : (result: SignatureEntry) => void
  reject  : (error: string)  => void
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

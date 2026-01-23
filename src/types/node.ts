import type { BifrostNode }   from '@/class/client.js'
import type { SignedMessage } from '@cmdcode/nostr-p2p'

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
  ecdh? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
  sign? : (client : BifrostNode, msg : SignedMessage) => SignedMessage
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
 */
export interface BifrostNodeConfig {
  debug      : boolean
  middleware : BifrostNodeMiddleware
  policies   : PeerConfig[]
  sign_interval  : number
  ecdh_interval  : number
  nonce_pool : Partial<NoncePoolConfig>
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
  'bounced'              : [ string, SignedMessage   ]
  'message'              : SignedMessage
  '/ecdh/sender/req'     : SignedMessage
  '/ecdh/sender/res'     : SignedMessage[]
  '/ecdh/sender/rej'     : [ string, ECDHPackage     ]
  '/ecdh/sender/ret'     : [ string, string          ]
  '/ecdh/sender/err'     : [ string, SignedMessage[] ]
  '/ecdh/handler/req'    : SignedMessage
  '/ecdh/handler/res'    : SignedMessage
  '/ecdh/handler/rej'    : [ string, SignedMessage   ]
  '/echo/handler/req'    : SignedMessage
  '/echo/handler/res'    : SignedMessage
  '/echo/handler/rej'    : [ string, SignedMessage   ]
  '/echo/sender/req'     : SignedMessage
  '/echo/sender/res'     : SignedMessage
  '/echo/sender/rej'     : [ string, SignedMessage | null ]
  '/echo/sender/ret'     : [ string ]
  '/echo/sender/err'     : [ string, SignedMessage ]
  '/onboard/handler/req' : SignedMessage
  '/onboard/handler/res' : SignedMessage
  '/onboard/handler/rej' : [ string, SignedMessage   ]
  '/onboard/sender/res'  : SignedMessage
  '/onboard/sender/rej'  : [ string, SignedMessage | null ]
  '/onboard/sender/ret'  : [ OnboardResponse, number ]
  '/onboard/sender/err'  : [ string, SignedMessage | null ]
  '/ping/handler/req'    : SignedMessage
  '/ping/handler/res'    : SignedMessage
  '/ping/handler/rej'    : [ string, SignedMessage   ]
  '/ping/handler/ret'    : [ string, string          ]
  '/ping/sender/req'     : SignedMessage
  '/ping/sender/res'     : SignedMessage
  '/ping/sender/rej'     : [ string, SignedMessage | null ]
  '/ping/sender/ret'     : PeerData
  '/ping/sender/err'     : [ string, SignedMessage ]
  '/sign/sender/req'     : SignedMessage
  '/sign/sender/res'     : SignedMessage[]
  '/sign/sender/rej'     : [ string, SignSessionPackage  ]
  '/sign/sender/ret'     : [ string, SignatureEntry[]    ]
  '/sign/sender/err'     : [ string, SignedMessage[]     ]
  '/sign/handler/req'    : SignedMessage
  '/sign/handler/res'    : SignedMessage
  '/sign/handler/rej'    : [ string, SignedMessage   ]
}

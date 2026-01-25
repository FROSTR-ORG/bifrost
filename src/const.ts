// === Cryptographic Sizes ===
export const COMMIT_INDEX_SIZE  = 4
export const COMMIT_PUBKEY_SIZE = 33
export const COMMIT_PNONCE_SIZE = 33
export const COMMIT_DATA_SIZE   = 103

export const GROUP_DATA_SIZE    = 37
export const GROUP_PUBKEY_SIZE  = 33
export const GROUP_THOLD_SIZE   = 4

export const SHARE_DATA_SIZE    = 100
export const SHARE_INDEX_SIZE   = 4
export const SHARE_SECKEY_SIZE  = 32
export const SHARE_SNONCE_SIZE  = 32

// === Timeouts (milliseconds) ===
export const DEFAULT_SIGN_INTERVAL = 100
export const DEFAULT_ECDH_INTERVAL = 100
export const DEFAULT_MSG_TIMEOUT   = 15000
export const DEFAULT_SUB_TIMEOUT   = 30000
export const MIN_TIMEOUT           = 1000
export const MAX_MSG_TIMEOUT       = 300000
export const MAX_SUB_TIMEOUT       = 600000

// === Batch Processing ===
export const MAX_SIGN_BATCH_SIZE = 100
export const MAX_ECDH_BATCH_SIZE = 100

// === Nonce Pool ===
export const DEFAULT_POOL_SIZE          = 100
export const DEFAULT_MIN_THRESHOLD      = 20
export const DEFAULT_CRITICAL_THRESHOLD = 5
export const DEFAULT_REPLENISH_COUNT    = 50
export const MIN_POOL_SIZE              = 10
export const MAX_POOL_SIZE              = 1000

// === Cache ===
export const DEFAULT_ECDH_CACHE_SIZE = 1000
export const DEFAULT_CACHE_TTL       = 0
export const CACHE_CLEANUP_INTERVAL  = 60000

// === Relay Limits ===
export const MAX_RELAY_LENGTH = 512
export const MAX_RELAY_COUNT  = 100
export const MIN_RELAY_COUNT  = 1

// === Protocol ===
export const PING_PROTOCOL_VERSION = 2
export const PEER_STATE_EXPIRY     = 30

// === Bech32 Prefixes ===
export const PREFIX_SHARE   = 'bfshare'
export const PREFIX_GROUP   = 'bfgroup'
export const PREFIX_ONBOARD = 'bfonboard'

// === Nostr ===
export const KIND_MAP : Record<string, number> = {
  MSG_EVENT : 20004
}

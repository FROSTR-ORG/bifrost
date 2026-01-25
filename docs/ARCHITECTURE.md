# System Architecture

This document describes the architecture of the Bifrost SDK, including component relationships, data flow, and extension points.

## Overview

Bifrost implements a layered architecture separating application concerns from cryptographic operations:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│                    (Your Application)                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BifrostNode                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   req.sign   │  │   req.ecdh   │  │   Events & Middleware  │ │
│  │   req.ping   │  │   req.echo   │  │   Peer Management      │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  BifrostSigner  │ │    NoncePool    │ │   NostrNode     │
│                 │ │                 │ │ (@cmdcode/      │
│  - Signing ops  │ │  - Generation   │ │  nostr-p2p)     │
│  - ECDH ops     │ │  - Storage      │ │                 │
│  - Encryption   │ │  - Consumption  │ │  - Relays       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Core Classes

### BifrostNode

**File:** `src/class/client.ts`

The main entry point for applications. BifrostNode orchestrates all protocol operations:

**Responsibilities:**
- Connection management (connect/disconnect from relays)
- Request routing (dispatch incoming messages to handlers)
- Event emission (notify application of protocol events)
- Peer management (track peer status and policies)
- Middleware execution (access control hooks)

**Key Properties:**
```typescript
interface BifrostNode {
  // Configuration
  group: GroupPackage      // Group credentials
  signer: BifrostSigner    // Cryptographic operations
  pool: NoncePool          // Nonce management
  peers: PeerData[]        // Peer information

  // State
  is_ready: boolean        // Connection status
  pubkey: string           // This node's BIP-340 pubkey

  // Request API
  req: {
    sign: (message, options?) => Promise<ApiResponse>
    ecdh: (pubkey, peers?) => Promise<ApiResponse>
    ping: (peer) => Promise<ApiResponse>
    echo: (challenge) => Promise<ApiResponse>
  }
}
```

**Lifecycle:**
1. Construct with group/share/relays
2. Call `connect()` to establish relay connections
3. Listen for `ready` event
4. Use `req.*` methods for operations
5. Call `close()` to disconnect

### BifrostSigner

**File:** `src/class/signer.ts`

Handles low-level cryptographic operations. Isolated from network concerns.

**Responsibilities:**
- Generate partial signatures for threshold signing
- Generate ECDH shares for threshold key exchange
- Encrypt/decrypt peer messages

**Key Methods:**
```typescript
interface BifrostSigner {
  // Identity
  idx: number              // Member index
  pubkey: string           // BIP-340 public key

  // Operations
  sign_session(session, nonce): PartialSigPackage
  gen_ecdh_share(members, pubkey): ECDHPackage
  gen_ecdh_shares(members, pubkeys): ECDHPackage

  // Encryption
  encrypt(content, pubkey): string  // Encrypt for recipient
  decrypt(content, pubkey): string  // Decrypt from sender
}
```

### NoncePool

**File:** `src/class/pool.ts`

Manages dynamic nonce generation, storage, and consumption.

**Responsibilities:**
- Generate nonces for peers (outgoing pool)
- Store nonces from peers (incoming pool)
- Track consumption and trigger replenishment
- Derive secret nonces on-demand for signing

**Pool Structure:**
```
NoncePool
├── outgoing: Map<peer_idx, Map<code, DerivedPublicNonce>>
│   └── Nonces WE generated for PEERS to use
│
└── incoming: Map<peer_idx, Map<code, DerivedPublicNonce>>
    └── Nonces PEERS generated for US to use
```

**Events:**
```typescript
interface NoncePoolEvent {
  'needs_replenish': [peer_idx: number, count: number]
  'critical_low': [peer_idx: number, available: number]
  'nonces_consumed': [peer_idx: number, count: number]
  'nonces_received': [peer_idx: number, count: number]
}
```

**Configuration:**
```typescript
interface NoncePoolConfig {
  pool_size: 100           // Target nonces per peer
  min_threshold: 20        // Trigger replenishment below this
  critical_threshold: 5    // Refuse signing below this
  replenish_count: 50      // Nonces to send during replenishment
}
```

### EventEmitter

**File:** `src/class/emitter.ts`

Type-safe event system used by all classes.

**Features:**
- Type-safe event subscriptions
- One-time handlers (`once`)
- Timeout handlers (`within`)
- Wildcard handlers (`*`)

## Data Structures

### GroupPackage

Public group credentials, safe to share:

```typescript
interface GroupPackage {
  group_pk: string          // 33-byte compressed public key (hex)
  threshold: number         // Minimum signers required
  members: MemberPackage[]  // Member info
}

interface MemberPackage {
  idx: number               // Member index (1-based)
  pubkey: string            // 33-byte member public key (hex)
}
```

**Encoding:** Bech32m with `bfgroup1` prefix

### SharePackage

Private member credentials, **keep secret**:

```typescript
interface SharePackage {
  idx: number               // Member index (1-based)
  seckey: string            // 32-byte secret share (hex)
}
```

**Encoding:** Bech32m with `bfshare1` prefix

### PeerData

Per-peer metadata:

```typescript
interface PeerData {
  pubkey: string            // Peer's BIP-340 pubkey
  policy: {
    send: boolean           // Allow sending to this peer
    recv: boolean           // Accept messages from this peer
  }
  status: 'online' | 'offline'
  updated: number           // Last status update timestamp
}
```

### Session Packages

Signing session data:

```typescript
interface SignSessionPackage {
  gid: string               // Group ID
  sid: string               // Session ID
  members: number[]         // Participating member indices
  hashes: string[][]        // Sighash vectors [sighash, ...tweaks]
  nonces?: MemberPublicNonce[]  // Nonces for all members
  content: string | null    // Optional metadata
  type: string              // Session type
  stamp: number             // Timestamp
}
```

## Message Flow

### Request/Response Pattern

All APIs follow a consistent pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Pattern                                 │
└─────────────────────────────────────────────────────────────────┘

User-facing async API:
  *_request_api(node) → async (params) → Promise<ApiResponse>

Internal send/receive:
  *_sender_api(node, params) → void   // Initiates request
  *_handler_api(node, msg) → void     // Handles incoming

Example flow:
  1. node.req.sign(message)           // User calls
  2. sign_request_api()               // Validates, prepares
  3. sign_sender_api()                // Sends to peers
  4. [peer] sign_handler_api()        // Peer processes
  5. [peer] sends response
  6. Response collected, aggregated
  7. Promise resolves with signature
```

### Signing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Threshold Signing Flow                       │
└─────────────────────────────────────────────────────────────────┘

  Requester                          Peer 1                Peer 2
      │                                 │                     │
      │  1. User calls req.sign()       │                     │
      │                                 │                     │
      │  2. Consume nonces from pool    │                     │
      │     for each peer               │                     │
      │                                 │                     │
      │  3. Create session package      │                     │
      │     (gid, sid, members,         │                     │
      │      hashes, nonces)            │                     │
      │                                 │                     │
      │──── /sign/req ─────────────────>│                     │
      │──── /sign/req ─────────────────────────────────────────>│
      │                                 │                     │
      │                    4. Verify session                  │
      │                    5. Find our nonce by idx           │
      │                    6. Verify nonce in outgoing pool   │
      │                    7. Derive secret nonce             │
      │                    8. Create partial signature        │
      │                    9. Mark nonce spent                │
      │                                 │                     │
      │<─── /sign/res ──────────────────│                     │
      │<─── /sign/res ────────────────────────────────────────│
      │                                 │                     │
      │  10. Verify partial sigs        │                     │
      │  11. Aggregate into signature   │                     │
      │  12. Resolve promise            │                     │
      │                                 │                     │
```

### ECDH Flow

```
  Requester                          Peer 1                Peer 2
      │                                 │                     │
      │  1. User calls req.ecdh(pk)     │                     │
      │                                 │                     │
      │──── /ecdh/req ─────────────────>│                     │
      │──── /ecdh/req ─────────────────────────────────────────>│
      │                                 │                     │
      │                    2. Generate ECDH share             │
      │                       share_i = λ_i * s_i * pk        │
      │                                 │                     │
      │<─── /ecdh/res ──────────────────│                     │
      │<─── /ecdh/res ────────────────────────────────────────│
      │                                 │                     │
      │  3. Combine ECDH shares         │                     │
      │     secret = Σ share_i          │                     │
      │  4. Resolve promise             │                     │
      │                                 │                     │
```

## Nostr Integration

### NostrNode (from @vbyte/nostr-sdk)

Handles all relay communication:

```typescript
// Wrapped by BifrostNode
const client = new NostrNode(peers, relays, seckey, options)

client.on('message', ([msg]) => {
  // Decrypted, verified message from peer
})

// Request/response pattern
const response = await client.request({ method: 'ping', params: [...] }, peer)

// Multicast pattern
const responses = await client.cast({ method: 'sign', params: [...] }, peers)

// Handler response pattern
const result = await client.respond(msg).accept(data)
```

**Features:**
- WebSocket management with reconnection
- End-to-end encryption (NIP-44: ChaCha20-Poly1305)
- Message signing and verification
- RPC-style request/response API
- Multicast with threshold collection

### Message Routing

```
Incoming Nostr Event
        │
        ▼
  ┌─────────────┐
  │ Decrypt &   │
  │ Verify      │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Check       │     Unauthorized
  │ Authorization├──────────────────> emit('bounced')
  └──────┬──────┘
         │ Authorized
         ▼
  ┌─────────────┐
  │ Route by    │
  │ msg.tag     │
  └──────┬──────┘
         │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
/ping/req  /sign/req   /ecdh/req   /echo/req
    │         │            │            │
    ▼         ▼            ▼            ▼
 Handler   Handler     Handler     Handler
```

## Source Structure

```
src/
├── api/                    # Protocol request/response handlers
│   ├── ecdh.ts            # Threshold ECDH operations
│   ├── echo.ts            # Relay connectivity test
│   ├── onboard.ts         # New member onboarding
│   ├── ping.ts            # Peer discovery, nonce exchange
│   └── sign.ts            # Threshold signing
│
├── class/                  # Core classes
│   ├── client.ts          # BifrostNode - main entry point
│   ├── signer.ts          # BifrostSigner - crypto operations
│   ├── pool.ts            # NoncePool - nonce management
│   ├── emitter.ts         # EventEmitter - event system
│   ├── sign-batcher.ts    # Batch signing coordinator
│   └── ecdh-batcher.ts    # Batch ECDH coordinator
│
├── encoder/                # Bech32 encoding/decoding
│   ├── group.ts           # GroupPackage encoding
│   ├── share.ts           # SharePackage encoding
│   └── onboard.ts         # OnboardPackage encoding
│
├── lib/                    # Core protocol functions
│   ├── ecdh.ts            # ECDH share creation/combination
│   ├── group.ts           # Group ID, member lookup
│   ├── nonce.ts           # Nonce generation/derivation
│   ├── package.ts         # Dealer package generation
│   ├── parse.ts           # Message parsing
│   ├── peer.ts            # Peer utilities
│   ├── session.ts         # Session creation/validation
│   └── sign.ts            # Partial signature operations
│
├── schema/                 # Zod validation schemas
│   ├── base.ts            # Base types (hex32, hex33, etc.)
│   ├── nonce.ts           # Nonce schemas
│   ├── sign.ts            # Signing schemas
│   └── ...
│
├── types/                  # TypeScript interfaces
│   ├── group.ts           # Group/Share/Member types
│   ├── nonce.ts           # Nonce types
│   ├── sign.ts            # Signing types
│   └── ...
│
└── util/                   # Utilities
    ├── assert.ts          # Assertion helpers
    ├── crypto.ts          # Crypto utilities
    ├── encoding.ts        # Hash/encoding helpers
    └── parse.ts           # General parsing
```

## Extension Points

### Middleware

Middleware functions intercept requests for access control:

```typescript
const node = new BifrostNode(group, share, relays, {
  middleware: {
    // Control who can request signatures
    sign: (node, msg) => {
      // Validate request
      if (!authorized(msg)) {
        throw new Error('unauthorized')
      }
      // Return message to approve (or modify it)
      return msg
    },

    // Control ECDH requests
    ecdh: (node, msg) => {
      // Similar validation
      return msg
    }
  }
})
```

**Use cases:**
- Rate limiting
- Request logging/auditing
- Content-based authorization
- Multi-party approval workflows

### Events

Full event list for application integration:

```typescript
// Connection events
node.on('ready', (node) => { })
node.on('closed', (node) => { })
node.on('message', (msg) => { })
node.on('bounced', ([reason, msg]) => { })

// Signing events (sender side)
node.on('/sign/sender/req', (msg) => { })
node.on('/sign/sender/res', (msgs) => { })
node.on('/sign/sender/sig', ([sig, msgs]) => { })
node.on('/sign/sender/rej', ([reason, session]) => { })
node.on('/sign/sender/err', ([reason, msgs]) => { })

// Signing events (handler side)
node.on('/sign/handler/req', (msg) => { })
node.on('/sign/handler/res', (msg) => { })
node.on('/sign/handler/rej', ([reason, msg]) => { })

// ECDH events (sender side)
node.on('/ecdh/sender/req', (msg) => { })
node.on('/ecdh/sender/res', (msgs) => { })
node.on('/ecdh/sender/sec', ([secret, pkgs]) => { })
node.on('/ecdh/sender/rej', ([reason, pkg]) => { })
node.on('/ecdh/sender/err', ([reason, msgs]) => { })

// ECDH events (handler side)
node.on('/ecdh/handler/req', (msg) => { })
node.on('/ecdh/handler/res', (msg) => { })
node.on('/ecdh/handler/rej', ([reason, msg]) => { })

// Ping/Echo events
node.on('/ping/req', (msg) => { })
node.on('/ping/res', (msg) => { })
node.on('/echo/req', (msg) => { })
node.on('/echo/res', (msg) => { })
```

### Caching

ECDH results can be cached for performance:

```typescript
const cache = new Map<string, string>()

const node = new BifrostNode(group, share, relays, {
  cache: {
    ecdh: cache  // Caches pubkey -> shared_secret
  }
})
```

### Peer Policies

Dynamic control of peer communication:

```typescript
// Initial configuration
const node = new BifrostNode(group, share, relays, {
  policies: [
    { pubkey: 'abc...', policy: { send: true, recv: true } },
    { pubkey: 'def...', policy: { send: true, recv: false } }
  ]
})

// Runtime updates
node.update_peer({
  pubkey: 'abc...',
  policy: { send: false, recv: false }
})
```

## Batching

### Sign Batching

Multiple sign requests can be batched for efficiency:

```typescript
// Queue multiple signatures
const promises = [
  node.req.queue('message1'),
  node.req.queue('message2'),
  node.req.queue('message3')
]

// All are batched into single network round-trip
const results = await Promise.all(promises)
```

### ECDH Batching

ECDH requests are automatically batched:

```typescript
// Multiple concurrent ECDH requests
const [secret1, secret2] = await Promise.all([
  node.req.ecdh(pubkey1),
  node.req.ecdh(pubkey2)
])
// Combined into single request to each peer
```

## Performance Considerations

### Nonce Pre-generation

Nonces are pre-generated and exchanged during ping, enabling signing without real-time nonce coordination:

```
Without pre-generation:      With pre-generation:
  Sign request               Sign request
  ├─ Exchange nonces         └─ Use cached nonces
  │  └─ Round-trip              └─ Single round-trip
  └─ Exchange partials
     └─ Round-trip

  2+ round-trips             1 round-trip
```

### Connection Pooling

The underlying NostrNode maintains persistent WebSocket connections with automatic reconnection:

```typescript
// Single connection reused for all operations
node.connect()  // Establishes persistent connection
// All subsequent operations use same connections
```

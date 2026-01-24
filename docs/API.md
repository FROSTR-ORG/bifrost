# API Reference

Complete API documentation for Bifrost.

## BifrostNode

The main entry point for FROSTR operations.

### Constructor

```typescript
new BifrostNode(group, share, relays, options?)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `group` | `GroupPackage \| string` | Group package or bech32-encoded string |
| `share` | `SharePackage \| string` | Share package or bech32-encoded string |
| `relays` | `string[]` | Relay WebSocket URLs |
| `options` | `NodeOptions` | Optional configuration |

### Options

```typescript
interface NodeOptions {
  cache?: {
    ecdh?: Map<string, string>  // Cache for ECDH shared secrets
  }
  debug?: boolean               // Enable verbose logging
  middleware?: {
    sign?: (node, msg) => msg   // Sign request middleware
    ecdh?: (node, msg) => msg   // ECDH request middleware
  }
  policies?: PeerConfig[]       // Per-peer send/recv policies
  sign_interval?: number        // Signature batch interval (ms), default: 100
  ecdh_interval?: number        // ECDH batch interval (ms), default: 100
  nonce_pool?: {
    pool_target?: number        // Target nonces per peer, default: 50
    replenish_threshold?: number // Trigger replenish below this, default: 25
  }
  sdk_config?: {
    msg_timeout?: number        // Connection timeout (ms), default: 15000
    sub_timeout?: number        // Request timeout (ms), default: 30000
    max_retries?: number        // Retry count, default: 3
  }
}
```

### Methods

| Method | Description |
|--------|-------------|
| `connect()` | Connect to relays and initialize |
| `close()` | Disconnect and cleanup |
| `update_peer(data)` | Update peer status/policy |
| `req.sign(message, options?)` | Request threshold signature |
| `req.queue(message)` | Queue message for batch signing |
| `req.ecdh(pubkey, peers?)` | Request collaborative ECDH (batched) |
| `req.ping(peer)` | Ping peer and exchange nonces |
| `req.echo(message)` | Echo message through relay |
| `req.onboard(pubkey)` | Request onboarding info from peer |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `pubkey` | `string` | Node's BIP-340 public key |
| `group` | `GroupPackage` | Group package with members and group pubkey |
| `signer` | `BifrostSigner` | Low-level signer instance |
| `pool` | `NoncePool` | Nonce pool manager |
| `peers` | `PeerData[]` | Peer list with status and policies |
| `is_ready` | `boolean` | Whether node is connected and ready |
| `config` | `NodeConfig` | Current node configuration |

### Events

```typescript
// Base events
node.on('ready', (node) => { })        // Node connected and ready
node.on('closed', (node) => { })       // Node disconnected
node.on('message', (msg) => { })       // Any message received
node.on('bounced', ([reason, msg]) => { })  // Message rejected

// Signature events
node.on('/sign/sender/req', (msg) => { })   // Signature request sent
node.on('/sign/sender/res', (msgs) => { })  // Partial signatures received
node.on('/sign/sender/sig', ([sig, msgs]) => { })  // Final signature produced
node.on('/sign/sender/rej', ([reason, session]) => { })  // Request rejected
node.on('/sign/sender/err', ([reason, msgs]) => { })     // Aggregation failed

node.on('/sign/handler/req', (msg) => { })  // Signature request received
node.on('/sign/handler/res', (msg) => { })  // Partial signature sent
node.on('/sign/handler/rej', ([reason, msg]) => { })  // Request rejected

// ECDH events
node.on('/ecdh/sender/req', (msg) => { })   // ECDH request sent
node.on('/ecdh/sender/res', (msgs) => { })  // ECDH shares received
node.on('/ecdh/sender/ret', ([secret, pubkey]) => { })  // Shared secret derived
node.on('/ecdh/sender/rej', ([reason, pkg]) => { })     // Request rejected
node.on('/ecdh/sender/err', ([reason, msgs]) => { })    // Derivation failed

node.on('/ecdh/handler/req', (msg) => { })  // ECDH request received
node.on('/ecdh/handler/res', (msg) => { })  // ECDH share sent
node.on('/ecdh/handler/rej', ([reason, msg]) => { })  // Request rejected

// Onboard events
node.on('/onboard/sender/res', (msg) => { })  // Onboard response received
node.on('/onboard/sender/ret', ([response, count]) => { })  // Onboarding complete
node.on('/onboard/sender/rej', ([reason, msg]) => { })  // Request rejected

node.on('/onboard/handler/req', (msg) => { })  // Onboard request received
node.on('/onboard/handler/res', (msg) => { })  // Onboard response sent
node.on('/onboard/handler/rej', ([reason, msg]) => { })  // Request rejected
```

## BifrostSigner

Low-level cryptographic operations. Used internally by BifrostNode.

```typescript
import { BifrostSigner } from '@frostr/bifrost'

const signer = new BifrostSigner(group, share)
```

## Package Exports

```typescript
// Main classes
import { BifrostNode, BifrostSigner } from '@frostr/bifrost'

// Encoding/decoding
import {
  encode_group_package,
  decode_group_package,
  encode_share_package,
  decode_share_package
} from '@frostr/bifrost/encoder'

// Protocol functions
import {
  generate_dealer_package,
  create_session,
  // ... other lib exports
} from '@frostr/bifrost/lib'

// Utilities
import {
  get_pubkey,
  get_seckey,
  // ... other util exports
} from '@frostr/bifrost/util'
```

## Core Components

| Component | Description |
|-----------|-------------|
| **BifrostNode** | Main entry point. Manages peer connections, orchestrates signing/ECDH, emits events |
| **BifrostSigner** | Low-level cryptographic operations. Handles signing, ECDH, encryption/decryption |
| **GroupPackage** | Public group data: group public key, member commitments. Encoded as `bfgroup1...` |
| **SharePackage** | Private member data: secret share, member index. Encoded as `bfshare1...` |

## API Pattern

All protocol operations follow a sender/handler pattern:

- `*_sender_api()` - Initiates requests to peers
- `*_handler_api()` - Processes incoming requests from peers
- `*_request_api()` - User-facing async interface returning `ApiResponse<T>`

## Related Documentation

- [Guide](./GUIDE.md) - Getting started with code examples
- [Architecture](./ARCHITECTURE.md) - System components and data flow
- [Protocol](./PROTOCOL.md) - Wire protocol specification

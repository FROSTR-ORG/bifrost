# Guide

Get from zero to threshold signing with FROSTR Bifrost.

## Prerequisites

- Node.js 18 or higher
- npm or yarn

## Installation

```bash
npm install @frostr/bifrost
```

## Option 1: Interactive Demo (Recommended)

The fastest way to understand FROSTR is to see it in action. The interactive demo runs a complete threshold signing setup locally.

### Setup

```bash
# Clone the repository
git clone https://github.com/FROSTR-ORG/bifrost.git
cd bifrost

# Install dependencies
npm install

# Generate test credentials (2-of-3 threshold group)
npm run demo:keygen
```

### Using tmux (Recommended)

Launch the demo with a single command:

```bash
npm run demo
```

This opens a new terminal window with a 4-pane tmux layout:
```
+-----------------------------+-----------------------------+
|                             |                             |
|     Relay                   |     Alice                   |
|     ws://localhost:8194     |     alice>                  |
|                             |                             |
+-----------------------------+-----------------------------+
|                             |                             |
|     Bob                     |     Carol                   |
|     bob>                    |     carol>                  |
|                             |                             |
+-----------------------------+-----------------------------+
```

To stop the demo, simply close the terminal window. The tmux session is automatically cleaned up.

### Manual Setup (4 terminals)

Open four terminal windows and run:

**Terminal 1 - Relay:**
```bash
npm run demo:relay
```

**Terminal 2 - Alice:**
```bash
npm run demo:alice
```

**Terminal 3 - Bob:**
```bash
npm run demo:bob
```

**Terminal 4 - Carol (optional):**
```bash
npm run demo:carol
```

### Try It Out

**1. Check Status**

In Alice's terminal:
```
alice> status
```
Shows your node info, peer connections, and pool health.

**2. Ping a Peer**

Exchange nonces with Bob:
```
alice> ping bob
```

You'll see:
```
[SEND] Pinging bob...
[OK] Pong! Policy: send=true, recv=true
[RECV] Received 50 nonces
```

**3. Sign a Message**

Request a threshold signature:
```
alice> sign Hello FROSTR!
```

Watch the signing flow:
```
[SEND] Signing: "Hello FROSTR!"
[RECV] Sign request from bob
[SEND] Sent partial signature
[OK] Signature obtained!
[INFO] Signature: e3b0c442...98fb23c4
```

**4. Check Pool Status**

View nonce pool details:
```
alice> pool
```

### Demo Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `ping <name>` | Ping peer, exchange nonces | `ping bob` |
| `sign <message>` | Request threshold signature | `sign Hello!` |
| `ecdh <pubkey>` | Derive shared secret | `ecdh 02abc...` |
| `echo <message>` | Test relay connectivity | `echo test` |
| `status` | Show node status and peers | `status` |
| `peers` | List peers with online status | `peers` |
| `pool` | Show nonce pool per peer | `pool` |
| `pubkey` | Display this node's pubkey | `pubkey` |
| `group` | Display group pubkey and info | `group` |
| `help` | Show available commands | `help` |
| `quit` | Exit gracefully | `quit` |

## Option 2: Code Example

### Step 1: Generate a Threshold Group

First, generate the group and share packages. This is typically done once, in a secure environment:

```typescript
import {
  generate_dealer_package,
  encode_group_package,
  encode_share_package
} from '@frostr/bifrost/lib'
import { get_seckey } from '@frostr/bifrost/util'

// Generate a random secret key, or use an existing one
const secret_key = get_seckey()

// Create a 2-of-3 threshold group
const { group, shares } = generate_dealer_package(
  2,           // threshold: 2 signatures required
  3,           // members: 3 total shareholders
  [secret_key] // optional: derive from existing key
)

// Encode for distribution
const group_bech32 = encode_group_package(group)     // bfgroup1...
const share_bech32s = shares.map(encode_share_package)  // bfshare1...

console.log('Group package:', group_bech32)
console.log('Share packages:')
share_bech32s.forEach((s, i) => console.log(`  Member ${i + 1}:`, s))
```

### Step 2: Create Signing Nodes

Each shareholder runs a node with the group package and their individual share:

```typescript
import { BifrostNode } from '@frostr/bifrost'
import {
  decode_group_package,
  decode_share_package
} from '@frostr/bifrost/encoder'

// Each member has these (from Step 1)
const GROUP_PACKAGE = 'bfgroup1...'  // Same for all members
const MY_SHARE = 'bfshare1...'       // Unique per member

// Relays for communication
const RELAYS = ['wss://relay.example.com']

// Decode the packages
const group = decode_group_package(GROUP_PACKAGE)
const share = decode_share_package(MY_SHARE)

// Create and connect the node
const node = new BifrostNode(group, share, RELAYS)

node.on('ready', () => {
  console.log('Node ready!')
  console.log('Group pubkey:', group.group_pk)
  console.log('My pubkey:', share.pubkey)
})

await node.connect()
```

### Step 3: Exchange Nonces

Before signing, nodes must exchange nonces. This happens automatically during ping:

```typescript
// Get the pubkey of another member
const peer_pubkey = group.members[1].pubkey  // Member 2's pubkey

// Ping them to exchange nonces
const ping_result = await node.req.ping(peer_pubkey)

if (ping_result.ok) {
  console.log('Connected! Nonces exchanged.')
} else {
  console.error('Ping failed:', ping_result.err)
}
```

### Step 4: Sign a Message

With nonces exchanged, request a threshold signature:

```typescript
const message = 'Hello FROSTR!'

const result = await node.req.sign(message)

if (result.ok) {
  console.log('Signature:', result.data)
  // result.data is a valid BIP-340 Schnorr signature
  // Verifiable against group.group_pk
} else {
  console.error('Signing failed:', result.err)
}
```

### Complete Example

Here's a full working example with two nodes:

```typescript
import { BifrostNode } from '@frostr/bifrost'
import {
  generate_dealer_package,
  encode_group_package,
  encode_share_package
} from '@frostr/bifrost/lib'
import {
  decode_group_package,
  decode_share_package
} from '@frostr/bifrost/encoder'
import { get_seckey } from '@frostr/bifrost/util'

const RELAYS = ['wss://relay.example.com']

// Generate 2-of-3 threshold group
const { group, shares } = generate_dealer_package(2, 3, [get_seckey()])

// Encode packages
const group_pkg = encode_group_package(group)
const share_pkgs = shares.map(encode_share_package)

// Create two nodes (simulating two different machines)
const node1 = new BifrostNode(
  decode_group_package(group_pkg),
  decode_share_package(share_pkgs[0]),
  RELAYS
)

const node2 = new BifrostNode(
  decode_group_package(group_pkg),
  decode_share_package(share_pkgs[1]),
  RELAYS
)

// Connect both nodes
await Promise.all([node1.connect(), node2.connect()])

// Wait for ready
await new Promise(resolve => {
  let ready = 0
  const check = () => { if (++ready === 2) resolve(undefined) }
  node1.on('ready', check)
  node2.on('ready', check)
})

// Exchange nonces
const peer2_pubkey = shares[1].pubkey
await node1.req.ping(peer2_pubkey)

// Sign a message
const result = await node1.req.sign('Hello threshold world!')

if (result.ok) {
  console.log('Success! Signature:', result.data)
}

// Cleanup
node1.close()
node2.close()
```

## Understanding the Protocol

### The Signing Flow

When you run `sign Hello!`:

1. **Alice** consumes a nonce from her pool for Bob
2. **Alice** sends a signing request to Bob
3. **Bob** receives the request and verifies it
4. **Bob** derives his secret nonce and computes a partial signature
5. **Bob** sends his partial signature back
6. **Alice** aggregates the partials into a final signature

**Key insight**: Neither Alice nor Bob ever had the complete private key. They each held a share, and the partial signatures combined mathematically.

### Nonce Management

Nonces are critical for security - reusing a nonce leaks the key.

- **Initial exchange**: `ping` commands exchange nonces between peers
- **Consumption**: Each signature consumes one nonce per peer
- **Replenishment**: Pools are automatically replenished as needed
- **Monitoring**: Use `pool` to see nonce levels

### 2-of-3 Threshold

The demo uses a 2-of-3 threshold:
- 3 members (Alice, Bob, Carol) hold shares
- Any 2 can collaborate to sign
- No single member can sign alone

Try signing with just Alice and Bob online - Carol doesn't need to participate.

## Troubleshooting

### "Credentials not found"

Run the keygen script first:
```bash
npm run demo:keygen
```

### "Connection refused" or timeout

- Ensure the relay is running and accessible
- Check the WebSocket URL (should start with `wss://` or `ws://`)
- Verify firewall rules allow WebSocket connections

### "Not enough peers" or signing fails

- Need at least `threshold` nodes online (2 for default 2-of-3)
- Ping peers first to exchange nonces: `await node.req.ping(peer_pubkey)`

### "Nonce pool exhausted"

- Ping peers to replenish nonces: `await node.req.ping(peer_pubkey)`
- The pool is automatically replenished during normal operations
- Check pool status with `node.signer.pool` (in debug scenarios)

### Invalid share or group package

- Ensure you're using the correct bech32 strings
- Group package starts with `bfgroup1`
- Share package starts with `bfshare1`
- Verify the share belongs to the group (same `gid`)

### Port already in use

Use a different port:
```bash
npm run demo:relay -- 8195
```

## Demo Customization

### Different Threshold/Members

Generate a different configuration:

```bash
# 3-of-5 threshold group
npm run demo:keygen -- -t 3 -n 5

# Force regenerate (overwrite existing)
npm run demo:keygen -- --fresh
```

Member names follow the pattern: alice, bob, carol, dave, eve, ...

## Middleware

Middleware allows you to intercept and modify messages before processing. This is useful for logging, filtering, or transforming requests.

```typescript
const node = new BifrostNode(group, share, relays, {
  middleware: {
    // Filter or modify incoming sign requests
    sign: (node, msg) => {
      console.log('Sign request:', msg.data.hashes)
      return msg // Return message to continue processing
    },
    // Filter or modify incoming ECDH requests
    ecdh: (node, msg) => {
      console.log('ECDH request:', msg.data.entries.length, 'keys')
      return msg // Return null to drop the request
    }
  }
})
```

Middleware functions receive:
- `node` - The BifrostNode instance
- `msg` - The parsed request message with data payload

Return the message (modified or unmodified) to continue processing, or return `null` to drop the request.

## Next Steps

- [API Reference](./API.md) - Full API documentation
- [Security Model](./SECURITY.md) - Threat model and deployment guidance
- [Architecture](./ARCHITECTURE.md) - System components and data flow
- [Protocol](./PROTOCOL.md) - Wire protocol and nonce pool management

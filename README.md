# Bifrost

Core library and SDK for implementing the FROSTR protocol - a threshold signing and secure messaging system for nostr.

## Features

* Reference implementation of the FROSTR protocol.
* Provides a `BifrostNode` which communicates over nostr.
* Nodes collaborate to sign messages and exchange ECDH secrets.
* Run standalone or integrate into existing nostr clients.
* Includes methods for creating, distributing, and managing sets of shares for FROST-based threshold signing.

## Installation

```bash
npm install @frostr/bifrost
```

## Usage Examples

### Creating a group of shares

The following example demonstrates how to create a set of commits and shares for a 2-of-3 threshold signing group.

```ts
import {
  encode_group_pkg,
  encode_share_pkg,
  generate_dealer_pkg
} from '@frostr/bifrost/lib'

const THRESHOLD  = 2  // Number of shares required to sign.
const MEMBERS    = 3  // Total number of shares to create.
const SECRET_KEY = 'your hex-encoded secret key'

// Generate a 2-of-3 threshold signing group.
const { group, shares } = generate_dealer_pkg (
  THRESHOLD, MEMBERS, [ SECRET_KEY ]
)

// Encode the group and shares as bech32 strings.
const group_cred  = encode_group_pkg(group)
const share_creds = shares.map(encode_share_pkg)
```

### Initializing a Bifrost Node

```ts
import { BifrostNode } from '@frostr/bifrost'

// List of relays to connect to.
const relays = [ 'wss://relay.example.com' ]

// Initialize the node with the group and share credentials.
const node = new BifrostNode (group, share, relays)

// Log when the node is ready.
node.on('ready', () => console.log('bifrost node is ready'))

// Connect to the relays.
await node.connect()
```

### Signing Messages

```ts
// Request a partial signature from other group members.
const result = await node.req.sign(
  message,      // message to sign.
  peer_pubkeys  // array of bifrost peer public keys.
)

if (result.ok) {
  // The final signature aggregated from all group members.
  const signature = result.data
}
```

### ECDH Key Exchange

```ts
// Request a partial ECDH secret from other group members.
const result = await node.req.ecdh(
  ecdh_pubkey,  // public key for the ECDH exchange.
  peer_pubkeys  // array of bifrost peer public keys.
)

if (result.ok) {
  // The final ECDH shared secret.
  const shared_secret = result.data
}
```

## Development & Testing

The library includes comprehensive test suites organized into unit and end-to-end test suites.

Run specific test suites:

```bash
# Run all tests
npm test

# Build the project
npm run build

# Build a release candidate.
npm run release
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

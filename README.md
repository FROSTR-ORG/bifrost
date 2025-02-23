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

// Generate a 2-of-3 threshold share package.
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

const opt = {
  // Provide an existing cache for storing data.
  cache : {
    // Cache for storing ECDH secrets.
    ecdh : new Map<string, string>
  },
  // Enables more verbose logging of errors.
  debug : false,
  // Middleware functions for handling incoming messages.
  middleware : {
    // This middleware will run before a ECDH request is accepted.
    ecdh : (node, msg) => SignedMessage<ECDHPackage>,
    // This middleware will run before a signature request is accepted.
    sign : (node, msg) => SignedMessage<SessionPackage>
  },
  // Specify a set of policies for each peer.
  policies : [
    // The format is [ pubkey, allow_send, allow_recv ].
    [ 'pubkey1', true,  true  ],
    // If allow_send is false, the node will not send requests to the peer.
    [ 'pubkey2', false, true  ],
    // If allow_recv is false, the node will not handle requests from the peer.
    [ 'pubkey3', false, false ]
  ]
}

// Initialize the node with the group and share credentials.
const node = new BifrostNode (group, share, relays, opt)

// Log when the node is ready.
node.on('ready', () => console.log('bifrost node is ready'))

// Connect to the relays.
await node.connect()
```

### Signing Messages

```ts
// Optional parameters for the signature request.
const options = {
  payload : null,      // optional payload for the signature request.
  peers   : [],        // array of peer public keys (overrides policies).
  stamp   : now(),     // specific timestamp for the request.
  type    : 'message', // optional type parameter for the signature request.
  tweaks  : []         // array of tweak values to apply to the signature.
}

// Request a partial signature from other group members.
const result = await node.req.sign(
  message, // message to sign.
  options  // optional parameters for the signature request.
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
  ecdh_pk, // public key for the ECDH exchange.
  peer_pks // array of peer public keys (overrides policies).
)

if (result.ok) {
  // The final ECDH shared secret.
  const shared_secret = result.data
}
```

### Listening for Events

The Bifrost node emits events during various stages of processing requests and responses.

```ts
interface BifrostNodeEvent {
  // Base events.
  '*'                 : [ string, ...any[]        ] // emits all events.
  'ready'             : BifrostNode                 // emits when the node is ready.
  'closed'            : BifrostNode                 // emits when the node is closed.
  'message'           : SignedMessage               // emits when a message is received.
  'bounced'           : [ string, SignedMessage   ] // emits when a message is rejected.
  // ECDH events.
  '/ecdh/sender/req'  : SignedMessage               // emits when a ECDH request is sent.
  '/ecdh/sender/res'  : SignedMessage[]             // emits when a ECDH request is fulfilled.
  '/ecdh/sender/rej'  : [ string, ECDHPackage     ] // emits when a ECDH request is rejected.
  '/ecdh/sender/sec'  : [ string, ECDHPackage[]   ] // emits when a ECDH share is aggregated.
  '/ecdh/sender/err'  : [ string, SignedMessage[] ] // emits when a ECDH share fails to aggregate.
  '/ecdh/handler/req' : SignedMessage               // emits when a ECDH request is received.
  '/ecdh/handler/res' : SignedMessage               // emits when a ECDH response is sent.
  '/ecdh/handler/rej' : [ string, SignedMessage   ] // emits when a ECDH rejection is sent.
  // Signature events.
  '/sign/sender/req'  : SignedMessage               // emits when a signature request is sent.
  '/sign/sender/res'  : SignedMessage[]             // emits when a signature response is received.
  '/sign/sender/rej'  : [ string, SessionPackage  ] // emits when a signature rejection is received.
  '/sign/sender/sig'  : [ string, SignedMessage[] ] // emits when a signature share is aggregated.
  '/sign/sender/err'  : [ string, SignedMessage[] ] // emits when a signature share fails to aggregate.
  '/sign/handler/req' : SignedMessage               // emits when a signature request is received.
  '/sign/handler/res' : SignedMessage               // emits when a signature response is sent.
  '/sign/handler/rej' : [ string, SignedMessage   ] // emits when a signature rejection is sent.
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

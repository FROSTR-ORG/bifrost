# Bifrost

Core library and SDK for implementing the FROSTR protocol - a threshold signing and secure messaging system for nostr.

## Installation

```bash
npm install @frostr/bifrost
```

## Usage Examples

### Creating a Group

```ts
import {
  encode_group_pkg,
  encode_share_pkg,
  generate_dealer_pkg
} from '@frostr/bifrost/lib'

const THRESHOLD  = 2
const MEMBERS    = 3
const SECRET_KEY = 'your hex-encoded secret key'

// Generate a 2-of-3 threshold signing group
const { group, shares} = generate_dealer_pkg(
  THRESHOLD, MEMBERS, [ SECRET_KEY ]
)

const group_cred  = encode_group_pkg(group)
const share_creds = shares.map(encode_share_pkg)
```

### Initializing a Node

```ts
import { BifrostNode } from '@frostr/bifrost'

const relays = [ 'wss://relay.example.com' ]

const node = new BifrostNode(
  group_cred,     // GroupPackage
  share_creds[0], // SharePackage
  relays          // string[]
)

node.on('ready', () => {
  console.log('bifrost node is ready')
})

await node.connect()
```

### Signing Messages

```ts
// Request signatures from group members
const result = await node.req.sign(
  message,      // message to sign.
  peer_pubkeys  // array of bifrost peer public keys.
)

if (result.ok) {
  const signature = result.data
  // Use the aggregated signature...
}
```

### ECDH Key Exchange

```ts
// Request ECDH key from group members
const result = await node.req.ecdh(
  ecdh_pubkey,  // public key of the ECDH exchage.
  peer_pubkeys  // array of bifrost peer public keys.
)

if (result.ok) {
  const shared_key = result.data
  // Use the ECDH key...
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
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - See [LICENSE](LICENSE) file for details.

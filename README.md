# Bifrost

> Threshold signing SDK for FROSTR - Distributed key custody using Nostr relays

[![npm version](https://img.shields.io/npm/v/@frostr/bifrost)](https://www.npmjs.com/package/@frostr/bifrost)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## What is FROSTR?

**FROSTR** (Frost Over Nostr) is a threshold cryptography protocol that enables distributed key custody using Nostr relays as the communication layer. It implements the FROST (Flexible Round-Optimized Schnorr Threshold) signature scheme.

**The problem**: Traditional key management creates single points of failure. If a private key is compromised, lost, or held by a single party that becomes unavailable, access to funds or signing capability is lost.

**The solution**: Threshold signatures split a key into multiple shares distributed among different parties. M-of-N shareholders must collaborate to produce a signature. No single party ever possesses the complete key, even during signing. The resulting signature is a standard BIP-340 Schnorr signature - indistinguishable from one produced by a single signer.

**Why Nostr?** Nostr provides a decentralized relay network that's already battle-tested for message passing. FROSTR leverages this existing infrastructure for peer communication, with end-to-end encryption ensuring relay operators never see message contents.

## Features

- **Threshold Signing**: M-of-N signing where no single party holds the complete key
- **ECDH Key Exchange**: Collaborative derivation of shared secrets
- **End-to-End Encryption**: All peer communication encrypted with ChaCha20-Poly1305
- **Nostr Transport**: Uses existing relay infrastructure for decentralized communication
- **BIP-340 Compatible**: Produces standard Schnorr signatures usable on Bitcoin and Nostr
- **TypeScript First**: Full type safety with strict mode enabled

## Installation

```bash
npm install @frostr/bifrost
```

## Quick Example

```typescript
import { BifrostNode }             from '@frostr/bifrost'
import { generate_dealer_package } from '@frostr/bifrost/lib'
import { get_seckey }              from '@frostr/bifrost/util'

// Generate a 2-of-3 threshold group
const { group, shares } = generate_dealer_package(2, 3)

// Create and connect a node
const node = new BifrostNode(group, shares[0], ['wss://relay.example.com'])
await node.connect()

// Exchange nonces with a peer
await node.req.ping(shares[1].pubkey)

// Request a threshold signature
const result = await node.req.sign('Hello FROSTR!')

if (!result.ok) throw new Error('signing failed!')

console.log('Signature:', result.data)
```

See the [Guide](docs/GUIDE.md) for complete examples.

## API Overview

| Method | Description |
|--------|-------------|
| `node.req.sign(message)` | Request threshold signature |
| `node.req.ecdh(pubkey)` | Collaborative ECDH key exchange |
| `node.req.ping(peer)` | Ping peer and exchange nonces |
| `node.req.echo(message)` | Test relay connectivity |

See [API Reference](docs/API.md) for full documentation.

## Documentation

| Document | Description |
|----------|-------------|
| [Guide](docs/GUIDE.md) | Getting started with code examples and interactive demo |
| [API Reference](docs/API.md) | Full API documentation |
| [Security Model](docs/SECURITY.md) | Threat model, guarantees, and deployment guidance |
| [Technical Docs](docs/INDEX.md) | Architecture, protocol, and cryptography |

## Development

```bash
npm install        # Install dependencies
npm test           # Run test suite
npm run build      # Build for production
```

### Interactive Demo

See the protocol in action:

```bash
npm run demo:keygen       # Generate test credentials
./scripts/tmux.sh start   # Launch 4-pane demo (requires tmux)
```

See [Guide](docs/GUIDE.md) for full instructions.

## Contributing

Contributions are welcome! Please:

1. Open an issue to discuss significant changes before starting work
2. Fork the repository and create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request with a clear description

## Security

See [SECURITY.md](docs/SECURITY.md) for:

- Threat model and security guarantees
- What FROSTR protects against (and what it doesn't)
- Secure deployment checklist
- Reporting security vulnerabilities

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [FROST Paper](https://eprint.iacr.org/2020/852) by Chelsea Komlo and Ian Goldberg
- [Noble Cryptography](https://paulmillr.com/noble/) by Paul Miller
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) community

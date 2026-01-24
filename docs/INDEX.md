# Technical Documentation

In-depth technical documentation for developers who want to understand the internals of the FROSTR protocol and Bifrost SDK.

## Documents

| Document | Description |
|----------|-------------|
| [Guide](./GUIDE.md) | Getting started with code examples and interactive demo |
| [API Reference](./API.md) | Full API documentation |
| [Development](./DEVELOPMENT.md) | Build, test, debugging, and git workflow |
| [Contributing](./CONTRIBUTING.md) | Code style, PR process, and testing guidelines |
| [Migration](./MIGRATION.md) | Version upgrade guides |
| [Glossary](./GLOSSARY.md) | Definitions of protocol-specific terminology |
| [Architecture](./ARCHITECTURE.md) | System components, data flow, and extension points |
| [Protocol](./PROTOCOL.md) | Wire protocol specification and message formats |
| [Cryptography](./CRYPTOGRAPHY.md) | Cryptographic primitives, FROST protocol, and security properties |
| [Security](./SECURITY.md) | Threat model and deployment guidance |

## Reading Order

For new contributors:

1. **[Glossary](./GLOSSARY.md)** - Establish vocabulary
2. **[Guide](./GUIDE.md)** - See the protocol in action
3. **[Development](./DEVELOPMENT.md)** - Build, test, and debug
4. **[Architecture](./ARCHITECTURE.md)** - See how components fit together
5. **[Cryptography](./CRYPTOGRAPHY.md)** - Understand the crypto foundations
6. **[Protocol](./PROTOCOL.md)** - Learn the wire format and nonce management

## External Resources

- [FROST Paper](https://eprint.iacr.org/2020/852) - Original protocol specification
- [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) - Schnorr signature standard
- [Noble Cryptography](https://paulmillr.com/noble/) - Underlying crypto libraries
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) - Transport layer

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full guidelines. Quick tips for documentation:

1. Use terminology from [GLOSSARY.md](./GLOSSARY.md)
2. Reference source files with `file.ts:line` format
3. Keep code examples synchronized with actual API
4. Update cross-references when adding new documents

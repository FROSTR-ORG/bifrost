# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bifrost is the SDK and reference node implementation for the **FROSTR protocol** - a threshold cryptography protocol for distributed signing using Nostr relays. It enables M-of-N threshold signing where multiple parties collaborate to sign messages without any single party having the full secret key.

## Build & Test Commands

```bash
npm test          # Run all tests (uses tape framework with tsx loader)
npm run build     # Build project (TypeScript + Rollup bundling)
npm run release   # Run tests and build
npm run scratch   # Ad-hoc testing via test/scratch.ts
npm run keygen    # Generate test keypairs via test/keygen.ts
```

Tests are located in `test/src/case/unit/`. Entry point is `test/tape.ts`.

## Architecture

### Core Classes

- **`BifrostNode`** (`src/class/client.ts`): Main entry point. Orchestrates signing/ECDH operations, manages peer connections via Nostr relays, and emits typed events.
- **`BifrostSigner`** (`src/class/signer.ts`): Low-level cryptographic operations - signs messages, generates ECDH shares, handles encryption/decryption.

### Source Structure

```
src/
├── api/        # Request/response handlers (sign, ecdh, ping, echo)
├── class/      # BifrostNode, BifrostSigner, SignerQueue, EventEmitter
├── encoder/    # Bech32 encoding/decoding for group/share packages
├── lib/        # Core protocol functions (group, sign, session, ecdh)
├── schema/     # Zod validation schemas
├── types/      # TypeScript interfaces and type definitions
└── util/       # Crypto helpers, assertions, parsing
```

### API Pattern

All APIs follow a consistent sender/handler pattern:
- `*_sender_api()` - Initiates requests to peers
- `*_handler_api()` - Processes incoming requests from peers
- `*_request_api()` - User-facing async interface returning `ApiResponse<T>`

### Key Concepts

- **GroupPackage**: Contains group public key + member commitments (encoded as bech32 `bfgroup1...`)
- **SharePackage**: Contains member's secret share + index (encoded as bech32 `bfshare1...`)
- **Peer policies**: Each peer has `{ send: bool, recv: bool }` controlling message routing

### Package Exports

```typescript
import { BifrostNode, BifrostSigner } from '@frostr/bifrost'
import { encode_group_package, decode_group_package } from '@frostr/bifrost/encoder'
import { generate_dealer_package } from '@frostr/bifrost/lib'
import { get_pubkey } from '@frostr/bifrost/util'
```

### Dependencies

- `@vbyte/frost` - FROST threshold signing implementation
- `@vbyte/nostr-sdk` - Nostr relay P2P communication
- `@noble/curves` - secp256k1 Schnorr signatures
- `@noble/ciphers` - ChaCha20-Poly1305 encryption
- `zod` - Runtime validation

## TypeScript Configuration

- Path alias: `@/*` maps to `src/*`
- Strict mode enabled (noImplicitAny, noUnusedLocals, noUnusedParameters)
- Target: ESNext, Module: NodeNext

## Current Development Focus

Active work on `feature/proto_upgrade` branch addressing nonce security:
- Randomized nonce generation to prevent key leakage from nonce reuse
- HD keypair derivation per peer for unique nonce packages

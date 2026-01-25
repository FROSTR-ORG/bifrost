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
npm run demo      # Launch interactive 4-pane tmux demo
```

Tests are located in `test/case/unit/`. Entry point is `test/runner.ts`.

## Architecture

### Core Classes

- **`BifrostNode`** (`src/class/client.ts`): Main entry point. Orchestrates signing/ECDH operations, manages peer connections via Nostr relays, and emits typed events.
- **`BifrostSigner`** (`src/class/signer.ts`): Low-level cryptographic operations - signs messages, generates ECDH shares, handles encryption/decryption.

### Source Structure

```
src/
├── api/        # Request/response handlers (sign, ecdh, ping, echo)
├── class/      # BifrostNode, BifrostSigner, SignBatcher, ECDHBatcher, EventEmitter
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

## Commit Guidelines

Follow [Conventional Commits](https://conventionalcommits.org/) format:

```
<type>: <subject>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks, dependencies |
| `style` | Formatting, whitespace (no code change) |
| `perf` | Performance improvement |

### Rules

- **Subject line**: Max 72 characters, imperative mood ("add feature" not "added feature")
- **Body**: Wrap at 80 characters, explain *what* and *why* (not *how*)
- **Scope**: Optional, use parentheses: `feat(signer): add batch signing`
- **Breaking changes**: Add `!` after type: `feat!: remove deprecated API`

### Examples

```bash
# Simple fix
fix: handle empty nonce pool gracefully

# Feature with scope
feat(api): add sign_batch method for bulk signing

# Breaking change with body
feat!: change ECDH return type to tuple

The previous string return made it difficult to correlate
requests with responses in batch operations.

# Docs update
docs: add commit guidelines to CLAUDE.md
```

### Don'ts

- Don't amend commits unless explicitly asked
- Don't use `git add -A` or `git add .` (stage specific files)
- Don't commit generated files (dist/, node_modules/)
- Don't commit secrets or credentials


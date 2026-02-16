# Code Conventions

This document defines coding conventions for `@frostr/bifrost`.

## Quick Reference

| Context | Convention | Examples |
|---------|------------|----------|
| Files | `lowercase.ts` | `client.ts`, `signer.ts`, `pool.ts` |
| Library functions | `snake_case` | `create_psig_pkg()`, `parse_error()` |
| Class public methods | `camelCase` | `connect()`, `close()`, `update_peer()` |
| Private fields | `_snake_case` | `_config`, `_signer`, `_is_ready` |
| Config properties | `snake_case` | `max_retries`, `msg_timeout` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_POOL_SIZE` |
| Types/Interfaces | `PascalCase` | `GroupPackage`, `SharePackage` |
| Zod schemas | `lowercase` | `num`, `hex`, `str`, `stamp` |

## Import Organization

```typescript
// 1. Class imports (internal)
import { EventEmitter }              from './emitter.js'
import { BifrostSigner }             from './signer.js'
import { SignBatcher, ECDHBatcher }  from './batcher.js'

// 2. External library imports
import { NostrNode }      from '@vbyte/nostr-sdk'
import { parse_error }    from '@vbyte/nostr-sdk/lib'

// 3. Internal library imports
import { convert_pubkey } from '@/util/crypto.js'
import { now }            from '@/util/helpers.js'

// 4. Type imports (separate block with `type` keyword)
import type {
  BifrostNodeConfig,
  BifrostNodeEvent,
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

// 5. Namespace imports for schemas and APIs
import * as API from '@/api/index.js'
import Schema   from '@/schema/index.js'
```

**Rules:**
- Use `@/` path alias with `.js` extension
- Vertical alignment on `from` keyword
- Type imports in separate block using `import type`

## Class Structure

Standard class anatomy (see `src/class/client.ts`):

```typescript
export class BifrostNode extends EventEmitter<BifrostNodeEvent> {

  // 1. Private readonly fields
  private readonly _client : NostrNode
  private readonly _config : BifrostNodeConfig
  private readonly _signer : BifrostSigner

  // 2. Private mutable fields
  private _is_ready : boolean = false

  // 3. Constructor with config merging
  constructor (
    group    : GroupPackage,
    share    : SharePackage,
    relays   : string[],
    options? : BifrostNodeOptions
  ) {
    super()
    this._config = { ...DEFAULT_CONFIG(), ...options }
  }

  // 4. Public getters
  get config () { return this._config }
  get is_ready () { return this._is_ready }

  // 5. Private methods (underscore prefix)
  _filter (msg : RpcMessageData) { /* ... */ }

  // 6. Public methods (camelCase)
  async connect () : Promise<void> { /* ... */ }
  async close () : Promise<void> { /* ... */ }
}
```

## Type Patterns

### ApiResponse<T>

Safe error handling via discriminated union (see `src/types/api.ts`):

```typescript
export type ApiResponse<T = any> = ApiResponseOk<T> | ApiResponseError

export interface ApiResponseOk<T = any> {
  ok   : true
  data : T
}

export interface ApiResponseError {
  ok  : false
  err : string
}
```

Usage:
```typescript
const result = await node.req.sign('message')
if (!result.ok) return console.error(result.err)
console.log(result.data)
```

### Interfaces

Vertical alignment on colons (see `src/types/node.ts`):

```typescript
export interface BifrostNodeConfig {
  debug          : boolean
  middleware     : BifrostNodeMiddleware
  policies       : PeerConfig[]
  default_policy : PeerPolicy
  sign_interval  : number
  max_sign_batch : number
}
```

## Assertion Functions

Type guard assertions in `src/util/assert.ts`:

```typescript
export namespace Assert {
  export function ok (value : unknown, message ?: string) : asserts value {
    if (typeof value !== 'boolean') {
      throw new TypeError('Assert.ok() requires a boolean value')
    }
    if (value === false) throw new Error(message ?? 'Assertion failed!')
  }

  export function exists <T> (
    input   ?: T | null,
    err_msg ?: string
  ) : asserts input is NonNullable<T> {
    if (typeof input === 'undefined') {
      throw new TypeError(err_msg ?? 'Input is undefined!')
    }
    if (input === null) {
      throw new TypeError(err_msg ?? 'Input is null!')
    }
  }
}
```

## Zod Schemas

### Base Types

Short lowercase names with refinement chaining (see `src/schema/base.ts`):

```typescript
const num   = z.number()
const uint  = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const stamp = z.number().min(500_000_000).max(Number.MAX_SAFE_INTEGER)

const hex   = z.string().regex(/^[0-9a-fA-F]*$/).refine(e => e.length % 2 === 0)
const hex32 = hex.refine((e) => e.length === 64)
const hex64 = hex.refine((e) => e.length === 128)

const bech32 = z.string().regex(/^[a-z]+1[023456789acdefghjklmnpqrstuvwxyz]+$/)
```

### Schema Validation

```typescript
const parsed = Schema.node.config.safeParse(config)
if (!parsed.success) throw new Error('invalid node config')
```

## Config Defaults

Factory function pattern (see `src/class/client.ts`):

```typescript
const DEFAULT_CONFIG = () : BifrostNodeConfig => ({
  debug          : false,
  middleware     : {},
  policies       : [],
  default_policy : { send: true, recv: true },
  sign_interval  : DEFAULT_SIGN_INTERVAL,
  max_sign_batch : MAX_SIGN_BATCH_SIZE
})

// In constructor
this._config = { ...DEFAULT_CONFIG(), ...options }
```

## Constants

Grouped by category with descriptive names (see `src/const.ts`):

```typescript
// === Timeouts (milliseconds) ===
export const DEFAULT_SIGN_INTERVAL = 100
export const DEFAULT_ECDH_INTERVAL = 100
export const DEFAULT_MSG_TIMEOUT   = 15000

// === Batch Processing ===
export const MAX_SIGN_BATCH_SIZE = 100
export const MAX_ECDH_BATCH_SIZE = 100

// === Bech32 Prefixes ===
export const PREFIX_SHARE   = 'bfshare'
export const PREFIX_GROUP   = 'bfgroup'
export const PREFIX_ONBOARD = 'bfonboard'
```

## Formatting Rules

### Vertical Alignment

Align colons in:
- Interface properties
- Object literals
- Function parameters
- Variable declarations

```typescript
// Interface (src/types/node.ts)
export interface NodeConfig {
  msg_timeout? : number
  sub_timeout? : number
  max_retries? : number
}

// Object literal (src/class/client.ts)
const nostr_config = {
  msg_timeout : DEFAULT_MSG_TIMEOUT,
  sub_timeout : DEFAULT_SUB_TIMEOUT
}

// Function parameters (src/class/signer.ts)
constructor (
  group : GroupPackage,
  share : SharePackage
) {
```

### General Rules

- 2-space indentation (no tabs)
- Spaces around operators
- Space before and after colon in type annotations
- No semicolons (unless required)
- Trailing commas in multiline structures

### Biome Configuration

From `biome.json`:
- **Formatter**: Disabled (manual formatting)
- **Linter**: Enabled
- **Unused imports/variables**: Error
- **`noExplicitAny`**: Off (allowed when necessary)
- **`noBannedTypes`**: Off

## Module Organization

```
src/
├── api/        # Request/response handlers (sign, ecdh, ping, echo)
├── class/      # BifrostNode, BifrostSigner, SignBatcher, ECDHBatcher
├── encoder/    # Bech32 encoding/decoding for group/share packages
├── lib/        # Core protocol functions (group, sign, session, ecdh)
├── schema/     # Zod validation schemas
├── types/      # TypeScript interfaces and type definitions
└── util/       # Crypto helpers, assertions, parsing
```

### Index Files

- Flat re-exports for implementation modules
- Namespace exports for schemas

```typescript
// lib/index.ts
export * from './sign.js'
export * from './ecdh.js'
export * from './session.js'

// schema/index.ts
export { default as base } from './base.js'
export { default as node } from './node.js'
```

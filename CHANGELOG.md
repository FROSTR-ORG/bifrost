# CHANGELOG

## [2.0.2]

### Improvements

- **Debug logging**: Added namespaced debug loggers using the `debug` package (`bifrost:sign`, `bifrost:ecdh`, `bifrost:ping`, `bifrost:echo`, `bifrost:onboard`). Enable with `DEBUG=bifrost:* npm test`
- **Error context**: Preserved error context in `parse.ts` catch blocks for better debugging
- **Type safety**: Fixed `hasEvenY` typing in crypto utilities, added public getters for `sign_batcher` and `ecdh_batcher`
- **Release tooling**: Added `--dev` flag to `release.sh` for development releases, updated CI workflow

### Code Quality

- Replaced `console.log` debug statements with `debug` package
- Fixed all lint errors (template literals, `for...of` loops, assignment expressions)
- Fixed timing-dependent cache tests with larger margins

### Documentation

- Updated `CLAUDE.md` with correct paths and commit guidelines
- Updated `README.md` with missing API methods (`sign_batch`, `ecdh_batch`, `onboard`)
- Added `RELEASE.md` documenting release workflow and npm dist-tags
- Updated `DEVELOPMENT.md` with code quality section
- Fixed stale `@cmdcode/nostr-p2p` reference in `ARCHITECTURE.md`

### Testing

- Added 172 new unit tests (544 → 716 total)
- New test files: `schema.test.ts`, `client.test.ts`, `middleware.test.ts`, `batcher.test.ts`
- Comprehensive coverage for schema validation, BifrostNode, middleware, and batchers

### Dependencies

- Added `debug` ^4.4.3

---

## [2.0.1]

### Bug Fixes

- **Timer cleanup in EventEmitter**: Fixed `within()` method to properly clean up timers when events fire, and added `timer.unref()` to prevent blocking Node.js process exit
- **Batcher resource leaks**: Added `close()` methods to `ECDHBatcher` and `SignBatcher` that clear pending timers and reject queued requests
- **BifrostNode cleanup**: Updated `close()` to properly close batchers before closing the underlying Nostr client

### Improvements

- **EventEmitter**: Added `clear_listeners()` method for full cleanup of event handlers (single event or all events)
- **Clean process exit**: Node.js process now exits cleanly after operations complete without hanging

### Demo Fixes

- Fixed outdated SDK property references (`msg.env.pubkey` → `msg.event.pubkey`)
- Fixed nonces access pattern (array length check instead of direct comparison)
- Fixed noble curves API usage (`randomPrivateKey` → `randomSecretKey`)

---

## [2.0.0]

### Breaking Changes

- **Nonce protocol redesign**: Complete overhaul of nonce management with HMAC-based derivation
  - Nonces now use a 32-byte derivation code instead of storing full 64-byte secrets
  - Secrets are re-derived on-demand during signing using HMAC-SHA256
  - Single `nonces` array in signing requests (replaces separate `nonce_commits`/`nonce_codes` arrays)
  - `MemberPublicNonce` now includes `idx` for member identification

- **Simplified nonce types**: Reduced from 8+ types to 5 clean types
  - `PublicNonce`: Base type (binder_pn, hidden_pn)
  - `DerivedPublicNonce`: With derivation code
  - `MemberPublicNonce`: With member index (wire format)
  - `SecretNoncePair`: For signing operations
  - `NoncePackage`: Simple array of `DerivedPublicNonce`

- **Pool storage changes**: Single Map per peer (was 2 Maps + 1 Set)
  - Deletion equals consumption (no separate spent tracking)
  - Code-based lookup replaces ID computation

### Security

- **HMAC-based nonce derivation**: Prevents key leakage from nonce reuse
  - `binder_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/binder/v1")`
  - `hidden_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/hidden/v1")`
- **One-time nonce consumption**: Nonces deleted immediately after use
- **Session binding**: Prevents replay attacks across sessions
- **Fresh random codes**: Cryptographically random 32-byte codes per nonce

### Improvements

- **Reduced memory usage**: 32 bytes per nonce (was 64 bytes)
- **Simplified wire protocol**: Unified `nonces` array in sign requests
- **Better TypeScript types**: Cleaner type hierarchy with proper inheritance
- **HD keypair derivation**: Per-peer unique nonce packages

### Dependencies

- `@vbyte/frost` 1.1.5
- `@vbyte/nostr-sdk` 1.0.0 (replaces `@cmdcode/nostr-p2p`)
- `@noble/curves` 2.0.1
- `@noble/ciphers` 2.1.1
- `@noble/hashes` 2.0.1

### Migration Guide

If upgrading from 1.x:

1. **Nonce pools are incompatible**: Clear any persisted nonce data and re-exchange via `ping`
2. **Type imports may change**: Update imports if using internal nonce types
3. **Wire format changed**: Peers must all upgrade together (no mixed-version groups)

---

## [1.0.8]

### Breaking Changes

- `Assert.ok()` now throws `TypeError` if the value is not a boolean. Previously it only checked for `=== false`, allowing non-boolean values to pass silently.

### Bug Fixes

- Fixed `normalize_obj()` filter bug that was destructuring strings instead of key-value pairs when filtering undefined values.

### Security

- Replaced `Math.random()` with cryptographically secure `crypto.getRandomValues()` for peer selection in `select_random_peers()`.

### Improvements

- Removed `console.log` statements from `parse_group_pkg()` and `parse_share_pkg()` - error details are now included in the thrown error message.
- Fixed `any` types in `SignRequest` interface (`resolve` now typed as `SignatureEntry`, `reject` as `string`).
- Fixed catch block in `SignerQueue.process()` to use `unknown` type with proper error parsing.

## [1.0.7]

### Changes

- Added an `is_ready` boolean to the client.

## [1.0.6]

### Changes

- Added new `echo` method for sending a message to yourself.

## [1.0.5]

### Changes

- Removed the auto-update of peer policy from the ping response.

## [1.0.4]

### Changes

- Added schema and validation checks for node config and updates to the peer data object (through API).

## [1.0.3]

### Changes

- Updated `ping` so that it only solicits a single peer. You must provide a pubkey of the peer that you wish to solicit.

## [1.0.2]

### Changes

- Updated `ping` requests to respond with policy information from the solicited peer.
- Updated bifrost to manage `PeerData` on each peer, which includes status and timestamp.
- Updated `ping` handling so that pings are utilized efficiently on both send and receive.

## [1.0.1]

### Changes

- Refactored encoder methods and moved to `src/encoder`.
- Added encoding methods for credentials (bfcred), which contains both share and group data.
- Added a new package import for `@frostr/bifrost/encoder`.

## [1.0.0]

Initial release.

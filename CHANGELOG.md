# CHANGELOG

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

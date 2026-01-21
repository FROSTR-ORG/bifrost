# CHANGELOG

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

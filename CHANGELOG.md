# CHANGELOG

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

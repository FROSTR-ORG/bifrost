# Security Audit Report (2026-02-16)

## Scope
Static audit of `src/` with emphasis on security, robustness, and DRY.  
Validation run: `npm run check`, `npm run test:unit` (both passing).

## Executive Summary
The codebase has strong schema usage, good cryptographic library choices (`@noble/*`, `@vbyte/frost`), and solid unit coverage.  
Primary risks are resource-exhaustion vectors and identity-binding gaps in onboarding/pool management.

## Findings

### 1) High: Unbounded incoming nonce storage can cause memory exhaustion
- Evidence:
`src/class/pool.ts:214` stores all incoming nonces with no cap.
`src/schema/nonce.ts:46` defines `nonce_package` as unbounded array.
`src/api/ping.ts:150`, `src/api/sign.ts:453`, and `src/api/onboard.ts:190` ingest remote nonce arrays.
- Impact:
An authorized peer can repeatedly send oversized nonce packages and force unbounded memory growth (`Map` per peer).
- Recommendation:
Enforce per-peer limits in `store_incoming` (e.g., max `pool_size`), reject over-limit payloads, and add schema `.max(MAX_POOL_SIZE)` where applicable.

### 2) Medium: Onboarding request is not bound to sender identity
- Evidence:
`src/api/onboard.ts:90` checks only that `idx` exists in group.
No check that `msg.event.pubkey` matches `request.idx` member pubkey.
No check that `request.share_pk` matches group member pubkey.
- Impact:
A valid peer can request onboarding material for another member index, causing nonce/state confusion and potential operational DoS.
- Recommendation:
Require both:
`pubkeys_match(member.pubkey, msg.event.pubkey)` and `pubkeys_match(member.pubkey, request.share_pk)` before responding.

### 3) Medium: Network payload schemas lack max bounds (DoS risk)
- Evidence:
Unbounded arrays in:
`src/schema/sign.ts:32`, `src/schema/sign.ts:33`, `src/schema/sign.ts:46`, `src/schema/sign.ts:55`,
`src/schema/package.ts:37`,
`src/schema/peer.ts:26`, `src/schema/peer.ts:27`, `src/schema/peer.ts:37`.
- Impact:
Large request/response bodies can increase parse/validation CPU and memory pressure.
- Recommendation:
Add `.max(...)` constraints tied to protocol constants (`MAX_SIGN_BATCH_SIZE`, `MAX_ECDH_BATCH_SIZE`, `MAX_POOL_SIZE`, group-size caps).

### 4) Medium: Echo endpoint bypasses authorization entirely
- Evidence:
`src/class/client.ts:231` allows all `echo` requests before auth checks.
`src/api/echo.ts:44` reflects attacker-provided payload.
- Impact:
Relay-exposed node can be used for unauthenticated probing/reflection and unnecessary resource usage.
- Recommendation:
Restrict echo to self (`msg.event.pubkey === node.pubkey`) or gate behind explicit config/rate limiting.

### 5) Medium: Nonce validation is format-only, not curve-validity
- Evidence:
`src/lib/nonce.ts:267` checks only length/prefix/code.
Comment at `src/lib/nonce.ts:284` defers point validity checks to signing stage.
- Impact:
Malformed nonces can fill incoming pools and fail later during signing, enabling repeated reliability degradation.
- Recommendation:
Validate curve points at ingest (`verify_point`) in `validate_public_nonce` or `store_incoming`.

### 6) Low: `NoncePool.import` accepts runtime state without schema validation
- Evidence:
`src/class/pool.ts:541` trusts incoming `state` shape and contents.
- Impact:
Corrupt or tampered persisted state can poison runtime maps or trigger hard failures.
- Recommendation:
Run `Schema.nonce.pool_state.safeParse(state)` before import and reject invalid state.

## DRY / Maintainability Notes
- Repeated member lookup logic appears in multiple APIs (`src/api/sign.ts:133`, `src/api/ping.ts:60`, `src/api/onboard.ts:184`).
- Consolidating identity/member resolution and sender-binding checks into a shared helper would reduce drift and security regressions.

## Suggested Fix Order
1. Cap nonce ingestion + schema bounds.
2. Bind onboarding request identity to sender.
3. Tighten echo authorization.
4. Add full nonce point validation.
5. Add pool import schema validation.

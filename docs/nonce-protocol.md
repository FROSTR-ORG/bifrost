# Nonce Pool Protocol

This document describes the nonce pool protocol used in Bifrost for threshold signing operations.

## Overview

In FROST threshold signing, each signing session requires fresh nonces to ensure security. Nonces must never be reused - reusing a nonce with different messages can leak the secret key.

The nonce pool system manages the generation, distribution, and consumption of nonces between peers in a threshold signing group.

## Key Features

1. **HMAC-Based Derivation**: Instead of storing full secret nonces (64 bytes), we store only a 32-byte derivation code. Secrets are re-derived on-demand during signing using HMAC.

2. **Simplified Design**: Uses `code` as the unique identifier (no separate `id` field), member index is implicit from context.

3. **No Spent Tracking**: Deletion from the pool equals consumption - no separate spent sets needed.

4. **Unified Wire Format**: Single `nonces` array in signing requests contains all information (idx, code, public points).

## Type Hierarchy

```typescript
// Base public nonce (binder_pn + hidden_pn only)
interface PublicNonce {
  binder_pn: string  // 33 bytes hex
  hidden_pn: string  // 33 bytes hex
}

// With derivation code (pool storage, nonce packages)
interface DerivedPublicNonce extends PublicNonce {
  code: string  // 32 bytes hex
}

// With member index (signing wire format only)
interface MemberPublicNonce extends DerivedPublicNonce {
  idx: number  // member index
}

// Secret pair for signing
interface SecretNoncePair {
  code: string
  binder_sn: string  // 32 bytes hex
  hidden_sn: string  // 32 bytes hex
}

// Nonce package for ping/replenish (just array, no wrapper)
type NoncePackage = DerivedPublicNonce[]
```

## Nonce Lifecycle

### 1. Generation

When generating nonces for a peer:

```
1. Generate random 32-byte derivation code
2. Derive secret nonces via HMAC:
   - binder_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/binder/v1")
   - hidden_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/hidden/v1")
3. Compute public nonces:
   - binder_pn = G * binder_sn
   - hidden_pn = G * hidden_sn
4. Store the nonce by code in outgoing pool
5. Send DerivedPublicNonce (binder_pn, hidden_pn, code) to peer
```

### 2. Distribution

Nonces are distributed via two mechanisms:

**During Ping:**
- Check `should_send_nonces_to(peer_idx)` - does our OUTGOING pool for this peer have fewer than `min_threshold` active nonces?
- If yes, generate and send `replenish_count` new nonces as `NoncePackage` (array of DerivedPublicNonce)

**During Sign Requests:**
- Sign requests can include optional `replenish` packages
- Allows proactive replenishment during normal operations

### 3. Storage

**Outgoing Pool (what we generated for peers):**
```typescript
// Map<peer_idx, Map<code, DerivedPublicNonce>>
{
  nonces: Map<string, DerivedPublicNonce>  // code -> nonce
}
```

**Incoming Pool (what peers sent us):**
```typescript
// Map<peer_idx, Map<code, DerivedPublicNonce>>
{
  nonces: Map<string, DerivedPublicNonce>  // code -> nonce
}
```

### 4. Usage in Signing

**When initiating a sign request:**
1. For each peer, consume a nonce from our INCOMING pool
2. The consumed nonce is returned as `MemberPublicNonce` (with peer's idx)
3. Generate our own nonce for the session
4. Send sign request with unified `nonces` array:
   - Each entry is a `MemberPublicNonce` (idx + code + public points)

**When handling a sign request:**
1. Find our nonce in `session.nonces` by our idx
2. Verify code exists in our outgoing pool for the requester
3. Re-derive secret using: `derive_secret_nonce(share_secret, code)`
4. Sign with derived secret
5. Delete nonce from outgoing pool (deletion = spent)

### 5. Consumption = Deletion

- Once a nonce is used in a signature, it's deleted from the pool
- No separate spent tracking needed
- Deletion from the map serves as the consumption marker

## Wire Protocol

### Nonce Package (ping/replenish)

Just an array of `DerivedPublicNonce` - sender/target implicit from P2P context:
```json
[
  { "binder_pn": "...", "hidden_pn": "...", "code": "..." },
  { "binder_pn": "...", "hidden_pn": "...", "code": "..." }
]
```

### Sign Request

Unified `nonces` array of `MemberPublicNonce`:
```json
{
  "gid": "...",
  "sid": "...",
  "hashes": [...],
  "members": [1, 2],
  "nonces": [
    { "idx": 1, "binder_pn": "...", "hidden_pn": "...", "code": "..." },
    { "idx": 2, "binder_pn": "...", "hidden_pn": "...", "code": "..." }
  ]
}
```

- Single `nonces` array (no separate `nonce_commits` / `nonce_codes`)
- `idx` identifies which member the nonce belongs to
- `code` allows the nonce generator to derive their secret

## Protocol Flow

### Ping Exchange

```
Node A                              Node B
   |                                   |
   |---[ping req + nonces]------------>|
   |   (if should_send_nonces_to(B))   |
   |   nonces: DerivedPublicNonce[]    |
   |                                   |
   |<--[ping res + nonces]-------------|
   |   (if should_send_nonces_to(A))   |
   |   nonces: DerivedPublicNonce[]    |
   |                                   |
```

### Signing Flow

```
Requester                           Signer
    |                                  |
    |-- Consume nonce from pool -------|
    |   (returns MemberPublicNonce)    |
    |                                  |
    |---[sign req]-------------------->|
    |   nonces: MemberPublicNonce[]    |
    |                                  |
    |                                  |-- Find our nonce by idx
    |                                  |-- Verify code in outgoing pool
    |                                  |-- Derive secret from code
    |                                  |-- Sign with derived secret
    |                                  |-- Delete nonce from pool
    |                                  |
    |<--[partial sig]------------------|
    |                                  |
```

## Security Considerations

### Nonce Reuse Prevention

Nonces must NEVER be reused. The protocol prevents this via:
1. Single-use consumption from pools (deletion on use)
2. Fresh random codes for each nonce
3. Pool state ensures uniqueness

### HMAC Derivation Security

The HMAC-based derivation ensures:
- Different codes produce different secrets
- Only the share holder can derive secrets
- Secrets are never transmitted or stored persistently
- Compromised code without share secret is useless

### Direction Logic

The protocol ensures proper direction checking:
- `should_send_nonces_to(peer_idx)` checks OUTGOING pool
- "Does this peer need nonces FROM ME?"
- Prevents over-sending to peers with full pools
- Prevents under-sending to peers with empty pools

### Self-Healing

The protocol is self-healing:
- If a peer has too few nonces, they request more
- No explicit acknowledgment needed
- Transient failures don't cause permanent state divergence

## Configuration

```typescript
{
  pool_size: 100,           // Target pool size per peer
  min_threshold: 20,        // Trigger replenishment below this
  critical_threshold: 5,    // Refuse signing below this
  replenish_count: 50       // How many nonces to send during replenishment
}
```

## Benefits of Simplified Design

| Metric | Before | After |
|--------|--------|-------|
| Types | 8+ nonce types | 5 types |
| Fields in pool storage | 5 (id, idx, binder_pn, hidden_pn, code) | 3 (binder_pn, hidden_pn, code) |
| Fields on wire (signing) | 5 + separate arrays | 4 (idx, binder_pn, hidden_pn, code) in single array |
| Memory per peer | 2 Maps + 1 Set | 1 Map |
| Sign request arrays | 2 (nonce_commits, nonce_codes) | 1 (nonces) |
| Code complexity | id computation, spent tracking, separate arrays | Direct code-based lookup, unified nonce array |

# Wire Protocol Specification

This document specifies the wire protocol for FROSTR peer-to-peer communication, including message formats, schemas, and validation requirements.

## Overview

FROSTR uses Nostr relays as the transport layer. All protocol messages are:

1. **Serialized** as JSON
2. **Encrypted** with ChaCha20-Poly1305 (ECDH-derived keys)
3. **Wrapped** in Nostr events
4. **Routed** via tag-based dispatch

```
┌─────────────────────────────────────────────────────────────────┐
│                    Message Transport                             │
└─────────────────────────────────────────────────────────────────┘

  Application          Bifrost            Nostr Relay
      │                   │                   │
      │  req.sign()       │                   │
      │──────────────────>│                   │
      │                   │  Serialize JSON   │
      │                   │  Encrypt          │
      │                   │  Wrap in event    │
      │                   │──────────────────>│
      │                   │                   │  Store & forward
      │                   │                   │──────────> Peers
```

## Message Envelope

### Nostr Event Structure

Protocol messages are sent as Nostr events (kind 20000+):

```json
{
  "id": "<event_id>",
  "pubkey": "<sender_pubkey>",
  "created_at": 1234567890,
  "kind": 20000,
  "tags": [
    ["p", "<recipient_pubkey>"]
  ],
  "content": "<encrypted_payload>",
  "sig": "<schnorr_signature>"
}
```

### Encrypted Payload

The `content` field contains:

```
nonce (12 bytes) || ciphertext || auth_tag (16 bytes)
```

Decryption requires the shared secret derived via ECDH between sender and recipient.

### Message Structure

After decryption, messages have the structure:

```json
{
  "tag": "/sign/req",
  "data": { ... },
  "env": {
    "pubkey": "<sender_pubkey>",
    "created_at": 1234567890
  }
}
```

## Message Tags

| Tag | Direction | Purpose |
|-----|-----------|---------|
| `/ping/req` | Request | Peer discovery, nonce exchange |
| `/ping/res` | Response | Connection confirmation, nonces |
| `/sign/req` | Request | Threshold signing request |
| `/sign/res` | Response | Partial signature |
| `/ecdh/req` | Request | Threshold ECDH request |
| `/ecdh/res` | Response | ECDH share |
| `/echo/req` | Request | Relay connectivity test |
| `/echo/res` | Response | Echo reply |
| `/onboard/req` | Request | New member onboarding |
| `/onboard/res` | Response | Group package for new member |

## Signing Protocol

### Sign Request (`/sign/req`)

Initiates a threshold signing session.

**Schema:**
```typescript
{
  gid: string           // 32-byte hex - Group ID
  sid: string           // 32-byte hex - Session ID
  members: number[]     // Participating member indices (sorted)
  hashes: string[][]    // Sighash vectors: [[sighash, ...tweaks], ...]
  nonces: [{            // Public nonces for all members
    idx: number         // Member index
    binder_pn: string   // 33-byte hex - Binder public nonce
    hidden_pn: string   // 33-byte hex - Hidden public nonce
    code: string        // 32-byte hex - Derivation code
  }, ...]
  content: string|null  // Optional metadata
  type: string          // Session type (e.g., "message")
  stamp: number         // Unix timestamp
  replenish?: [{...}]   // Optional nonce replenishment
}
```

**Example:**
```json
{
  "gid": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd",
  "sid": "b2c3d4e5f6789012345678901234567890123456789012345678901234abcde1",
  "members": [1, 2],
  "hashes": [
    ["c3d4e5f67890123456789012345678901234567890123456789012345678901234"]
  ],
  "nonces": [
    {
      "idx": 1,
      "binder_pn": "02abc123...",
      "hidden_pn": "03def456...",
      "code": "d4e5f6..."
    },
    {
      "idx": 2,
      "binder_pn": "02ghi789...",
      "hidden_pn": "03jkl012...",
      "code": "e5f6g7..."
    }
  ],
  "content": null,
  "type": "message",
  "stamp": 1704067200
}
```

### Sign Response (`/sign/res`)

Returns a partial signature.

**Schema:**
```typescript
{
  idx: number           // Signer's member index
  psigs: [              // Partial signatures
    [string, string],   // [sighash, partial_sig]
    ...
  ]
  pubkey: string        // 33-byte hex - Signer's public key
  sid: string           // 32-byte hex - Session ID (must match request)
  nonce_code?: string   // 32-byte hex - Nonce code used (for verification)
  replenish?: [{...}]   // Optional nonce replenishment
}
```

**Example:**
```json
{
  "idx": 2,
  "psigs": [
    [
      "c3d4e5f67890123456789012345678901234567890123456789012345678901234",
      "f6g7h8i9..."
    ]
  ],
  "pubkey": "02xyz...",
  "sid": "b2c3d4e5f6789012345678901234567890123456789012345678901234abcde1"
}
```

## ECDH Protocol

### ECDH Request (`/ecdh/req`)

Requests threshold ECDH with one or more public keys.

**Schema:**
```typescript
{
  gid: string           // 32-byte hex - Group ID
  members: number[]     // Participating member indices
  ecdh_pks: string[]    // Target public keys (33-byte hex each)
}
```

**Example:**
```json
{
  "gid": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd",
  "members": [1, 2],
  "ecdh_pks": [
    "02target_pubkey_1...",
    "03target_pubkey_2..."
  ]
}
```

### ECDH Response (`/ecdh/res`)

Returns ECDH key shares.

**Schema:**
```typescript
{
  idx: number           // Responder's member index
  members: number[]     // Participating members (must match request)
  entries: [{           // One entry per requested pubkey
    ecdh_pk: string     // 33-byte hex - Target public key
    keyshare: string    // 33-byte hex - ECDH key share
  }, ...]
}
```

**Example:**
```json
{
  "idx": 2,
  "members": [1, 2],
  "entries": [
    {
      "ecdh_pk": "02target_pubkey_1...",
      "keyshare": "02share_for_pk1..."
    },
    {
      "ecdh_pk": "03target_pubkey_2...",
      "keyshare": "03share_for_pk2..."
    }
  ]
}
```

## Ping Protocol

### Ping Request (`/ping/req`)

Discovers peers and exchanges nonces.

**Schema:**
```typescript
{
  nonces?: [{           // Optional nonce package
    binder_pn: string   // 33-byte hex
    hidden_pn: string   // 33-byte hex
    code: string        // 32-byte hex
  }, ...]
}
```

**Example:**
```json
{
  "nonces": [
    {
      "binder_pn": "02abc...",
      "hidden_pn": "03def...",
      "code": "1234..."
    }
  ]
}
```

### Ping Response (`/ping/res`)

Confirms connectivity and returns nonces.

**Schema:**
```typescript
{
  nonces?: [{           // Optional nonce package
    binder_pn: string
    hidden_pn: string
    code: string
  }, ...]
}
```

## Echo Protocol

### Echo Request (`/echo/req`)

Tests relay connectivity (sent to self).

**Schema:**
```typescript
{
  challenge: string     // Random challenge value
}
```

### Echo Response (`/echo/res`)

Returns the challenge (proves message round-trip).

**Schema:**
```typescript
{
  challenge: string     // Must match request
}
```

## Onboarding Protocol

### Onboard Request (`/onboard/req`)

Requests group information for a new member.

**Schema:**
```typescript
{
  pubkey: string        // New member's public key
}
```

### Onboard Response (`/onboard/res`)

Returns group package for the new member.

**Schema:**
```typescript
{
  group: string         // Bech32m-encoded GroupPackage
}
```

## Nonce Pool Management

This section describes the nonce pool protocol used for threshold signing operations.

> **Security Note:** Nonce reuse is catastrophic for Schnorr signatures - it leaks the secret key. See [Cryptographic Foundations - Nonce Security](CRYPTOGRAPHY.md#nonce-security) for security properties.

### Overview

The nonce pool system manages the generation, distribution, and consumption of nonces between peers in a threshold signing group.

### Key Features

1. **HMAC-Based Derivation**: Instead of storing full secret nonces (64 bytes), we store only a 32-byte derivation code. Secrets are re-derived on-demand during signing using HMAC.

2. **Simplified Design**: Uses `code` as the unique identifier (no separate `id` field), member index is implicit from context.

3. **No Spent Tracking**: Deletion from the pool equals consumption - no separate spent sets needed.

4. **Unified Wire Format**: Single `nonces` array in signing requests contains all information (idx, code, public points).

### Type Hierarchy

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

The sender/target is implicit from the P2P message context.

### Nonce Lifecycle

#### 1. Generation

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

#### 2. Distribution

Nonces are distributed via two mechanisms:

**During Ping:**
- Check `should_send_nonces_to(peer_idx)` - does our OUTGOING pool for this peer have fewer than `min_threshold` active nonces?
- If yes, generate and send `replenish_count` new nonces as `NoncePackage` (array of DerivedPublicNonce)

**During Sign Requests:**
- Sign requests can include optional `replenish` packages
- Allows proactive replenishment during normal operations

#### 3. Storage

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

#### 4. Usage in Signing

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

#### 5. Consumption = Deletion

- Once a nonce is used in a signature, it's deleted from the pool
- No separate spent tracking needed
- Deletion from the map serves as the consumption marker

### Nonce Protocol Flow

#### Ping Exchange

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

#### Signing Flow

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

### Pool Configuration

```typescript
{
  pool_size: 100,           // Target pool size per peer
  min_threshold: 20,        // Trigger replenishment below this
  critical_threshold: 5,    // Refuse signing below this
  replenish_count: 50       // How many nonces to send during replenishment
}
```

### Nonce Security Considerations

#### Nonce Reuse Prevention

Nonces must NEVER be reused. The protocol prevents this via:
1. Single-use consumption from pools (deletion on use)
2. Fresh random codes for each nonce
3. Pool state ensures uniqueness

#### HMAC Derivation Security

The HMAC-based derivation ensures:
- Different codes produce different secrets
- Only the share holder can derive secrets
- Secrets are never transmitted or stored persistently
- Compromised code without share secret is useless

#### Direction Logic

The protocol ensures proper direction checking:
- `should_send_nonces_to(peer_idx)` checks OUTGOING pool
- "Does this peer need nonces FROM ME?"
- Prevents over-sending to peers with full pools
- Prevents under-sending to peers with empty pools

#### Self-Healing

The protocol is self-healing:
- If a peer has too few nonces, they request more
- No explicit acknowledgment needed
- Transient failures don't cause permanent state divergence

## Session Computation

### Group ID Computation

```
gid = SHA256(
  group_pk[33 bytes] ||
  threshold[4 bytes, little-endian] ||
  member_pubkeys[33 bytes each, sorted by idx]
)
```

### Session ID Computation

```
sid = SHA256(
  gid[32 bytes] ||
  members[4 bytes each, sorted] ||
  hashes[variable, concatenated] ||
  content[variable, or 0x00 if null] ||
  type[variable, UTF-8] ||
  stamp[4 bytes, little-endian]
)
```

### Bind Hash Computation

Used for nonce binding:

```
bind_hash = SHA256(
  sid[32 bytes] ||
  idx[4 bytes, little-endian] ||
  sighash[32 bytes]
)
```

## Validation

### Schema Validation

All messages are validated using Zod schemas before processing:

**Base Types:**
```typescript
const hex32 = z.string().regex(/^[0-9a-f]{64}$/)  // 32-byte hex
const hex33 = z.string().regex(/^[0-9a-f]{66}$/)  // 33-byte hex (compressed point)
const num = z.number().int().nonnegative()
const str = z.string()
```

**Key files:** `src/schema/*.ts`

### Required Validations

#### Sign Request Validation
1. `gid` matches computed group ID
2. `sid` matches computed session ID
3. `members` includes only valid member indices
4. `members.length >= threshold`
5. `nonces` includes entry for each member in `members`
6. Each nonce code exists in outgoing pool for requester

#### Sign Response Validation
1. `sid` matches request session ID
2. `pubkey` is a valid group member
3. `psigs` includes entry for each sighash in request
4. Each partial signature is cryptographically valid

#### ECDH Request Validation
1. `gid` matches computed group ID
2. `members` includes only valid member indices
3. `members.length >= threshold`
4. All `ecdh_pks` are valid secp256k1 points

#### ECDH Response Validation
1. `members` matches request
2. `entries` includes entry for each requested pubkey
3. All `keyshare` values are valid secp256k1 points

## Error Handling

### Rejection Reasons

When a request is rejected, the handler emits an event with a reason:

| Reason | Meaning |
|--------|---------|
| `unauthorized` | Sender not in peer allow list |
| `invalid_session` | Session ID verification failed |
| `invalid_gid` | Group ID doesn't match |
| `unknown_member` | Member index not in group |
| `threshold_not_met` | Not enough members for threshold |
| `nonce_not_found` | Required nonce not in pool |
| `nonce_invalid` | Nonce verification failed |
| `signature_invalid` | Partial signature verification failed |

### Error Response Format

Rejections are not sent as explicit messages. Instead:
- Handler emits rejection event locally
- Request times out on sender side
- Sender receives timeout error

This prevents information leakage about rejection reasons to potentially malicious peers.

## Timing

### Timestamps

All timestamps are Unix timestamps (seconds since epoch).

### Request Timeout

Default timeout for requests is configurable. If responses aren't received within the timeout, the request fails.

### Replay Prevention

Session IDs include timestamps. Receivers should reject sessions with:
- Timestamps too far in the past (stale)
- Timestamps in the future (clock skew)

Recommended tolerance: ±5 minutes.

## Wire Format Summary

| Message | Required Fields |
|---------|-----------------|
| `/sign/req` | gid, sid, members, hashes, nonces, stamp, type |
| `/sign/res` | idx, psigs, pubkey, sid |
| `/ecdh/req` | gid, members, ecdh_pks |
| `/ecdh/res` | idx, members, entries |
| `/ping/req` | (none, nonces optional) |
| `/ping/res` | (none, nonces optional) |
| `/echo/req` | challenge |
| `/echo/res` | challenge |
| `/onboard/req` | pubkey |
| `/onboard/res` | group |

## Version Compatibility

The wire protocol uses implicit versioning through field presence:

- **v1 (legacy)**: Static nonces in GroupPackage/SharePackage
- **v2 (current)**: Dynamic nonces with MemberPublicNonce

The library automatically detects and handles both formats for backward compatibility.

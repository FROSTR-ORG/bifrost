# Cryptographic Foundations

This document describes the cryptographic primitives, protocols, and security properties of the FROSTR protocol and Bifrost SDK.

## Overview

FROSTR implements threshold cryptography using well-audited, constant-time libraries:

| Library | Version | Purpose |
|---------|---------|---------|
| `@noble/curves` | 2.0.1 | secp256k1 curve operations, Schnorr signatures |
| `@noble/ciphers` | 2.1.1 | ChaCha20-Poly1305 authenticated encryption |
| `@noble/hashes` | 2.0.1 | SHA-256, HMAC-SHA256 |
| `@vbyte/frost` | 1.1.5 | FROST threshold signing protocol |

All Noble libraries implement:
- Constant-time operations to prevent timing side-channel attacks
- No dynamic memory allocation in cryptographic hot paths
- Extensive test vectors from NIST, Wycheproof, and protocol specifications

## Key Management

### Key Types

| Key Type | Size | Format | Purpose |
|----------|------|--------|---------|
| Group Public Key | 33 bytes | Compressed SEC1 | Verify group signatures, identify group |
| Member Public Key | 33 bytes | Compressed SEC1 | Identify member, verify partial signatures |
| Secret Share | 32 bytes | Scalar | Member's secret for signing operations |
| BIP-340 Public Key | 32 bytes | X-only | Nostr identity, relay communication |

### Key Derivation

Group keys are generated using a trusted dealer model:

```
generate_dealer_package(threshold, members, [secrets])
  ├── Generate polynomial of degree (threshold - 1)
  │   └── Constant term = secret key (or random)
  ├── Evaluate polynomial at indices 1..members
  │   └── Each evaluation = member's secret share
  ├── Compute group public key from secret
  └── Return { group, shares }
```

**Key files:**
- `src/lib/package.ts` - `generate_dealer_package()`
- `@vbyte/frost/lib` - Core polynomial operations

### Public Key Derivation

Member public keys are derived from secret shares:

```
member_pubkey = seckey * G
```

Where `G` is the secp256k1 generator point. The group public key is similarly derived from the (never-assembled) group secret.

## Threshold Signing (FROST)

### Protocol Overview

FROST enables M-of-N threshold Schnorr signatures where:
- N total shareholders exist
- Any M shareholders can collaborate to sign
- The group secret is **never reconstructed**, even during signing
- The resulting signature is a standard BIP-340 Schnorr signature

### Why FROST?

Traditional threshold schemes require reconstructing the secret key for signing. FROST avoids this by:
1. Each party computes a **partial signature** using their share
2. Partial signatures are **aggregated** into a complete signature
3. Aggregation is purely mathematical - no secrets are combined

### Signing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FROST Signing Flow                       │
└─────────────────────────────────────────────────────────────────┘

1. NONCE GENERATION (pre-signing)
   ┌─────────┐     ┌─────────┐     ┌─────────┐
   │ Alice   │     │  Bob    │     │  Carol  │
   └────┬────┘     └────┬────┘     └────┬────┘
        │               │               │
        │  Generate     │  Generate     │  Generate
        │  (k_a, R_a)   │  (k_b, R_b)   │  (k_c, R_c)
        │               │               │
        └───────────────┼───────────────┘
                        │
                  Exchange R_i
                   commitments

2. PARTIAL SIGNATURE (during signing)
   ┌─────────┐     ┌─────────┐
   │ Alice   │     │  Bob    │
   └────┬────┘     └────┬────┘
        │               │
        │ s_a = k_a +   │ s_b = k_b +
        │   e*a*λ_a     │   e*b*λ_b
        │               │
        └───────┬───────┘
                │
          Partial sigs
            s_a, s_b

3. AGGREGATION
   ┌─────────────────────┐
   │     Aggregator      │
   │                     │
   │  s = s_a + s_b      │
   │  R = R_a + R_b      │
   │                     │
   │  Signature: (R, s)  │
   └─────────────────────┘
```

Where:
- `k_i` = secret nonce for party i
- `R_i` = public nonce commitment (k_i * G)
- `e` = challenge hash (message + R + pubkey)
- `λ_i` = Lagrange coefficient for party i's index
- `a, b` = secret shares

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `create_partial_sig()` | `src/lib/sign.ts:139` | Generate partial signature from share and nonce |
| `create_psig_pkg()` | `src/lib/sign.ts:30` | Package partial signatures for transmission |
| `verify_psig_pkg()` | `src/lib/sign.ts:64` | Verify received partial signature package |
| `combine_signature_pkgs()` | `src/lib/sign.ts:111` | Aggregate partials into final signature |

### Signature Verification

The final signature `(R, s)` satisfies:

```
s * G = R + e * P
```

Where `P` is the group public key and `e = H(R || P || m)`. This is the standard BIP-340 verification equation - verifiers cannot distinguish FROST signatures from single-signer Schnorr signatures.

## Nonce Security

### The Nonce Reuse Problem

Nonce reuse is catastrophic for Schnorr signatures. If the same nonce `k` is used to sign two different messages `m1` and `m2`:

```
s1 = k + e1 * x
s2 = k + e2 * x

s1 - s2 = (e1 - e2) * x
x = (s1 - s2) / (e1 - e2)  ← SECRET KEY LEAKED
```

An attacker observing two signatures with the same nonce can trivially extract the secret key.

### FROSTR's Nonce Security Model

FROSTR implements a robust nonce management system:

#### 1. HMAC-Based Derivation

Instead of storing secret nonces (which could be reused), FROSTR stores only random derivation codes:

```
code = random(32 bytes)
binder_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/binder/v1")
hidden_sn = HMAC-SHA256(share_secret, code || "bifrost/nonce/hidden/v1")
```

This ensures:
- Different codes produce different nonces (HMAC properties)
- Only the share holder can derive secrets (keyed by share_secret)
- Secrets exist only transiently during signing

#### 2. One-Time Consumption

```
Storage: Map<code, DerivedPublicNonce>

consume_nonce(code):
  nonce = pool.get(code)
  pool.delete(code)    ← DELETION = CONSUMPTION
  return nonce
```

Once a nonce is used, it's deleted. No separate "spent" tracking is needed - if it's not in the pool, it's been used (or never existed).

#### 3. Session Binding

Each nonce is cryptographically bound to a specific signing session:

```
bind_hash = SHA256(session_id || member_idx || sighash)
```

This prevents nonces from being replayed across different sessions.

## ECDH Key Exchange

### Threshold ECDH

FROSTR supports threshold ECDH where M parties collaboratively derive a shared secret with a remote public key, without any party learning the group's ECDH secret.

### Protocol

```
Remote public key: Q

For each member i with share s_i:
  keyshare_i = λ_i * s_i * Q

Combine:
  shared_secret = Σ keyshare_i = s * Q
```

Where `s = Σ λ_i * s_i` is the group secret (never computed directly) and `λ_i` are Lagrange coefficients.

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `create_ecdh_pkg()` | `src/lib/ecdh.ts:17` | Generate ECDH share for single pubkey |
| `create_batched_ecdh_pkg()` | `src/lib/ecdh.ts:40` | Generate shares for multiple pubkeys |
| `combine_ecdh_pkgs()` | `src/lib/ecdh.ts:68` | Combine shares into shared secret |

### Use Cases

- **Nostr NIP-04 encryption**: Derive shared secrets for encrypted DMs
- **Key derivation**: Derive child keys from the group key
- **Authenticated key exchange**: Establish session keys with remote parties

## Transport Encryption

### End-to-End Encryption

All peer-to-peer messages in FROSTR are encrypted end-to-end:

```
┌─────────────────────────────────────────────────────┐
│                  Message Encryption                 │
└─────────────────────────────────────────────────────┘

1. Key Agreement (ECDH)
   shared_secret = our_secret * their_pubkey

2. Key Derivation
   encryption_key = SHA256(shared_secret)

3. Encryption (ChaCha20-Poly1305)
   nonce = random(12 bytes)
   ciphertext = ChaCha20(key, nonce, plaintext)
   tag = Poly1305(key, ciphertext)

4. Envelope
   encrypted_message = nonce || ciphertext || tag
```

### Security Properties

- **Confidentiality**: ChaCha20 stream cipher encrypts message content
- **Integrity**: Poly1305 MAC detects any tampering
- **Authenticity**: ECDH binds encryption to sender's identity
- **Relay opacity**: Relays see only encrypted envelopes

### Key Functions

| Function | Class | Purpose |
|----------|-------|---------|
| `wrap()` | `BifrostSigner` | Encrypt content for recipient |
| `unwrap()` | `BifrostSigner` | Decrypt content from sender |

## Session Computation

Sessions bind all parameters of a signing operation to prevent replay attacks.

- **Group ID (`gid`)**: Hash of group pubkey + threshold + member pubkeys
- **Session ID (`sid`)**: Hash of gid + members + hashes + content + type + timestamp
- **Bind Hash**: Hash of sid + member idx + sighash (for nonce binding)

**Key file:** `src/lib/session.ts:124` - `get_session_id()`

**See:** [Protocol - Session Computation](PROTOCOL.md#session-computation) for byte-level format details.

## Security Considerations

### Constant-Time Operations

All cryptographic operations use constant-time implementations to prevent timing attacks:

```typescript
// Noble curves example - constant-time scalar multiplication
const signature = schnorr.sign(message, secretKey)
// Execution time independent of secret key bits
```

### Side-Channel Resistance

The libraries used implement:
- No secret-dependent branches
- No secret-dependent memory access patterns
- Secure memory clearing where possible

### Randomness Requirements

FROSTR requires cryptographically secure randomness for:
- Nonce derivation codes (32 bytes each)
- Polynomial coefficients during share generation
- Encryption nonces (12 bytes each)

Uses the platform's secure random source (`crypto.getRandomValues()` in browsers, `crypto.randomBytes()` in Node.js).

## Audit Status

| Library | Audit Status |
|---------|--------------|
| `@noble/curves` | Audited by Cure53 (2022) |
| `@noble/ciphers` | Audited by Cure53 (2023) |
| `@noble/hashes` | Audited by Cure53 (2022) |
| `@vbyte/frost` | Based on audited Noble primitives |

## References

- [FROST Paper](https://eprint.iacr.org/2020/852) - Original FROST specification
- [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) - Schnorr signatures for Bitcoin
- [RFC 8439](https://tools.ietf.org/html/rfc8439) - ChaCha20-Poly1305 specification
- [Noble Cryptography](https://paulmillr.com/noble/) - Library documentation and audit reports

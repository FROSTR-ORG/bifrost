# Security Model

This document describes the security model, threat assumptions, and deployment guidance for the FROSTR protocol and Bifrost SDK.

For cryptographic implementation details, see [Cryptographic Foundations](CRYPTOGRAPHY.md).

## Overview

FROSTR implements the FROST (Flexible Round-Optimized Schnorr Threshold) protocol for distributed key custody. The protocol enables M-of-N threshold signing where:

- **N** total shareholders hold secret shares
- **M** shareholders must collaborate to produce a valid signature
- No single party ever has access to the complete signing key
- The resulting signatures are standard BIP-340 Schnorr signatures, indistinguishable from single-signer outputs

## Security Guarantees

### Threshold Security

The core security property: an adversary must compromise at least M shareholders to forge signatures.

| Threshold | Shareholders | Compromise Tolerance |
|-----------|--------------|---------------------|
| 2-of-3    | 3            | 1 shareholder       |
| 3-of-5    | 5            | 2 shareholders      |
| 4-of-7    | 7            | 3 shareholders      |

**Key properties:**
- **No key reconstruction**: The complete secret key is never assembled, even during signing
- **Share independence**: Compromising one share reveals nothing about other shares
- **Threshold enforcement**: Fewer than M shares cannot produce a valid signature

### Nonce Security

Nonce management is critical in Schnorr threshold signing. Reusing a nonce with different messages leaks the secret key.

**FROSTR's protections:**

1. **HMAC-based derivation**: Secret nonces derived on-demand from random codes
2. **One-time consumption**: Nonces deleted immediately after use
3. **Fresh random codes**: Each nonce uses a cryptographically random 32-byte code
4. **Session binding**: Nonces bound to specific signing sessions
5. **Pool management**: Signing refused when pools are critically low

**See:** [Cryptographic Foundations - Nonce Security](CRYPTOGRAPHY.md#nonce-security) for detailed implementation.

### Transport Security

All peer-to-peer messages are encrypted end-to-end:

- **Algorithm**: ChaCha20-Poly1305 authenticated encryption
- **Key exchange**: ECDH using secp256k1
- **Per-message keys**: Fresh symmetric keys derived for each message
- **Relay opacity**: Relay operators cannot read message contents

## Threat Model

### What Bifrost Protects Against

| Threat | Protection |
|--------|------------|
| Single point of compromise | M-of-N threshold requires multiple shareholders |
| Insider threats | Up to M-1 malicious shareholders cannot forge |
| Relay surveillance | End-to-end encryption hides message contents |
| Network eavesdropping | All traffic is encrypted |
| Nonce reuse attacks | HMAC derivation + single-use consumption |
| Replay attacks | Session binding prevents signature replay |
| Message tampering | Authenticated encryption detects modifications |

### What Bifrost Does NOT Protect Against

| Threat | Limitation |
|--------|------------|
| Threshold+ compromise | If M or more shareholders are compromised, signatures can be forged |
| Side-channel attacks | Physical access to signing devices may leak secrets |
| Denial of service | If fewer than M shareholders are online, signing fails |
| Social engineering | Users can be tricked into signing malicious messages |
| Key generation compromise | If the dealer is compromised during setup, all shares are compromised |
| Weak entropy | Poor randomness during share generation undermines security |

### Trust Assumptions

1. **Honest majority below threshold**: At least N-M+1 shareholders are honest
2. **Secure random number generation**: System RNG provides cryptographically secure randomness
3. **Secure share distribution**: Shares are distributed via secure, authenticated channels (out-of-band)
4. **Relay availability**: At least one relay is accessible to all participants
5. **Time synchronization**: Participants have roughly synchronized clocks (for request timeouts)

## Implementation Security

### Input Validation

- **Zod schemas**: All incoming data is validated against strict schemas before processing
- **Type safety**: TypeScript strict mode catches type errors at compile time
- **Bounds checking**: Array indices and sizes are validated before access

### Error Handling

- **Explicit rejections**: Invalid requests are rejected with clear error messages
- **No silent failures**: Errors propagate rather than being swallowed
- **Resource cleanup**: Failed operations clean up partial state

### Secure Defaults

- **Encryption required**: All peer communication is encrypted by default
- **Policy enforcement**: Peer policies control who can send/receive
- **Pool thresholds**: Conservative defaults prevent nonce exhaustion

## Secure Deployment Checklist

### Share Generation

- [ ] Generate shares on an air-gapped or secure machine
- [ ] Use a cryptographically secure random source
- [ ] Verify threshold and member count before distribution
- [ ] Securely delete the dealer's key material after generation

### Share Distribution

- [ ] Distribute shares via secure, authenticated channels
- [ ] Never transmit multiple shares over the same channel
- [ ] Verify recipient identity before sending shares
- [ ] Have recipients confirm receipt and verify share validity

### Node Operation

- [ ] Run nodes in isolated environments
- [ ] Use multiple independent relays for redundancy
- [ ] Monitor nonce pool levels (warn on `critical_low`)
- [ ] Implement rate limiting via middleware for production use
- [ ] Log signing requests for audit trails

### Key Management

- [ ] Back up share packages securely
- [ ] Use hardware security modules (HSMs) for high-value keys
- [ ] Rotate shares periodically if the protocol supports it
- [ ] Have a recovery plan for lost shares

## Security Considerations for Developers

### Middleware for Access Control

Production deployments should implement middleware to control signing requests. Middleware can validate authorization, enforce rate limits, and log audit trails.

```typescript
const node = new BifrostNode(group, share, relays, {
  middleware: {
    sign: (node, msg) => {
      // Validate, rate-limit, or reject
      // Throw to reject, return msg to approve
      return msg
    }
  }
})
```

**See:** [Architecture - Extension Points](ARCHITECTURE.md#extension-points) for detailed middleware examples.

### Nonce Pool Monitoring

Monitor pool health to prevent signing failures:

```typescript
node.on('/sign/sender/rej', ([reason, session]) => {
  if (reason.includes('nonce')) {
    // Nonce pool exhausted - need to ping peers
    console.warn('Nonce pool critically low')
  }
})
```

### Nonce Exhaustion Considerations

**Theoretical concern:** A malicious group member could attempt to exhaust another member's nonce pool by initiating many signing requests without completing them (wasting nonces).

**FROSTR's design philosophy:** FROSTR operates optimistically, assuming trusted group members. All peers in a signing group have been explicitly added through a trusted key ceremony, so there is an implicit trust relationship.

**Mitigations:**
1. **Pool size limits**: Nonce generation enforces `pool_size` limits (default: 100) to prevent unbounded growth
2. **Critical thresholds**: Signing is refused when pools fall below `critical_threshold` (default: 5)
3. **Replenishment**: Nonces are automatically replenished during successful ping/sign operations
4. **Middleware**: Production deployments can implement rate limiting via middleware

For environments requiring stronger protection against malicious group members, rate limiting can be implemented at a lower level (relay, network, or middleware).

### Network Failure and Nonce Recovery

**Scenario:** If a signing request fails mid-protocol due to network issues, what happens to the consumed nonces?

**Solution:** Bifrost collects nonces once at the start of a signing request and reuses them for any retry attempts within that request. This is not a persistent cache—nonces are held in local scope for the duration of the single `sign_batch()` call.

**How it works:**

1. When `sign_batch()` is called, nonces are collected from peer pools immediately
2. These nonces are stored in the session object passed to the retry loop
3. If a network request fails, the same session (with the same nonces) is retried
4. Once the function returns (success or failure), the nonces are no longer held

**Configuration:**
```typescript
// Configure retry attempts (default: 1 retry)
const result = await node.req.sign_batch(messages, { retries: 2 })
```

**Why reusing nonces within a request is safe:**
- The session ID is deterministic from the message content and member set
- Retrying with the same session/nonces signs the same message
- Nonce reuse only leaks secrets when signing *different* messages—signing the same message is idempotent
- If a peer already processed the original request, they reject the retry (nonce already spent)—but this is no worse than a fresh attempt

**Best practices:**
- Configure `retries` based on your network reliability
- Monitor `debug` events to track retry attempts
- Ensure stable network connectivity for best performance

### Audit Logging

Log all signing operations for security audits:

```typescript
node.on('/sign/sender/ret', ([signature, entries]) => {
  audit.log({
    event: 'signature_produced',
    signature,
    timestamp: Date.now()
  })
})
```

**See:** [API Reference - Events](API.md#events) for the full list of events available for logging.

## References

- [FROST Paper](https://eprint.iacr.org/2020/852) - Original FROST protocol specification
- [BIP-340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) - Schnorr signatures for Bitcoin
- [Noble Cryptography](https://paulmillr.com/noble/) - Audited JavaScript cryptographic libraries
- [Nostr Protocol](https://github.com/nostr-protocol/nostr) - Decentralized relay network

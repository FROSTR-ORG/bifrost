# Glossary

This document defines terms used throughout the FROSTR protocol and Bifrost SDK documentation.

## Threshold Cryptography

### Threshold Signature
A cryptographic signature scheme where M-of-N parties must collaborate to produce a valid signature. No single party can sign independently, and fewer than M parties cannot produce a valid signature.

### Share
A fragment of a secret key held by one party in a threshold scheme. Shares are mathematically derived such that the original secret can only be reconstructed (or used for signing) when a threshold number of shares are combined.

### Dealer
The entity that generates and distributes secret shares during group setup. The dealer temporarily possesses the complete secret key during share generation, making secure dealer operation critical. After distribution, the dealer should securely delete all key material.

### Shareholder
A party holding a secret share in a threshold group. Shareholders participate in threshold operations by contributing their partial computations.

### Secret Sharing
The process of splitting a secret into multiple shares such that a threshold number of shares can reconstruct the secret, but fewer shares reveal nothing. FROSTR uses Shamir's Secret Sharing over elliptic curve scalars.

## FROST Protocol

### FROST
**F**lexible **R**ound-**O**ptimized **S**chnorr **T**hreshold signatures. A threshold signature protocol that produces standard Schnorr signatures compatible with BIP-340. FROST minimizes the number of communication rounds required for signing.

### Partial Signature
A signature fragment produced by one shareholder during threshold signing. Partial signatures are combined to create a complete, valid Schnorr signature. Individual partial signatures are not valid Schnorr signatures.

### Signature Aggregation
The process of combining partial signatures from M shareholders into a single valid Schnorr signature. The aggregated signature is mathematically indistinguishable from a signature produced by a single signer.

### Nonce
A **n**umber used **once** - a random value critical for Schnorr signature security. In threshold signing, each party must contribute fresh nonces for each signing session. Reusing a nonce with different messages catastrophically leaks the secret key.

### Nonce Commitment
The public component of a nonce (the nonce multiplied by the generator point). Commitments are shared before signing to enable partial signature verification without revealing the secret nonce.

### Binding Factor
A value derived from all participants' nonce commitments that binds each party's contribution to the collective signing session, preventing certain attacks.

## Bifrost-Specific Terms

### GroupPackage
Public data describing a threshold group. Contains the group public key, signing threshold, and member public keys. Encoded as a bech32m string with `bfgroup1` prefix. Safe to share publicly.

### SharePackage
Private data for a single group member. Contains the member's index and secret key share. Encoded as a bech32m string with `bfshare1` prefix. **Must be kept secret** - possession enables participation in threshold operations.

### OnboardPackage
Minimal data package for adding a new member to an existing group. Contains enough information for a new node to participate. Encoded as a bech32m string with `bfonboard1` prefix.

### Session
A single instance of a threshold operation (signing or ECDH). Sessions are uniquely identified and bound to specific parameters to prevent replay attacks.

### Session ID (sid)
A cryptographic hash that uniquely identifies a signing session. Computed from the group ID, participating members, message hashes, content, type, and timestamp. Binds all session parameters together.

### Group ID (gid)
A cryptographic hash identifying a threshold group. Computed from the group public key, threshold, and sorted member public keys. Used to verify that participants belong to the same group.

### Nonce Pool
A per-peer collection of pre-generated nonces that enables asynchronous signing without real-time nonce exchange. Each node maintains incoming pools (nonces received from peers) and outgoing pools (nonces generated for peers).

### Peer Policy
Configuration controlling message routing with a specific peer. Each peer has `send` and `recv` boolean flags determining whether the node will send messages to and receive messages from that peer.

## Nostr

### Relay
A WebSocket server that stores and forwards Nostr events. FROSTR uses relays as the transport layer for peer-to-peer communication. Relays see encrypted message envelopes but cannot read content due to end-to-end encryption.

### Pubkey
A 32-byte public key in BIP-340 format (x-only). Used to identify Nostr users and FROSTR group members. Displayed as 64 hexadecimal characters.

### Event
The fundamental message type in Nostr. Contains an author pubkey, signature, timestamp, kind, tags, and content. FROSTR wraps its protocol messages in Nostr events for relay transmission.

### NIP
**N**ostr **I**mplementation **P**ossibility - a specification document for Nostr features. FROSTR uses several NIPs including NIP-04 for encryption basics.

## Cryptographic Primitives

### BIP-340
Bitcoin Improvement Proposal 340 - the Schnorr signature standard used by Bitcoin's Taproot upgrade and Nostr. Defines x-only public keys (32 bytes) and 64-byte signatures. FROST signatures are fully BIP-340 compatible.

### secp256k1
The elliptic curve used for all FROSTR cryptographic operations. The same curve used by Bitcoin and Nostr. Provides approximately 128 bits of security.

### Schnorr Signature
A digital signature scheme based on the discrete logarithm problem. Schnorr signatures are linear, enabling threshold schemes like FROST. More efficient and mathematically simpler than ECDSA.

### ECDH
**E**lliptic **C**urve **D**iffie-**H**ellman key exchange. A protocol where two parties with public/private key pairs can derive a shared secret. FROSTR supports threshold ECDH where M parties collaboratively derive a shared secret.

### ChaCha20-Poly1305
An authenticated encryption cipher used for all peer-to-peer message encryption in FROSTR. Provides both confidentiality (encryption) and integrity (authentication). Used in IETF standardized form.

### HMAC
**H**ash-based **M**essage **A**uthentication **C**ode. A construction for creating keyed hash functions. FROSTR uses HMAC-SHA256 for deterministic nonce derivation from random codes.

### SHA-256
Secure Hash Algorithm producing 256-bit (32-byte) digests. Used throughout FROSTR for session IDs, group IDs, and nonce derivation.

## Additional Terms

### Quorum
The set of M members participating in a specific threshold operation. Different operations can use different quorums as long as each has at least M members.

### Member Index
A unique integer (starting from 1) identifying a member within a group. Indices are assigned during group creation and used for Lagrange interpolation during signature aggregation.

### Lagrange Coefficient
A mathematical factor used in polynomial interpolation. In threshold signatures, Lagrange coefficients adjust each partial signature based on which specific members are participating.

### Tweak
A value added to a key or signature to derive related keys. Used for BIP-32-style key derivation and Taproot compatibility.

### Sighash
The hash of a message to be signed. Multiple sighashes can be signed in a single session (batch signing). Each sighash can have optional tweaks applied.

### Wire Protocol
The specification for message formats sent between nodes. Defines the structure of requests, responses, and their JSON representations.

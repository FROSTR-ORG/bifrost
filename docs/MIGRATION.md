# Migration Guide

Step-by-step guides for upgrading between major versions.

---

## Migrating from 1.x to 2.x

Version 2.0 introduced a complete nonce protocol redesign for improved security. This is a **breaking change** that requires coordinated upgrades.

### Summary of Changes

| Area | 1.x | 2.x |
|------|-----|-----|
| Nonce storage | 64-byte secrets | 32-byte derivation codes |
| Nonce derivation | Stored directly | HMAC-based on-demand |
| Wire format | Separate arrays | Unified `nonces` array |
| Type count | 8+ nonce types | 5 clean types |
| Pool tracking | 2 Maps + 1 Set | Single Map per peer |

### Prerequisites

**All peers must upgrade together.** Mixed-version groups cannot sign because:
- Wire format is incompatible
- Nonce derivation differs
- Pool storage structure changed

### Step 1: Coordinate Upgrade Window

1. Notify all group members of planned upgrade
2. Schedule a time when all nodes can be offline briefly
3. Plan for nonce re-exchange after upgrade

### Step 2: Clear Persisted State

If you persist nonce pools, clear them before upgrading:

```typescript
// 1.x pool data is incompatible with 2.x
// Delete any saved pool state
await clearPersistedPools()
```

**Why?** The nonce storage format changed from storing secrets to storing derivation codes. Old data cannot be used.

### Step 3: Update Dependencies

```bash
npm install @frostr/bifrost@^2.0.0
```

### Step 4: Update Type Imports

If you import internal nonce types, update them:

```typescript
// 1.x (removed)
import type { NonceCommit, NoncePackageData } from '@frostr/bifrost'

// 2.x
import type {
  PublicNonce,        // Base: binder_pn, hidden_pn
  DerivedPublicNonce, // + code
  MemberPublicNonce,  // + idx (wire format)
  SecretNoncePair,    // For signing
} from '@frostr/bifrost'
```

### Step 5: Update Custom Pool Handling

If you implemented custom pool monitoring:

```typescript
// 1.x - checking nonce IDs
const hasNonce = pool.outgoing.has(nonceId)
const spent = pool.spent.has(nonceId)

// 2.x - code-based lookup, no spent tracking
const hasNonce = pool.has_nonce(peerPubkey, code)
// Deletion equals consumption - no separate spent set
```

### Step 6: Re-exchange Nonces

After all nodes are upgraded and connected:

```typescript
// Ping all peers to replenish nonce pools
for (const peer of node.peers) {
  await node.req.ping(peer.pubkey)
}
```

### Step 7: Verify

```typescript
// Check pool status
const status = node.pool.get_pool_status(peerPubkeys)
console.log('Pool healthy:', status.every(s => s.count >= 25))

// Test signing
const result = await node.req.sign('test message')
console.log('Signing works:', result.ok)
```

### Troubleshooting

#### "Invalid nonce format" errors

You have old 1.x nonce data. Clear persisted state and re-ping peers.

#### "No nonces available" after upgrade

Peers haven't exchanged nonces yet. Run `ping` for each peer.

#### Mixed version errors

Not all peers upgraded. Ensure every group member runs 2.x.

---

## Migrating from 1.0.2 to 1.0.3+

### Ping API Change

The `ping` method changed from broadcasting to single-peer:

```typescript
// 1.0.2 - broadcast to all peers
await node.req.ping()

// 1.0.3+ - must specify peer
await node.req.ping(peerPubkey)

// To ping all peers
for (const peer of node.peers) {
  await node.req.ping(peer.pubkey)
}
```

---

## Migrating from 1.0.0 to 1.0.1+

### Encoder Import Path

Encoder functions moved to a dedicated subpath:

```typescript
// 1.0.0
import { encode_group_package } from '@frostr/bifrost'

// 1.0.1+
import { encode_group_package } from '@frostr/bifrost/encoder'
```

---

## General Migration Tips

### Before Upgrading

1. **Read the CHANGELOG** - Check for breaking changes
2. **Test in isolation** - Upgrade a test environment first
3. **Backup share packages** - Never lose your credentials
4. **Coordinate with peers** - Major versions need group coordination

### After Upgrading

1. **Run tests** - Verify your integration still works
2. **Check pool health** - Ensure nonces are exchanged
3. **Monitor logs** - Watch for deprecation warnings
4. **Test signing** - Confirm end-to-end flow works

### Version Compatibility Matrix

| Your Version | Compatible Peers |
|--------------|------------------|
| 2.0.x | 2.0.x only |
| 1.0.3+ | 1.0.3 - 1.0.8 |
| 1.0.0 - 1.0.2 | 1.0.0 - 1.0.2 |

**Rule:** Minor versions are compatible. Major versions require coordinated upgrades.

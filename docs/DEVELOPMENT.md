# Development Guide

Quick reference for building, testing, and debugging Bifrost.

---

## Build & Test

```bash
npm test              # Run all tests (unit → e2e → integration)
npm run build         # TypeScript + Rollup bundling
npm run release       # Run tests and build

# Individual suites
npm run test:unit     # Fast, no network
npm run test:e2e      # End-to-end with relay
npm run test:int      # Integration tests

# Development
npm run scratch       # Ad-hoc testing via test/scratch.ts
VERBOSE=true npm test # Enable verbose logging
```

---

## Code Quality

Before committing, always run type checking and linting:

```bash
npm run check         # TypeScript type checking (tsc --noEmit)
npm run lint          # Biome linter
```

### Fixing Lint Issues

```bash
# Auto-fix safe issues
npx biome check src/ --write

# Auto-fix all issues (including unsafe)
npx biome check src/ --write --unsafe
```

### Common Lint Rules

| Rule | Issue | Fix |
|------|-------|-----|
| `useTemplate` | String concatenation | Use template literals: `` `text ${var}` `` |
| `noNonNullAssertion` | `value!` assertions | Use optional chaining or null checks |
| `useIterableCallbackReturn` | forEach returning value | Use `for...of` loop instead |
| `noAssignInExpressions` | `x ??= y` in expression | Separate assignment from expression |

### Debug Logging

The codebase uses the `debug` package with namespaced loggers:

```bash
# Enable all bifrost debug output
DEBUG=bifrost:* npm test

# Enable specific namespaces
DEBUG=bifrost:sign,bifrost:ecdh npm test
```

Available namespaces: `bifrost:sign`, `bifrost:ecdh`, `bifrost:ping`, `bifrost:echo`, `bifrost:onboard`

---

## Git Worktree Workflow

Use worktrees for parallel feature development without stashing.

### When to Use
- Working on multiple features simultaneously
- Testing changes against different branches
- Reviewing PRs while keeping main work intact

### Setup
```bash
# Create feature branch and worktree
git branch feature/my-feature
git worktree add ../bifrost-my-feature feature/my-feature

# Work in the new directory
cd ../bifrost-my-feature
npm install
```

### Merge & Cleanup
```bash
# From main worktree
git merge --no-ff feature/my-feature
git worktree remove ../bifrost-my-feature
git branch -d feature/my-feature
```

### Quick Reference

| Task | Command |
|------|---------|
| List worktrees | `git worktree list` |
| Add worktree | `git worktree add <path> <branch>` |
| Remove worktree | `git worktree remove <path>` |
| Prune stale | `git worktree prune` |

---

## Common Pitfalls

### 1. WebSocket Timing (Critical)

**Problem:** Nodes created before relay starts will fail silently.

```typescript
// WRONG - nodes created before relay starts
const relay = new NostrRelay(8192)
const nodes = import_test_nodes(labels, vec, [relay.url])
await relay.start()  // Too late!

// CORRECT - relay starts first
const relay = new NostrRelay(8192)
await relay.start()
const nodes = import_test_nodes(labels, vec, [relay.url])  // Safe
```

**Symptoms:** `connection timed out`, WebSocket stuck at `readyState=0`

### 2. Port Conflicts

**Problem:** Failed tests leave ports bound.

**Fix:**
```bash
lsof -ti:8192 | xargs -r kill -9
```

### 3. Nonce Exhaustion

**Problem:** Signing fails after pool depleted.

**Symptoms:** `no nonces available from peer X`, `can_sign()` returns false

**Fix:** Ensure ping exchange before signing (pings replenish nonces)

### 4. Test Interleaving

**Problem:** Tests pass alone but fail together.

**Cause:** Multiple suites share resources or run in unexpected order.

**Fix:** Run suites sequentially (default in `npm test`)

### 5. Timer Cleanup

**Problem:** Node.js won't exit after tests.

**Fix:** Always call `relay.close()` and `node.close()` in cleanup

---

## Debugging

### Error Messages

| Error | Cause | Fix |
|-------|-------|-----|
| `connection timed out` | Relay not running when nodes created | Start relay before creating nodes |
| `request timed out` | Peer offline or slow | Check peer, increase `sub_timeout` |
| `no nonces available` | Nonce pool empty | Run ping exchange first |
| `EADDRINUSE` | Port already bound | Kill process: `lsof -ti:PORT \| xargs -r kill -9` |
| `socket is closed` | WebSocket disconnected | Check relay still running |

### WebSocket States

```
0 = CONNECTING  - In progress
1 = OPEN        - Ready
2 = CLOSING     - Shutting down
3 = CLOSED      - Disconnected
```

### Inspect Node State

```typescript
function inspectNode(node: BifrostNode) {
  const sockets = (node as any)._client?.client?.sockets || []
  for (const s of sockets) {
    console.log(`${s.url}: readyState=${s.ws.readyState}`)
  }
}
```

### Check Active Handles

```typescript
// See what's keeping Node.js alive
const handles = (process as any)._getActiveHandles?.() || []
console.log(`Active handles: ${handles.length}`)
```

---

## Quick Reference

### Essential Commands

```bash
# Kill stuck processes
lsof -ti:8192,8193 | xargs -r kill -9

# Run specific test file
npx tsx --tsconfig ./test/tsconfig.json test/scratch.ts

# Verbose test output
VERBOSE=true npm run test:e2e
```

### SDK Config Overrides

```typescript
const node = new BifrostNode(group, share, relays, {
  sdk_config: {
    msg_timeout: 15000,  // Connection timeout (ms)
    sub_timeout: 30000   // Request timeout (ms)
  }
})
```

### Debugging Checklist

- [ ] Kill processes on test ports
- [ ] Verify relay starts before nodes created
- [ ] Check WebSocket `readyState`
- [ ] Run test in isolation
- [ ] Enable verbose logging

# Gotchas and Common Pitfalls

This document records non-obvious issues encountered during development. Read this before making significant changes to avoid repeating past mistakes.

---

## 1. WebSocket Connection Timing (Critical)

### The Problem
When using `@vbyte/nostr-sdk`, **BifrostNode/NostrNode instances must be created AFTER the relay is running**.

The SDK creates WebSocket connections immediately in the constructor:
```javascript
// In NostrSocket constructor
this._ws = new WebSocket(relay);  // Connects immediately!
```

If the relay isn't listening yet, the WebSocket receives `ECONNREFUSED`, emits an error event, but **stays in `readyState=0` (CONNECTING)** instead of properly closing. The SDK's `connect()` method then waits for a `ready` event that will never arrive, causing a timeout.

### Symptoms
- `Error: connection timed out` after 5-15 seconds
- WebSocket `readyState` stays at `0` even after relay starts
- Works when tests run independently, fails when run together

### The Fix
**Always start the relay before creating nodes:**

```typescript
// WRONG - nodes created before relay starts
const relay = new NostrRelay(8192)
const nodes = import_test_nodes(labels, vec, [relay.url], config)

tape.test('setup', async t => {
  await relay.start()  // Too late! WebSockets already failed
  await nodes.connect()  // Will timeout
})

// CORRECT - nodes created after relay starts
const relay = new NostrRelay(8192)
let ctx: TestNetwork

tape.test('setup', async t => {
  await relay.start()  // Relay listening first
  const pkg = import_test_nodes(labels, vec, [relay.url], config)  // Now safe
  ctx = { ...pkg, relays: [relay.url] }
  await ctx.nodes.forEach(n => n.connect())  // Will succeed
})
```

### Why This Was Hard to Find
- Tests passed when run in isolation (single test file = relay starts quickly)
- Tests failed when run together (multiple test suites = all nodes created before any relay starts)
- The WebSocket `readyState` staying at `0` instead of `3` was misleading

---

## 2. Tape Test Execution Order

### The Problem
When you call a function that registers `tape.test()` subtests, those subtests are **queued but not executed immediately**. The outer function completes synchronously, then tape runs the queued tests later.

```typescript
tape('Suite', t => {
  console.log('1. This runs first')

  setupTests(t)  // Registers subtests, runs setup code immediately

  console.log('2. This runs second (before any subtest!)')
})

function setupTests(t) {
  const resource = createResource()  // Runs immediately at call time!

  t.test('subtest', async t => {
    // This runs LATER, after '1' and '2'
    await useResource(resource)
  })
}
```

### Implications
- Resource creation in the outer scope happens before subtests run
- Multiple test modules can have their setup code run simultaneously
- Cleanup code in subtests may never run if earlier subtests fail

---

## 3. NostrRelay Timer Cleanup

### The Problem
The test relay's purge interval (`setInterval`) was not being cleared on close, preventing Node.js from exiting.

### The Fix
Store the interval handle and clear it:
```typescript
private _purge_timer: ReturnType<typeof setInterval> | null = null

start() {
  this._purge_timer = setInterval(() => { ... }, interval)
}

close() {
  if (this._purge_timer) {
    clearInterval(this._purge_timer)
    this._purge_timer = null
  }
  this.wss.close()
}
```

---

## 4. SDK Config Passthrough

### The Problem
The `@vbyte/nostr-sdk` has short default timeouts:
- `msg_timeout`: 5000ms (connection/message timeout)
- `sub_timeout`: 30000ms (subscription timeout)

### The Fix
Pass longer timeouts via `sdk_config` in `BifrostNodeConfig`:
```typescript
const node = new BifrostNode(group, share, relays, {
  sdk_config: {
    msg_timeout: 15000,  // 15s
    sub_timeout: 30000   // 30s
  }
})
```

The config chain is: `BifrostNode` → `NostrNode` → `NostrClient` → `NostrSocket`

---

## 5. Port Conflicts in Tests

### The Problem
If tests fail mid-way, cleanup doesn't run, leaving ports bound. Subsequent test runs fail with `EADDRINUSE`.

### The Fix
1. Use different ports for different test suites (e2e: 8192, integration: 8193)
2. Add cleanup that runs even on failure
3. Kill lingering processes before tests: `lsof -ti:8192 | xargs -r kill -9`

---

## 6. Nonce Pool Exhaustion

### The Problem
Signing operations consume nonces from the pool. If the pool is exhausted, signing fails with "no nonces available from peer X".

### Symptoms
- First few signatures work, then failures start
- `can_sign()` returns false
- Ping tests pass but sign tests fail

### The Fix
- Ensure ping exchange happens before signing (pings replenish nonces)
- Check `node.pool.can_sign()` before attempting signatures
- Monitor `needs_replenish` and `critical_low` events

---

## 7. Async Test Patterns with Tape

### The Problem
Tape's async handling can be tricky. Missing `await` or `t.end()` causes tests to hang or run out of order.

### Best Practices
```typescript
// For async tests, use async/await consistently
tape.test('async test', async t => {
  try {
    const result = await asyncOperation()
    t.ok(result, 'operation succeeded')
  } catch (err) {
    t.fail('operation failed: ' + err)
  }
  // No t.end() needed with async functions
})

// For sync tests that register subtests
tape.test('parent', t => {
  t.test('child 1', t => { ... t.end() })
  t.test('child 2', t => { ... t.end() })
  // Don't call t.end() on parent when it has children
})
```

---

## 8. Event Emitter Memory

### The Problem
The custom `EventEmitter` class stores handlers in maps. If handlers aren't removed, they can accumulate.

### Best Practices
- Use `once()` for one-time handlers
- Call `off()` or `clear()` when done with subscriptions
- The `within()` method auto-cleans up on timeout

---

## 9. Tape Test Suite Interleaving

### The Problem
When multiple test suites (e2e, integration) are registered with tape in the same run, tape may interleave their execution in unexpected ways. Tests pass in isolation but fail together.

### Symptoms
- E2E tests pass: `npm run script test/tape.e2e.ts` ✓
- Integration tests pass: `npm run script test/tape.int.ts` ✓
- Combined tests fail: `npm test` ✗

### The Cause
When you call `e2e_test_cases(t)` and `integration_test_cases(t)` back-to-back, both functions:
1. Create their NostrRelay objects
2. Register their `tape.test()` blocks with tape's queue

Tape then runs tests from its queue, potentially interleaving them or running them in unexpected order.

### The Fix
Run test suites sequentially as separate processes:
```json
"test": "npm run test:unit && npm run test:e2e && npm run test:int"
```

Or ensure proper isolation by waiting for one suite to fully complete before starting another.

---

## Summary Checklist

Before running tests:
- [ ] Kill any processes on test ports: `lsof -ti:8192,8193 | xargs -r kill -9`

When writing network tests:
- [ ] Create relay first, start it, THEN create nodes
- [ ] Use try/catch with cleanup in finally
- [ ] Set appropriate timeouts via `sdk_config`

When debugging connection issues:
- [ ] Check WebSocket `readyState` (0=CONNECTING, 1=OPEN, 3=CLOSED)
- [ ] Look for "connection timed out" errors
- [ ] Verify relay is running before node creation

When tests pass alone but fail together:
- [ ] Check for resource creation timing (before vs after relay start)
- [ ] Check for port conflicts
- [ ] Check for shared mutable state between test suites

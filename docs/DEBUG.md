# Debugging Guide for Bifrost

This guide provides techniques for debugging Bifrost nodes, tests, and the underlying `@vbyte/nostr-sdk`.

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Error Messages](#common-error-messages)
3. [WebSocket Debugging](#websocket-debugging)
4. [SDK Internals](#sdk-internals)
5. [Test Debugging](#test-debugging)
6. [Diagnostic Scripts](#diagnostic-scripts)
7. [SDK Source Reference](#sdk-source-reference)

---

## Quick Diagnostics

### Check for Port Conflicts
```bash
# See what's using test ports
lsof -i:8192,8193

# Kill lingering processes
lsof -ti:8192,8193 | xargs -r kill -9
```

### Check Active Node.js Handles
```typescript
// Add to your code to see what's keeping Node.js alive
function logHandles() {
  const handles = (process as any)._getActiveHandles?.() || []
  const requests = (process as any)._getActiveRequests?.() || []
  console.log(`Active handles: ${handles.length}, requests: ${requests.length}`)

  const types = handles.reduce((acc, h) => {
    const type = h.constructor?.name || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  console.log('Handle types:', types)
}
```

### Check Event Loop Lag
```typescript
function checkEventLoopLag() {
  const start = process.hrtime.bigint()
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1_000_000
    console.log(`Event loop lag: ${lag.toFixed(2)}ms`)
  })
}
```

---

## Common Error Messages

### `Error: connection timed out`

**Cause:** The SDK's `NostrNode.connect()` timed out waiting for a WebSocket connection.

**Debug steps:**
1. Check if the relay is running: `lsof -i:PORT`
2. Check WebSocket state (see [WebSocket Debugging](#websocket-debugging))
3. Verify nodes are created AFTER relay starts (see GOTCHAS.md)

**Root cause often:** Nodes were created before relay started, causing WebSocket to fail silently.

### `Error: request timed out`

**Cause:** An RPC request didn't receive a response within `sub_timeout`.

**Debug steps:**
1. Verify the target peer is online (check peer status)
2. Check if nonce pool is exhausted (for sign operations)
3. Increase timeout via `sdk_config: { sub_timeout: 60000 }`

### `Error: no nonces available from peer X`

**Cause:** The nonce pool for a peer is empty.

**Debug steps:**
1. Check pool status: `node.pool.get_pool_status(peer_pks)`
2. Verify ping exchange happened (pings replenish nonces)
3. Check `can_sign()` before attempting signatures

### `EADDRINUSE: address already in use`

**Cause:** A previous test/process left the port bound.

**Fix:**
```bash
lsof -ti:PORT | xargs -r kill -9
```

### `Error: socket is closed for ws://...`

**Cause:** Attempting to use a WebSocket that has already closed.

**Debug steps:**
1. Check `socket.ws.readyState` (see states below)
2. Verify relay is still running
3. Check for error events on the socket

---

## WebSocket Debugging

### WebSocket Ready States
```
0 = CONNECTING  - Connection in progress
1 = OPEN        - Connected and ready
2 = CLOSING     - Close in progress
3 = CLOSED      - Connection closed
```

### Inspect WebSocket State
```typescript
function inspectNode(node: BifrostNode) {
  const client = (node as any)._client  // NostrNode
  const nostrClient = client?.client    // NostrClient
  const sockets = nostrClient?.sockets || []

  for (const socket of sockets) {
    console.log(`Socket ${socket.url}:`)
    console.log(`  readyState: ${socket.ws.readyState}`)
    console.log(`  is_ready: ${socket.is_ready}`)
    console.log(`  subscriptions: ${socket.subs.size}`)
  }
}
```

### Monitor WebSocket Events
```typescript
function monitorWebSocket(node: BifrostNode, label: string) {
  const client = (node as any)._client
  const sockets = client?.client?.sockets || []

  for (const socket of sockets) {
    const ws = socket.ws

    ws.addEventListener('open', () =>
      console.log(`[${label}] WS open, state=${ws.readyState}`))

    ws.addEventListener('close', (e) =>
      console.log(`[${label}] WS close, code=${e.code}, state=${ws.readyState}`))

    ws.addEventListener('error', (e) =>
      console.log(`[${label}] WS error: ${e.message}, state=${ws.readyState}`))
  }
}
```

### Critical Insight: Failed Connection Behavior

When a WebSocket tries to connect to a non-listening port:
1. Error event fires with "Received network error or non-101 status code"
2. **But `readyState` stays at 0 (CONNECTING), not 3 (CLOSED)**
3. The SDK waits for `ready` event that will never come
4. Eventually times out

This is why nodes MUST be created after the relay starts.

---

## SDK Internals

### Class Hierarchy
```
BifrostNode (src/class/client.ts)
  └── NostrNode (@vbyte/nostr-sdk)
        └── NostrClient
              └── NostrSocket (one per relay)
                    └── WebSocket (native)
```

### Config Flow
```typescript
BifrostNodeConfig.sdk_config
  → NostrNode constructor options
    → NostrClient config
      → NostrSocket config (SOCKET_CONFIG defaults)
```

### Default Timeouts (SOCKET_CONFIG)
```typescript
{
  max_retries : 3,
  queue_ival  : 500,   // Message queue interval (ms)
  queue_limit : 10,    // Max queued messages
  msg_timeout : 5000,  // Connection/message timeout (ms)
  sub_timeout : 30000  // Subscription timeout (ms)
}
```

### Key SDK Events

**NostrSocket events:**
- `ready` - WebSocket connected
- `closed` - WebSocket closed
- `error` - WebSocket error
- `message` - Relay message received
- `receipt` - OK response for published event

**NostrNode events:**
- `ready` - Node fully connected and subscribed
- `closed` - Node disconnected
- `message` - RPC message received (after decryption)

### Tracing RPC Messages
```typescript
// In BifrostNode, trace all incoming messages
node.client.on('message', (msg) => {
  console.log('[RPC]', msg.type, msg.method || '', msg.event?.pubkey?.slice(0,8))
})
```

---

## Test Debugging

### Run Tests Verbosely
```bash
# E2E tests with relay/client logging
VERBOSE=true npm run script test/tape.e2e.ts

# Full debug output
DEBUG=true npm run script test/tape.e2e.ts
```

### Run Individual Test Suites
```bash
# Unit tests only (no network)
npm run script test/tape.unit.ts

# E2E tests only
npm run script test/tape.e2e.ts

# Integration tests only
npm run script test/tape.int.ts
```

### Isolate a Failing Test
Create a minimal reproduction in `test/scratch.ts`:
```typescript
import { NostrRelay } from './src/lib/relay.js'
import { import_test_nodes } from './src/lib/node.js'
// ... minimal code to reproduce issue
```

Run with: `npm run scratch`

### Debug Test Timing Issues
```typescript
// Add timestamps to trace execution order
const log = (msg: string) => console.log(`[${Date.now() % 100000}] ${msg}`)

log('Creating relay')
const relay = new NostrRelay(8192)

log('Starting relay')
await relay.start()

log('Creating nodes')
const pkg = import_test_nodes(...)

log('Connecting')
await node.connect()
```

---

## Diagnostic Scripts

### Check Connection Timing
Save as `test/debug-connection.ts`:
```typescript
import { NostrRelay } from './src/lib/relay.js'
import { import_test_nodes } from './src/lib/node.js'
import { parse_group_vector } from './src/lib/parse.js'
import VECTOR from './src/vector/group.vec.json' assert { type: 'json' }

async function main() {
  const relay = new NostrRelay(8199)
  const vec = parse_group_vector(VECTOR)

  console.log('[1] Starting relay FIRST')
  await relay.start()

  console.log('[2] Creating nodes AFTER relay')
  const pkg = import_test_nodes(['alice'], vec, [relay.url], {
    sdk_config: { msg_timeout: 5000 }
  })

  // Check WebSocket state
  for (const [name, node] of pkg.nodes.entries()) {
    const sockets = (node as any)._client?.client?.sockets || []
    for (const s of sockets) {
      console.log(`[3] ${name} readyState: ${s.ws.readyState}`)
    }
  }

  // Connect
  for (const [name, node] of pkg.nodes.entries()) {
    try {
      await node.connect()
      console.log(`[4] ${name} connected`)
    } catch (e) {
      console.log(`[4] ${name} FAILED: ${e}`)
    }
  }

  // Cleanup
  for (const n of pkg.nodes.values()) await n.close().catch(() => {})
  relay.close()
}

main()
```

Run: `npx tsx --tsconfig ./test/tsconfig.json test/debug-connection.ts`

---

## SDK Source Reference

The SDK is available as a submodule at `repos/nostr-sdk/`.

### Key Files

| File | Purpose |
|------|---------|
| `src/class/socket.ts` | WebSocket connection, timeouts, events |
| `src/class/client.ts` | Multi-relay aggregation |
| `src/class/node.ts` | P2P RPC communication |
| `src/class/sub.ts` | Subscription management |
| `src/class/queue.ts` | Rate-limited message queue |
| `src/lib/rpc.ts` | RPC message encoding/decoding |

### Building SDK from Source

```bash
cd repos/nostr-sdk
npm install
npm run build
```

### Linking Local SDK for Development

```bash
cd repos/nostr-sdk
npm link

cd ../..  # Back to bifrost-ts
npm link @vbyte/nostr-sdk
```

### SDK Debug Points

**Connection timeout** - `src/class/socket.ts:240-255`
```typescript
// The timeout that causes "connection timed out"
const timer = setTimeout(() => {
  this._connecting = false
  reject(new Error(`connection timeout for ${this.url}`))
}, timeout)
```

**RPC request timeout** - `src/class/node.ts` in `_listen()`
```typescript
// The timeout that causes "request timed out"
const timer = setTimeout(() => {
  cleanup()
  reject(new Error('request timed out'))
}, timeout)
```

---

---

## Running Tests Without Hanging

### Run Tests in Background
To avoid getting stuck on hanging tests:

```bash
# Run in background and monitor
npm test > /tmp/test-output.txt 2>&1 &
TEST_PID=$!

# Check progress periodically
sleep 10; tail -30 /tmp/test-output.txt

# Check if still running
ps -p $TEST_PID > /dev/null && echo "Running" || echo "Done"

# Kill if stuck
kill $TEST_PID 2>/dev/null
```

### Check Final Results
```bash
# Look for test summary
grep -E "^(# tests|# pass|# fail|# ok$)" /tmp/test-output.txt

# Count failures
grep "^not ok" /tmp/test-output.txt | wc -l
```

### Run Test Suites Separately
```bash
# Unit tests only (fast, no network)
npm run test:unit

# E2E tests only
npm run test:e2e

# Integration tests only
npm run test:int

# All suites sequentially (recommended)
npm test
```

---

## Debugging Checklist

When tests fail:

1. [ ] Kill processes on test ports: `lsof -ti:8192,8193 | xargs -r kill -9`
2. [ ] Check error message (see [Common Error Messages](#common-error-messages))
3. [ ] Verify relay starts before nodes are created
4. [ ] Check WebSocket states with `inspectNode()`
5. [ ] Run test in isolation: `npm run script test/tape.e2e.ts`
6. [ ] Add verbose logging: `VERBOSE=true`
7. [ ] Check for dangling timers/handles with `logHandles()`

When connections timeout:

1. [ ] Confirm relay is listening: `lsof -i:PORT`
2. [ ] Check WebSocket `readyState` immediately after node creation
3. [ ] Verify `sdk_config.msg_timeout` is sufficient
4. [ ] Look for error events on the WebSocket
5. [ ] Ensure node creation happens AFTER `relay.start()` resolves

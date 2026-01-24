/**
 * Integration Test Suite
 *
 * Comprehensive integration tests for the Bifrost protocol.
 * Uses a dedicated relay on port 8193 (different from e2e tests on 8192).
 */

import { LIB }                from '@vbyte/nostr-sdk'
const { sleep } = LIB
import { import_test_nodes }  from '@/test/lib/node.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { NostrRelay }         from '@/test/lib/relay.js'

import api_integration_tests     from './api/index.js'
import batcher_integration_tests from './batcher/index.js'
import pool_integration_tests    from './pool/index.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  const labels = [ 'alice', 'bob', 'carol' ]
  const relay  = new NostrRelay(8193)  // Different port from e2e tests
  const hosts  = [ relay.url ]
  const vec    = parse_group_vector(VECTOR)

  // Context is populated after relay starts (nodes must be created AFTER relay)
  let ctx : TestNetwork

  // Cleanup function that always runs
  const cleanup = async () => {
    try {
      if (ctx) {
        for (const node of ctx.nodes.values()) {
          await node.close().catch(() => {})
        }
      }
      relay.close()
    } catch { /* ignore cleanup errors */ }
  }

  tape.test('Integration Tests: Starting relay and nodes', async t => {
    try {
      // Start relay FIRST
      await relay.start()

      // Create nodes AFTER relay is running (critical for WebSocket connections)
      const pkg = import_test_nodes(labels, vec, hosts, {
        debug      : false,
        sdk_config : { msg_timeout: 15000, sub_timeout: 30000 }
      })
      ctx = { ...pkg, relays: hosts }

      // Connect nodes sequentially
      for (const node of ctx.nodes.values()) {
        await node.connect()
        await sleep(100)
      }
      await sleep(200)

      t.pass('relay started and nodes connected')
    } catch (err) {
      await cleanup()
      t.fail('failed to start relay/nodes: ' + String(err))
    } finally {
      t.end()
    }
  })

  tape.test('Integration Tests: Running test suites', t => {
    api_integration_tests(ctx, t)
    batcher_integration_tests(ctx, t)
    pool_integration_tests(ctx, t)
    t.end()
  })

  tape.test('Integration Tests: Stopping relay and nodes', async t => {
    await cleanup()
    // Wait for resources to fully release before next test suite
    await sleep(500)
    t.pass('relay and nodes stopped')
    t.end()
  })
}

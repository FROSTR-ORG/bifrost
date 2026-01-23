/**
 * Integration Test Suite
 *
 * Comprehensive integration tests for the Bifrost protocol.
 * Uses a dedicated relay on port 8193 (different from e2e tests on 8192).
 */

import { sleep }              from '@cmdcode/nostr-p2p/util'
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
  const pkg    = import_test_nodes(labels, vec, hosts, { debug : false })

  const ctx : TestNetwork = { ...pkg, relays: hosts }

  tape.test('Integration Tests: Starting relay and nodes', async t => {
    try {
      await relay.start()
      await Promise.all(ctx.nodes.values().map(e => e.connect()))

      // Wait for all nodes to be ready
      await sleep(500)

      t.pass('relay started and nodes connected')
    } catch (err) {
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
    try {
      await sleep(1000)
      await Promise.all(ctx.nodes.values().map(node => node.close()))
      relay.close()
      t.pass('relay and nodes stopped')
    } catch (err) {
      t.fail('failed to stop relay/nodes: ' + String(err))
    } finally {
      t.end()
    }
  })
}

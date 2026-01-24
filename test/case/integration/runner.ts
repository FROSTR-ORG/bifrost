/**
 * Integration Test Runner
 *
 * Comprehensive integration tests for the Bifrost protocol.
 * Can be run standalone or as part of the main test suite.
 */

import tape from 'tape'

import { setupTestEnvironment }   from '@/test/lib/setup.js'
import { createTestContext, create_network_fixture, parse_group_vector } from '@/test/lib/index.js'
import { wait_ms }                from '@/test/lib/wait-helpers.js'

import type { NetworkFixture } from '@/test/lib/index.js'
import type { Test }           from 'tape'

import api_integration_tests     from './api/runner.js'
import batcher_integration_tests from './batcher/runner.js'
import pool_integration_tests    from './pool/runner.js'

import VECTOR from '@/test/vector/group.vec.json' with { type: 'json' }

/**
 * Register integration test cases on a parent test.
 * Used when running as part of the main test suite.
 */
export default function integration_test_cases (tape : Test) {
  tape.test('Integration Tests', async t => {
    const ctx = createTestContext()
    const vec = parse_group_vector(VECTOR)
    let fixture : NetworkFixture | undefined

    // Setup
    try {
      fixture = await create_network_fixture(ctx, vec, {
        labels         : [ 'alice', 'bob', 'carol' ],
        populateNonces : true,
        nonceCount     : 200,  // More nonces for batcher tests
        debug          : false
      })
      t.pass('network ready')
    } catch (err) {
      await ctx.cleanup()
      t.fail('Setup failed: ' + String(err))
      t.end()
      return
    }

    // Run test suites as child tests
    api_integration_tests(fixture, t)
    batcher_integration_tests(fixture, t)
    pool_integration_tests(fixture, t)

    // Cleanup as final child test
    t.test('Integration Tests: Cleanup', async st => {
      await fixture!.cleanup()
      await wait_ms(200)
      st.pass('cleanup complete')
      st.end()
    })
  })
}

// Run standalone if executed directly
const isMain = process.argv[1]?.includes('integration/runner')
if (isMain) {
  setupTestEnvironment({ globalTimeout: 180000 })
  tape('Integration Test Suite', async t => {
    integration_test_cases(t)
  })
}

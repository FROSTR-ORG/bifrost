/**
 * E2E Test Runner
 *
 * End-to-end tests for the Bifrost protocol.
 * Can be run standalone or as part of the main test suite.
 */

import tape from 'tape'

import { setupTestEnvironment }   from '@/test/lib/setup.js'
import { createTestContext, create_network_fixture, parse_group_vector } from '@/test/lib/index.js'
import { wait_ms }                from '@/test/lib/wait-helpers.js'

import type { NetworkFixture } from '@/test/lib/index.js'
import type { Test }           from 'tape'

import ecdh_e2e_case from './ecdh.test.js'
import echo_e2e_case from './echo.test.js'
import ping_e2e_case from './ping.test.js'
import sign_e2e_case from './sign.test.js'

import VECTOR from '@/test/vector/group.vec.json' with { type: 'json' }

/**
 * Register E2E test cases on a parent test.
 * Used when running as part of the main test suite.
 */
export default function e2e_test_cases (tape : Test) {
  tape.test('E2E Tests', async t => {
    const ctx = createTestContext()
    const vec = parse_group_vector(VECTOR)
    let fixture : NetworkFixture | undefined

    // Setup
    try {
      fixture = await create_network_fixture(ctx, vec, {
        labels         : [ 'alice', 'bob', 'carol' ],
        populateNonces : true,
        nonceCount     : 50,
        debug          : true
      })
      t.pass('network ready')
    } catch (err) {
      await ctx.cleanup()
      t.fail('Setup failed: ' + String(err))
      t.end()
      return
    }

    // Run test cases as child tests
    ping_e2e_case(fixture, t)
    ecdh_e2e_case(fixture, t)
    echo_e2e_case(fixture, t)
    sign_e2e_case(fixture, t)

    // Cleanup as final child test
    t.test('E2E Tests: Cleanup', async st => {
      await fixture!.cleanup()
      await wait_ms(200)
      st.pass('cleanup complete')
      st.end()
    })
  })
}

// Run standalone if executed directly
const isMain = process.argv[1]?.includes('e2e/runner')
if (isMain) {
  setupTestEnvironment({ globalTimeout: 180000 })
  tape('E2E Test Suite', async t => {
    e2e_test_cases(t)
  })
}

/**
 * Bifrost Test Suite Runner
 *
 * Main entry point for all tests: unit, e2e, and integration.
 */

import tape from 'tape'

import { setupTestEnvironment } from './src/lib/setup.js'
import { resetPortCounter }     from './src/lib/test-context.js'

import unit_test_cases        from './case/unit/runner.js'
import e2e_test_cases         from './case/e2e/runner.js'
import integration_test_cases from './case/integration/runner.js'

// Set up global test environment (error handling, timeouts, force exit)
setupTestEnvironment({ globalTimeout: 180000 })

// Helper to let the event loop drain between test suites
const drain = () => new Promise(resolve => setImmediate(resolve))

tape('Bifrost Test Suite', async t => {
  // Unit tests (synchronous, no network)
  unit_test_cases(t)

  // Let event loop drain before network tests
  await drain()

  // Reset port counter before network tests
  resetPortCounter(8300)

  // Network tests
  e2e_test_cases(t)
  integration_test_cases(t)
})

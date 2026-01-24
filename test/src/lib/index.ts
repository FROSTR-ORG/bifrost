/**
 * Test Library Index
 *
 * Re-exports all test utilities for convenient imports.
 */

// Resource tracking
export { ResourceTracker } from './resource-tracker.js'

// Test context and port allocation
export {
  createTestContext,
  resetPortCounter,
  getPortCounter,
  type TestContext
} from './test-context.js'

// Wait helpers
export {
  wait_for_condition,
  wait_ms,
  wait_for_nonces,
  wait_for_all_nonces,
  wait_for_connection,
  wait_for_all_connections
} from './wait-helpers.js'

// Network fixtures
export {
  create_network_fixture,
  create_network_fixtures,
  type NetworkFixture,
  type NetworkFixtureOptions
} from './fixtures.js'

// Test environment setup
export {
  setupTestEnvironment,
  clearGlobalTimeout,
  isSetupComplete,
  resetSetup,
  type SetupOptions
} from './setup.js'

// Re-export existing utilities
export { NostrRelay } from './relay.js'
export { import_test_nodes, generate_test_nodes } from './node.js'
export { parse_group_vector } from './parse.js'

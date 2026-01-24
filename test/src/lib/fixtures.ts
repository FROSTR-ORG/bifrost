/**
 * Test Fixtures
 *
 * Factory functions for creating test networks with proper setup and cleanup.
 * Encapsulates the complexity of relay startup, node creation, and nonce population.
 */

import { LIB }                from '@vbyte/nostr-sdk'
const { sleep } = LIB

import { import_test_nodes }   from './node.js'
import { NostrRelay }          from './relay.js'
import { populate_nonce_pools } from '../../case/integration/lib/helpers.js'

import type { TestContext }    from './test-context.js'
import type { TestNetwork, GroupTestVector } from '../types.js'
import type { BifrostNodeConfig } from '@/index.js'

/** Default number of nonces to populate per peer pair */
const DEFAULT_NONCE_COUNT = 50

/** Delay between node connections to avoid relay congestion */
const NODE_CONNECT_DELAY_MS = 100

/** Delay after all nodes connect before considering setup complete */
const SETUP_COMPLETE_DELAY_MS = 200

/**
 * Extended TestNetwork with cleanup capability.
 */
export interface NetworkFixture extends TestNetwork {
  /** The test context used to create this fixture */
  ctx : TestContext

  /** Clean up all resources (nodes and relays) */
  cleanup : () => Promise<void>
}

/**
 * Options for creating a network fixture.
 */
export interface NetworkFixtureOptions {
  /** Labels for the nodes (default: ['alice', 'bob', 'carol']) */
  labels ?: string[]

  /** Whether to populate nonces after setup (default: true) */
  populateNonces ?: boolean

  /** Number of nonces to populate per peer pair (default: 50) */
  nonceCount ?: number

  /** Enable debug output on nodes (default: false) */
  debug ?: boolean

  /** Additional BifrostNode configuration */
  nodeConfig ?: Partial<BifrostNodeConfig>
}

/**
 * Create a fully-configured test network fixture.
 *
 * This function:
 * 1. Starts a NostrRelay on a dynamically allocated port
 * 2. Creates BifrostNodes for each label using the test vector
 * 3. Connects all nodes to the relay
 * 4. Optionally populates nonce pools (enabled by default)
 * 5. Returns a fixture with automatic cleanup
 *
 * @param ctx - The test context for port allocation and resource tracking
 * @param vector - The group test vector containing keys and shares
 * @param options - Optional configuration
 * @returns A NetworkFixture with cleanup capability
 *
 * @example
 * ```typescript
 * const ctx = createTestContext()
 * const fixture = await create_network_fixture(ctx, vector, {
 *   labels: ['alice', 'bob', 'carol'],
 *   populateNonces: true,
 *   nonceCount: 100
 * })
 *
 * // Run tests with fixture.nodes, fixture.group, etc.
 *
 * await fixture.cleanup()
 * ```
 */
export async function create_network_fixture (
  ctx     : TestContext,
  vector  : GroupTestVector,
  options : NetworkFixtureOptions = {}
) : Promise<NetworkFixture> {
  const {
    labels         = [ 'alice', 'bob', 'carol' ],
    populateNonces = true,
    nonceCount     = DEFAULT_NONCE_COUNT,
    debug          = false,
    nodeConfig     = {}
  } = options

  // Get a port from the context
  const port  = ctx.nextPort()
  const relay = new NostrRelay(port)
  const hosts = [ relay.url ]

  // Track the relay for cleanup
  ctx.tracker.trackRelay(relay)

  // Start the relay
  await relay.start()

  // Create nodes after relay is running
  const baseConfig : Partial<BifrostNodeConfig> = {
    debug,
    sdk_config : { msg_timeout: 15000, sub_timeout: 30000 },
    ...nodeConfig
  }

  const pkg = import_test_nodes(labels, vector, hosts, baseConfig)

  // Track all nodes for cleanup
  ctx.tracker.trackNodes(Array.from(pkg.nodes.values()))

  // Connect nodes sequentially to avoid relay congestion
  for (const node of pkg.nodes.values()) {
    await node.connect()
    await sleep(NODE_CONNECT_DELAY_MS)
  }

  // Wait for connections to stabilize
  await sleep(SETUP_COMPLETE_DELAY_MS)

  // Populate nonce pools if requested
  if (populateNonces) {
    populate_nonce_pools(pkg.nodes, nonceCount)
  }

  // Create the fixture
  const fixture : NetworkFixture = {
    ...pkg,
    relays  : hosts,
    ctx,
    cleanup : () => ctx.cleanup()
  }

  return fixture
}

/**
 * Create multiple independent network fixtures for parallel testing.
 *
 * Each fixture gets its own relay and set of nodes on different ports.
 *
 * @param ctx - The test context for port allocation
 * @param vector - The group test vector
 * @param count - Number of fixtures to create
 * @param options - Optional configuration applied to all fixtures
 * @returns Array of NetworkFixtures
 */
export async function create_network_fixtures (
  ctx     : TestContext,
  vector  : GroupTestVector,
  count   : number,
  options : NetworkFixtureOptions = {}
) : Promise<NetworkFixture[]> {
  const fixtures : NetworkFixture[] = []

  for (let i = 0; i < count; i++) {
    const fixture = await create_network_fixture(ctx, vector, options)
    fixtures.push(fixture)
  }

  return fixtures
}

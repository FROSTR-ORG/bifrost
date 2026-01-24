/**
 * Test Context
 *
 * Provides dynamic port allocation and resource tracking for test isolation.
 * Uses blocks of 20 ports per context to avoid conflicts between parallel tests.
 */

import { ResourceTracker } from './resource-tracker.js'

/** Base port for test contexts (avoids legacy 8192/8193) */
const BASE_PORT = 8300

/** Number of ports allocated per context */
const PORTS_PER_CONTEXT = 20

/** Global counter for unique port allocation */
let globalPortCounter = BASE_PORT

/**
 * Reset the global port counter.
 * Useful for test suite resets between different test phases.
 *
 * @param start - Optional starting port (defaults to BASE_PORT)
 */
export function resetPortCounter (start : number = BASE_PORT) : void {
  globalPortCounter = start
}

/**
 * Get the current port counter value.
 */
export function getPortCounter () : number {
  return globalPortCounter
}

/**
 * Test context for managing ports and resources within a test suite.
 */
export interface TestContext {
  /**
   * Get the next available port.
   */
  nextPort : () => number

  /**
   * Get the next available WebSocket URL.
   */
  nextUrl : () => string

  /**
   * Get multiple WebSocket URLs at once.
   *
   * @param count - Number of URLs to generate
   */
  nextUrls : (count : number) => string[]

  /**
   * The resource tracker for this context.
   */
  tracker : ResourceTracker

  /**
   * Clean up all resources tracked by this context.
   */
  cleanup : () => Promise<void>
}

/**
 * Create a new test context with isolated port allocation.
 *
 * Each context receives a block of PORTS_PER_CONTEXT ports to avoid conflicts
 * between different test suites running in parallel.
 *
 * @returns A new TestContext instance
 */
export function createTestContext () : TestContext {
  // Reserve a block of ports for this context
  const basePort = globalPortCounter
  globalPortCounter += PORTS_PER_CONTEXT

  let localCounter = 0
  const tracker = new ResourceTracker()

  const nextPort = () : number => {
    const port = basePort + localCounter
    localCounter++
    if (localCounter > PORTS_PER_CONTEXT) {
      throw new Error(`TestContext exhausted its port allocation (${PORTS_PER_CONTEXT} ports)`)
    }
    return port
  }

  const nextUrl = () : string => {
    return `ws://localhost:${nextPort()}`
  }

  const nextUrls = (count : number) : string[] => {
    const urls : string[] = []
    for (let i = 0; i < count; i++) {
      urls.push(nextUrl())
    }
    return urls
  }

  const cleanup = async () : Promise<void> => {
    await tracker.cleanup()
  }

  return {
    nextPort,
    nextUrl,
    nextUrls,
    tracker,
    cleanup
  }
}

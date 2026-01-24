/**
 * Test Setup
 *
 * Global test environment configuration including error handling,
 * timeouts, and forced exit on completion.
 */

import tape from 'tape'
import { resetPortCounter } from './test-context.js'

/** Default global timeout for the entire test suite (3 minutes) */
const DEFAULT_GLOBAL_TIMEOUT_MS = 180000

/** Default delay before force exit after tests complete */
const DEFAULT_FORCE_EXIT_DELAY_MS = 500

/**
 * Options for setting up the test environment.
 */
export interface SetupOptions {
  /** Maximum time for entire test suite in ms (default: 180000 = 3 min) */
  globalTimeout ?: number

  /** Delay before force exit after completion in ms (default: 500) */
  forceExitDelay ?: number

  /** Starting port for test contexts (default: 8300) */
  startPort ?: number
}

/** Track if setup has already been called */
let setupComplete = false

/** Store the global timeout handle for cleanup */
let globalTimeoutHandle : ReturnType<typeof setTimeout> | null = null

/**
 * Set up the global test environment.
 *
 * This function should be called once at the start of your test entry point.
 * It configures:
 * - Unhandled rejection handler (logs and fails gracefully)
 * - Global timeout to prevent tests from hanging indefinitely
 * - Force exit on tape.onFinish to ensure process terminates
 * - Port counter reset for test isolation
 *
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * import tape from 'tape'
 * import { setupTestEnvironment } from './src/lib/setup.js'
 *
 * setupTestEnvironment({ globalTimeout: 180000 })
 *
 * tape('My Test Suite', t => {
 *   // tests...
 * })
 * ```
 */
export function setupTestEnvironment (options : SetupOptions = {}) : void {
  if (setupComplete) {
    console.warn('[test-setup] setupTestEnvironment called multiple times, ignoring')
    return
  }

  const {
    globalTimeout  = DEFAULT_GLOBAL_TIMEOUT_MS,
    forceExitDelay = DEFAULT_FORCE_EXIT_DELAY_MS,
    startPort      = 8300
  } = options

  // Reset port counter
  resetPortCounter(startPort)

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[test-setup] Unhandled Rejection at:', promise)
    console.error('[test-setup] Reason:', reason)
    // Don't exit immediately - let tape handle test failure
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[test-setup] Uncaught Exception:', error)
    process.exit(1)
  })

  // Set global timeout
  globalTimeoutHandle = setTimeout(() => {
    console.error(`[test-setup] Global timeout exceeded (${globalTimeout}ms) - forcing exit`)
    process.exit(1)
  }, globalTimeout)

  // Don't let the timeout keep the process alive
  globalTimeoutHandle.unref()

  // Force exit after tests complete
  tape.onFinish(() => {
    // Clear the global timeout
    if (globalTimeoutHandle) {
      clearTimeout(globalTimeoutHandle)
      globalTimeoutHandle = null
    }

    // Give a short delay for any final cleanup, then exit
    setTimeout(() => {
      process.exit(0)
    }, forceExitDelay)
  })

  setupComplete = true
}

/**
 * Clear the global timeout (for manual control in special cases).
 */
export function clearGlobalTimeout () : void {
  if (globalTimeoutHandle) {
    clearTimeout(globalTimeoutHandle)
    globalTimeoutHandle = null
  }
}

/**
 * Check if test environment setup has been completed.
 */
export function isSetupComplete () : boolean {
  return setupComplete
}

/**
 * Reset setup state (mainly for testing the setup module itself).
 */
export function resetSetup () : void {
  setupComplete = false
  if (globalTimeoutHandle) {
    clearTimeout(globalTimeoutHandle)
    globalTimeoutHandle = null
  }
}

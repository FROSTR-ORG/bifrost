import createDebug from 'debug'

/**
 * Debug loggers for Bifrost SDK.
 *
 * These loggers only output when the DEBUG environment variable is set.
 * No output is produced by default, preventing accidental information leakage.
 *
 * Usage:
 *   DEBUG=bifrost:* npm start        # Enable all Bifrost debug output
 *   DEBUG=bifrost:sign npm start     # Enable only sign-related output
 *   DEBUG=bifrost:ecdh npm start     # Enable only ECDH-related output
 *
 * @example
 * ```typescript
 * import { debug } from '@/util/debug.js'
 *
 * // In sign handler:
 * debug.sign('processing request: %o', request)
 *
 * // In ecdh handler:
 * debug.ecdh('derived secret for: %s', pubkey)
 * ```
 */

/** Debug logger for signature operations */
export const signDebug = createDebug('bifrost:sign')

/** Debug logger for ECDH operations */
export const ecdhDebug = createDebug('bifrost:ecdh')

/** Debug logger for ping operations */
export const pingDebug = createDebug('bifrost:ping')

/** Debug logger for echo operations */
export const echoDebug = createDebug('bifrost:echo')

/** Debug logger for onboard operations */
export const onboardDebug = createDebug('bifrost:onboard')

/** Namespaced debug loggers */
export const debug = {
  sign    : signDebug,
  ecdh    : ecdhDebug,
  ping    : pingDebug,
  echo    : echoDebug,
  onboard : onboardDebug
} as const

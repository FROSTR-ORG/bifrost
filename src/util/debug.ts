/**
 * Minimal debug logging utility with browser support.
 *
 * Replaces the 'debug' npm package with a lightweight, agent-friendly implementation.
 *
 * ## Enabling Debug Output
 *
 *   Node.js: DEBUG=bifrost:* node app.js
 *   Browser: window.DEBUG = 'bifrost:*'       (session-only, takes precedence)
 *            localStorage.debug = 'bifrost:*' (persistent)
 *
 * ## Output Formats
 *
 *   Text (default): Colored output for human readability
 *   JSON: Structured output for agents/log aggregation
 *
 *   Node.js: DEBUG_FORMAT=json node app.js
 *   Browser: window.DEBUG_FORMAT = 'json'
 *
 * ## Log Capture
 *
 *   Logs are captured in a ring buffer for programmatic access:
 *
 *   ```typescript
 *   import { get_logs, clear_logs } from '@/util/debug.js'
 *   get_logs()                    // all captured logs
 *   get_logs('bifrost:sign')      // filter by namespace
 *   get_logs(undefined, 'error')  // filter by level
 *   clear_logs()                  // clear buffer
 *   ```
 *
 *   Buffer size: DEBUG_BUFFER_SIZE=1000 (default, 0 to disable)
 *
 * ## Performance Timing
 *
 *   ```typescript
 *   const end = debug.time('operation')
 *   // ... work ...
 *   end()  // logs: "operation: 12.34ms"
 *   ```
 *
 * ## Production Builds
 *
 *   Debug output is automatically disabled when NODE_ENV='production'.
 *   Configure your bundler to replace process.env.NODE_ENV for dead code elimination:
 *
 *   Rollup:  @rollup/plugin-replace { 'process.env.NODE_ENV': '"production"' }
 *   esbuild: define: { 'process.env.NODE_ENV': '"production"' }
 *   Vite:    Automatic in build mode
 *
 * @example
 * ```typescript
 * const debug = create_debug('bifrost:sign')
 * debug('processing request: %o', request)
 * debug.error('failed: %O', err)
 * debug('share data: %R', sharePackage)  // redacts sensitive fields
 * ```
 */

// === Environment Detection ===

const IS_BROWSER = typeof window !== 'undefined'
const IS_NODE    = typeof process !== 'undefined' && process.versions?.node
const PRODUCTION = process.env.NODE_ENV === 'production'

// === ANSI Colors (Node.js terminal) ===

const ANSI_COLORS = [
  '\x1b[36m', // cyan
  '\x1b[33m', // yellow
  '\x1b[32m', // green
  '\x1b[35m', // magenta
  '\x1b[34m', // blue
  '\x1b[91m', // bright red
  '\x1b[92m', // bright green
  '\x1b[93m', // bright yellow
] as const

const ANSI_RESET = '\x1b[0m'
const ANSI_DIM   = '\x1b[2m'

// === CSS Colors (Browser console) ===

const CSS_COLORS = [
  'color: #0cc',
  'color: #cc0',
  'color: #0c0',
  'color: #c0c',
  'color: #00c',
  'color: #f66',
  'color: #6f6',
  'color: #ff6',
] as const

// === Configuration ===

const DEFAULT_BUFFER_SIZE = 1000

// === Redaction ===

const REDACTED_FIELDS = new Set([
  'secret',
  'seckey',
  'secret_key',
  'private_key',
  'privkey',
  'share_secret',
  'nonce_secret',
])

// === Types ===

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'

/** Structured log entry for programmatic access */
export interface LogEntry {
  ts        : number
  iso       : string
  namespace : string
  level     : LogLevel
  message   : string
  args      : unknown[]
  data?     : unknown
}

/** Timer function returned by debug.time() */
type TimerFn = () => number

interface DebugFn {
  (fmt : string, ...args : unknown[]) : void
  error   : (fmt : string, ...args : unknown[]) => void
  warn    : (fmt : string, ...args : unknown[]) => void
  info    : (fmt : string, ...args : unknown[]) => void
  trace   : (fmt : string, ...args : unknown[]) => void
  time    : (label : string) => TimerFn
  enabled   : boolean
  namespace : string
}

// === Log Level Mapping ===

const LOG_METHODS : Record<LogLevel, 'error' | 'warn' | 'log'> = {
  error : 'error',
  warn  : 'warn',
  info  : 'log',
  debug : 'log',
  trace : 'log',
}

// === Log Buffer ===

let log_buffer : LogEntry[] = []

// === Configuration Helpers ===

/** Get debug pattern from environment */
function get_debug_pattern() : string {
  if (IS_BROWSER) {
    // Check window.DEBUG first (easy runtime override)
    if (typeof (window as any).DEBUG === 'string') {
      return (window as any).DEBUG
    }
    // Fall back to localStorage (persistent setting)
    try {
      return localStorage.getItem('debug') ?? ''
    } catch {
      return ''
    }
  }
  if (IS_NODE) {
    return process.env.DEBUG ?? ''
  }
  return ''
}

/** Get output format (text or json) */
function get_format() : 'text' | 'json' {
  if (IS_BROWSER) {
    if ((window as any).DEBUG_FORMAT === 'json') return 'json'
  }
  if (IS_NODE) {
    if (process.env.DEBUG_FORMAT === 'json') return 'json'
  }
  return 'text'
}

/** Get buffer size */
function get_buffer_size() : number {
  if (IS_BROWSER) {
    const size = (window as any).DEBUG_BUFFER_SIZE
    if (typeof size === 'number') return size
  }
  if (IS_NODE) {
    const size = parseInt(process.env.DEBUG_BUFFER_SIZE ?? '', 10)
    if (!isNaN(size)) return size
  }
  return DEFAULT_BUFFER_SIZE
}

/** Check if a namespace matches the DEBUG pattern */
function is_enabled(namespace : string) : boolean {
  const pattern = get_debug_pattern()
  if (!pattern) return false

  const patterns = pattern.split(',').map(p => p.trim())

  for (const p of patterns) {
    // Skip negated patterns (e.g., -bifrost:verbose)
    if (p.startsWith('-')) continue

    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )

    if (regex.test(namespace)) return true
  }

  return false
}

/** Simple hash for consistent color assignment */
function hash_code(str : string) : number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/** Deep clone and redact sensitive fields from an object */
function redact(obj : unknown, seen = new WeakSet()) : unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return '[Circular]'
  }
  seen.add(obj as object)

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item, seen))
  }

  const result : Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = redact(value, seen)
    }
  }
  return result
}

/** Format a value for output based on format specifier */
function format_value(spec : string, value : unknown) : string {
  switch (spec) {
    case 's':
      return String(value)
    case 'd':
    case 'i':
      return String(parseInt(String(value), 10))
    case 'f':
      return String(parseFloat(String(value)))
    case 'j':
      return JSON.stringify(value)
    case 'o':
    case 'O':
      return JSON.stringify(value, null, 2)
    case 'r':
    case 'R':
      return JSON.stringify(redact(value), null, 2)
    default:
      return String(value)
  }
}

/** Printf-style string formatting */
function format(fmt : string, args : unknown[]) : string {
  let i = 0
  return fmt.replace(/%([sdifjJoOrR%])/g, (match, spec) => {
    if (spec === '%') return '%'
    if (i >= args.length) return match
    return format_value(spec, args[i++])
  })
}

/** Add entry to log buffer */
function buffer_log(entry : LogEntry) : void {
  const max_size = get_buffer_size()
  if (max_size <= 0) return

  log_buffer.push(entry)

  // Ring buffer: remove oldest entries when full
  if (log_buffer.length > max_size) {
    log_buffer = log_buffer.slice(-max_size)
  }
}

// === Public API: Log Access ===

/**
 * Get captured log entries.
 *
 * @param namespace - Filter by namespace (supports wildcards)
 * @param level - Filter by log level
 * @param since - Only return logs after this timestamp
 * @returns Array of log entries
 *
 * @example
 * ```typescript
 * get_logs()                          // all logs
 * get_logs('bifrost:sign')            // specific namespace
 * get_logs('bifrost:*')               // wildcard
 * get_logs(undefined, 'error')        // only errors
 * get_logs(undefined, undefined, ts)  // logs since timestamp
 * ```
 */
export function get_logs(
  namespace? : string,
  level?     : LogLevel,
  since?     : number
) : LogEntry[] {
  let result = log_buffer

  if (since !== undefined) {
    result = result.filter(e => e.ts >= since)
  }

  if (level !== undefined) {
    result = result.filter(e => e.level === level)
  }

  if (namespace !== undefined) {
    const regex = new RegExp(
      '^' + namespace.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    result = result.filter(e => regex.test(e.namespace))
  }

  return result
}

/** Clear all captured logs */
export function clear_logs() : void {
  log_buffer = []
}

/** Get current buffer size */
export function get_log_count() : number {
  return log_buffer.length
}

// === Public API: Debug Logger ===

/** Create a debug logger for a namespace */
export function create_debug(namespace : string) : DebugFn {
  // Production mode: return no-ops that bundlers can eliminate via dead code elimination.
  // Configure your bundler to replace process.env.NODE_ENV with 'production'.
  if (PRODUCTION) {
    const noop_fn  = () => {}
    const noop_timer = () => () => 0
    const noop = Object.assign(noop_fn, {
      error     : noop_fn,
      warn      : noop_fn,
      info      : noop_fn,
      trace     : noop_fn,
      time      : noop_timer,
      enabled   : false,
      namespace : namespace,
    }) as DebugFn
    return noop
  }

  const enabled     = is_enabled(namespace)
  const color_index = hash_code(namespace) % ANSI_COLORS.length
  const noop        = () => {}

  function log(level : LogLevel, fmt : string, args : unknown[]) : void {
    if (!enabled) return

    const now     = Date.now()
    const iso     = new Date(now).toISOString()
    const message = format(fmt, args)
    const method  = LOG_METHODS[level]
    const output  = get_format()

    // Capture to buffer
    const entry : LogEntry = {
      ts        : now,
      iso       : iso,
      namespace : namespace,
      level     : level,
      message   : message,
      args      : args,
    }

    // Include first arg as data if it's an object (common pattern)
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      entry.data = redact(args[0])
    }

    buffer_log(entry)

    // Output
    if (output === 'json') {
      console[method](JSON.stringify(entry))
    } else {
      const prefix = level === 'debug' ? '' : `[${level.toUpperCase()}] `

      if (IS_BROWSER) {
        const color = CSS_COLORS[color_index]
        console[method](
          `%c${iso}%c %c${namespace}%c ${prefix}${message}`,
          'color: #888',
          'color: inherit',
          color,
          'color: inherit'
        )
      } else {
        const color = ANSI_COLORS[color_index]
        console[method](
          `${ANSI_DIM}${iso}${ANSI_RESET} ${color}${namespace}${ANSI_RESET} ${prefix}${message}`
        )
      }
    }
  }

  function time(label : string) : TimerFn {
    if (!enabled) return () => 0

    const start = performance.now()
    return () => {
      const elapsed = performance.now() - start
      log('debug', `${label}: %sms`, [elapsed.toFixed(2)])
      return elapsed
    }
  }

  const debug_fn = (fmt : string, ...args : unknown[]) => {
    log('debug', fmt, args)
  }

  const debug = Object.assign(debug_fn, {
    error : enabled ? (fmt : string, ...args : unknown[]) => log('error', fmt, args) : noop,
    warn  : enabled ? (fmt : string, ...args : unknown[]) => log('warn', fmt, args) : noop,
    info  : enabled ? (fmt : string, ...args : unknown[]) => log('info', fmt, args) : noop,
    trace : enabled ? (fmt : string, ...args : unknown[]) => log('trace', fmt, args) : noop,
    time  : time,
    enabled   : enabled,
    namespace : namespace,
  }) as DebugFn

  return debug
}

// === Bifrost Loggers ===

/** Debug logger for signature operations */
export const signDebug = create_debug('bifrost:sign')

/** Debug logger for ECDH operations */
export const ecdhDebug = create_debug('bifrost:ecdh')

/** Debug logger for ping operations */
export const pingDebug = create_debug('bifrost:ping')

/** Debug logger for echo operations */
export const echoDebug = create_debug('bifrost:echo')

/** Debug logger for onboard operations */
export const onboardDebug = create_debug('bifrost:onboard')

/** Namespaced debug loggers */
export const debug = {
  sign    : signDebug,
  ecdh    : ecdhDebug,
  ping    : pingDebug,
  echo    : echoDebug,
  onboard : onboardDebug,
} as const

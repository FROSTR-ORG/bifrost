/**
 * FROSTR Demo - Standalone Relay
 *
 * A simple Nostr relay for demo purposes.
 *
 * Usage:
 *   npm run demo:relay         # Port 8194 (default)
 *   npm run demo:relay -- 8195 # Custom port
 */

import {
  print_banner,
  parse_args,
  colors,
  log_info,
  log_success,
  log_error,
  init_logging,
  DEMO_RELAY_PORT
} from './shared.js'

import { NostrRelay } from '../test/src/lib/relay.js'

/* ================ [ Main ] ================ */

async function main () {
  // Initialize logging
  init_logging('relay')

  // Parse arguments
  const args = parse_args()

  // Check for port in positional arg or --port flag
  let port = DEMO_RELAY_PORT
  for (const [ key, value ] of args) {
    if (key.startsWith('_pos_') && typeof value === 'string') {
      port = parseInt(value, 10)
      break
    }
    if ((key === 'port' || key === 'p') && typeof value === 'string') {
      port = parseInt(value, 10)
    }
  }

  if (isNaN(port) || port < 1 || port > 65535) {
    log_error(`Invalid port: ${port}`)
    process.exit(1)
  }

  print_banner('FROSTR Demo Relay')
  console.log()

  // Create and start the relay
  const relay = new NostrRelay(port, 300) // Purge events every 5 minutes

  log_info('Starting relay...')

  await relay.start()

  log_success(`Relay listening on ${colors.cyan}ws://localhost:${port}${colors.reset}`)
  console.log()

  // Connection monitoring
  let lastConn = 0
  setInterval(() => {
    if (relay.conn !== lastConn) {
      log_info(`Connections: ${relay.conn}`)
      lastConn = relay.conn
    }
  }, 2000)

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log()
    log_info('Shutting down relay...')
    relay.close()
    log_success('Relay stopped')
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    log_info('Received SIGTERM, shutting down...')
    relay.close()
    process.exit(0)
  })

  // Keep alive
  log_info('Press Ctrl+C to stop')
  console.log()
}

main().catch(err => {
  log_error('Fatal error:', err)
  process.exit(1)
})

/**
 * FROSTR Demo - Interactive Node CLI
 *
 * An interactive CLI for running a FROSTR node. Supports commands for
 * pinging peers, signing messages, ECDH operations, and more.
 *
 * Usage:
 *   npm run demo:alice   # Start as alice
 *   npm run demo:bob     # Start as bob
 *   npm run demo:carol   # Start as carol
 */

import readline from 'node:readline'

import {
  print_banner,
  parse_args,
  colors,
  log_info,
  log_send,
  log_recv,
  log_success,
  log_error,
  log_warn,
  log_debug,
  init_logging,
  format_pubkey,
  format_pool_bar,
  format_peer_status,
  load_group,
  load_share,
  list_share_names,
  get_member_name,
  sleep,
  hash_message,
  generate_random_pubkey,
  get_config,
  DEMO_RELAY_URL
} from './shared.js'

import { BifrostNode } from '@/class/client.js'
import { convert_pubkey } from '@/util/crypto.js'

import type { GroupPackage, SharePackage, PeerData } from '@/types/index.js'

/* ================ [ Types ] ================ */

interface NodeContext {
  node          : BifrostNode
  name          : string
  group         : GroupPackage
  share         : SharePackage
  names         : string[]
  running       : boolean
  stress_running: boolean
  stress_abort  : AbortController | null
}

/* ================ [ Commands ] ================ */

const COMMANDS : Record<string, {
  description : string
  usage?      : string
  handler     : (ctx : NodeContext, args : string[]) => Promise<void>
}> = {
  ping: {
    description: 'Ping a peer to check online status',
    usage: 'ping <name|pubkey>',
    handler: handle_ping
  },
  sign: {
    description: 'Request threshold signature for a message',
    usage: 'sign <message>',
    handler: handle_sign
  },
  ecdh: {
    description: 'Derive shared secret with a public key',
    usage: 'ecdh <pubkey>',
    handler: handle_ecdh
  },
  echo: {
    description: 'Test relay connectivity with echo',
    usage: 'echo <message>',
    handler: handle_echo
  },
  status: {
    description: 'Show node status, peers, and pool health',
    handler: handle_status
  },
  peers: {
    description: 'List peers with online/offline status',
    handler: handle_peers
  },
  pool: {
    description: 'Show nonce pool details per peer',
    handler: handle_pool
  },
  pubkey: {
    description: 'Display this node\'s pubkey',
    handler: handle_pubkey
  },
  group: {
    description: 'Display group pubkey and info',
    handler: handle_group
  },
  stress: {
    description: 'Run continuous stress test',
    usage: 'stress <sign|ecdh|both> [interval_ms]',
    handler: handle_stress
  },
  stop: {
    description: 'Stop running stress test',
    handler: handle_stop
  },
  clear: {
    description: 'Clear the terminal screen',
    handler: handle_clear
  },
  help: {
    description: 'Show available commands',
    handler: handle_help
  },
  quit: {
    description: 'Exit gracefully',
    handler: handle_quit
  },
  exit: {
    description: 'Exit gracefully',
    handler: handle_quit
  }
}

/* ================ [ Command Handlers ] ================ */

async function handle_ping (ctx : NodeContext, args : string[]) {
  if (args.length < 1) {
    log_error('Usage: ping <name|pubkey>')
    return
  }

  const target = args[0]
  const peer_pk = resolve_peer(ctx, target)

  if (!peer_pk) {
    log_error(`Unknown peer: ${target}`)
    return
  }

  const name = get_member_name(peer_pk, ctx.group) ?? format_pubkey(peer_pk)
  log_send(`Pinging ${name}...`)
  log_debug(`  Target pubkey: ${peer_pk}`)
  log_debug(`  Our pubkey: ${ctx.node.pubkey}`)

  try {
    // Add timeout to ping request using config
    const config = get_config()
    const timeout_ms = config.timeouts.ping
    const timeout_promise = new Promise<{ ok: false, err: string }>((resolve) => {
      setTimeout(() => resolve({ ok: false, err: `Ping timeout (${timeout_ms}ms)` }), timeout_ms)
    })

    const result = await Promise.race([
      ctx.node.req.ping(peer_pk),
      timeout_promise
    ])

    if (!result.ok) {
      log_error(`Ping failed: ${result.err}`)
      return
    }

    const data = result.data
    log_success(`Pong! Policy: send=${data.policy.send}, recv=${data.policy.recv}`)

    if (data.nonces && data.nonces.length > 0) {
      log_recv(`Received ${data.nonces.length} nonces`)
    }
  } catch (err) {
    log_error(`Ping error: ${err}`)
  }
}

async function handle_sign (ctx : NodeContext, args : string[]) {
  if (args.length < 1) {
    log_error('Usage: sign <message>')
    return
  }

  const message = args.join(' ')
  const sighash = await hash_message(message)

  log_info(`Message: "${message}"`)
  log_info(`Sighash: ${format_pubkey(sighash)}`)
  log_send('Signing...')

  try {
    const result = await ctx.node.req.sign(sighash)

    if (!result.ok) {
      log_error(`Sign failed: ${result.err}`)
      return
    }

    log_success('Signature obtained!')
    log_info(`Signature: ${colors.dim}${format_pubkey(result.data, 16)}${colors.reset}`)
  } catch (err) {
    log_error(`Sign error: ${err}`)
  }
}

async function handle_ecdh (ctx : NodeContext, args : string[]) {
  if (args.length < 1) {
    log_error('Usage: ecdh <pubkey>')
    return
  }

  const pubkey = args[0]
  log_send(`ECDH with pubkey: ${format_pubkey(pubkey)}`)

  try {
    const result = await ctx.node.req.ecdh(pubkey)

    if (!result.ok) {
      log_error(`ECDH failed: ${result.err}`)
      return
    }

    log_success('Shared secret derived!')
    log_info(`Secret: ${colors.dim}${format_pubkey(result.data, 16)}${colors.reset}`)
  } catch (err) {
    log_error(`ECDH error: ${err}`)
  }
}

async function handle_echo (ctx : NodeContext, args : string[]) {
  if (args.length < 1) {
    log_error('Usage: echo <message>')
    return
  }

  const message = args.join(' ')
  log_send(`Echo: "${message}"`)

  try {
    const result = await ctx.node.req.echo(message)

    if (!result.ok) {
      log_error(`Echo failed: ${result.err}`)
      return
    }

    log_success(`Echo response: "${result.data}"`)
  } catch (err) {
    log_error(`Echo error: ${err}`)
  }
}

async function handle_status (ctx : NodeContext) {
  console.log()
  console.log(`${colors.bold}Node Status${colors.reset}`)
  console.log('─'.repeat(35))
  console.log(`  Name:      ${colors.cyan}${ctx.name}${colors.reset}`)
  console.log(`  Pubkey:    ${format_pubkey(ctx.node.pubkey)}`)
  console.log(`  Connected: ${ctx.node.is_ready ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`}`)
  console.log()

  // Peers
  console.log(`${colors.bold}Peers${colors.reset}`)
  console.log('─'.repeat(35))
  for (const peer of ctx.node.peers) {
    const name = get_peer_name(ctx, peer.pubkey)
    console.log(format_peer_status(peer, name))
  }
  console.log()

  // Nonce Pool Summary
  console.log(`${colors.bold}Nonce Pool${colors.reset}`)
  console.log('─'.repeat(35))
  for (const peer of ctx.node.peers) {
    const name = get_peer_name(ctx, peer.pubkey)
    const member = ctx.group.members.find(m => convert_pubkey(m.pubkey, 'bip340') === peer.pubkey)
    if (!member) continue

    const incoming = ctx.node.pool.get_available_count(member.idx)
    const outgoing = ctx.node.pool.get_outgoing_count(member.idx)

    console.log(`  ${format_pubkey(peer.pubkey)} (${name ?? 'unknown'})`)
    console.log(`    Incoming: ${format_pool_bar(incoming)}`)
    console.log(`    Outgoing: ${outgoing} active`)
  }
  console.log()
}

async function handle_peers (ctx : NodeContext) {
  console.log()
  console.log(`${colors.bold}Peers${colors.reset}`)
  console.log('─'.repeat(35))
  for (const peer of ctx.node.peers) {
    const name = get_peer_name(ctx, peer.pubkey)
    console.log(format_peer_status(peer, name))
  }
  console.log()
}

async function handle_pool (ctx : NodeContext) {
  console.log()
  console.log(`${colors.bold}Nonce Pool Details${colors.reset}`)
  console.log('─'.repeat(35))

  for (const peer of ctx.node.peers) {
    const name = get_peer_name(ctx, peer.pubkey)
    const member = ctx.group.members.find(m => convert_pubkey(m.pubkey, 'bip340') === peer.pubkey)
    if (!member) continue

    const incoming = ctx.node.pool.get_available_count(member.idx)
    const outgoing = ctx.node.pool.get_outgoing_count(member.idx)
    const can_sign = ctx.node.pool.can_sign(member.idx)

    console.log(`  ${colors.bold}${name ?? 'unknown'}${colors.reset} (idx=${member.idx})`)
    console.log(`    Pubkey:    ${format_pubkey(peer.pubkey)}`)
    console.log(`    Incoming:  ${format_pool_bar(incoming)}`)
    console.log(`    Outgoing:  ${outgoing} active`)
    console.log(`    Can Sign:  ${can_sign ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`}`)
    console.log()
  }
}

async function handle_pubkey (ctx : NodeContext) {
  console.log()
  console.log(`  Pubkey: ${colors.cyan}${ctx.node.pubkey}${colors.reset}`)
  console.log()
}

async function handle_group (ctx : NodeContext) {
  console.log()
  console.log(`${colors.bold}Group Info${colors.reset}`)
  console.log('─'.repeat(35))
  console.log(`  Group Pubkey: ${colors.cyan}${ctx.group.group_pk}${colors.reset}`)
  console.log(`  Threshold:    ${ctx.group.threshold}-of-${ctx.group.members.length}`)
  console.log(`  Members:      ${ctx.names.join(', ')}`)
  console.log()
}

async function handle_clear () {
  // ANSI escape codes: clear screen and move cursor to top-left
  process.stdout.write('\x1b[2J\x1b[H')
}

async function handle_help () {
  console.log()
  console.log(`${colors.bold}Available Commands${colors.reset}`)
  console.log('─'.repeat(35))

  for (const [ name, cmd ] of Object.entries(COMMANDS)) {
    if (name === 'exit') continue // Skip alias
    const usage = cmd.usage ?? name
    console.log(`  ${colors.cyan}${usage.padEnd(20)}${colors.reset} ${cmd.description}`)
  }

  console.log()
}

async function handle_quit (ctx : NodeContext) {
  log_info('Closing connection...')
  ctx.running = false
  ctx.stress_running = false
  await ctx.node.close()
  log_success('Goodbye!')
  process.exit(0)
}

/* ================ [ Stress Test ] ================ */

interface StressStats {
  total   : number
  success : number
  failed  : number
  times   : number[]
}

async function handle_stress (ctx : NodeContext, args : string[]) {
  if (args.length < 1) {
    log_error('Usage: stress <sign|ecdh|both> [interval_ms]')
    return
  }

  const type = args[0].toLowerCase()
  if (!['sign', 'ecdh', 'both'].includes(type)) {
    log_error('Type must be: sign, ecdh, or both')
    return
  }

  const interval = args[1] ? parseInt(args[1], 10) : 1000
  if (isNaN(interval) || interval < 0) {
    log_error('Interval must be a positive number')
    return
  }

  if (ctx.stress_running) {
    log_error('Stress test already running. Use "stop" to cancel.')
    return
  }

  ctx.stress_running = true
  ctx.stress_abort = new AbortController()

  log_info(`Starting stress test: ${type} operations every ${interval}ms`)
  log_info('Type "stop" or press Ctrl+C to end')
  console.log()

  const stats : StressStats = {
    total   : 0,
    success : 0,
    failed  : 0,
    times   : []
  }

  let iteration = 0
  let do_sign = true  // For alternating in 'both' mode

  while (ctx.stress_running) {
    iteration++
    const op_type = type === 'both' ? (do_sign ? 'sign' : 'ecdh') : type

    try {
      const start = Date.now()
      let result : { ok : boolean, err? : string, data? : unknown }

      if (op_type === 'sign') {
        const sighash = await hash_message(`stress-test-${iteration}-${Date.now()}`)
        process.stdout.write(`[#${iteration}] ${colors.yellow}[SEND]${colors.reset} Signing...`)
        result = await Promise.race([
          ctx.node.req.sign(sighash),
          timeout_promise(30000)
        ])
      } else {
        const target_pk = await generate_random_pubkey()
        process.stdout.write(`[#${iteration}] ${colors.yellow}[SEND]${colors.reset} ECDH...`)
        result = await Promise.race([
          ctx.node.req.ecdh(target_pk),
          timeout_promise(30000)
        ])
      }

      const elapsed = Date.now() - start
      stats.total++

      if (result.ok) {
        stats.success++
        stats.times.push(elapsed)
        const data = result.data
        const preview = typeof data === 'string'
          ? format_pubkey(data, 8)
          : format_pubkey(String(data), 8)
        console.log(`\r[#${iteration}] ${colors.green}[OK]${colors.reset} ${elapsed}ms - ${preview}`)
      } else {
        stats.failed++
        console.log(`\r[#${iteration}] ${colors.red}[ERR]${colors.reset} ${elapsed}ms - ${result.err}`)
      }

      if (type === 'both') do_sign = !do_sign

    } catch (err) {
      stats.total++
      stats.failed++
      console.log(`\r[#${iteration}] ${colors.red}[ERR]${colors.reset} Exception: ${err}`)
    }

    // Wait for interval (unless stopped)
    if (ctx.stress_running && interval > 0) {
      await sleep(interval)
    }
  }

  // Print final stats
  print_stress_stats(stats)
}

async function handle_stop (ctx : NodeContext) {
  if (!ctx.stress_running) {
    log_info('No stress test running')
    return
  }
  ctx.stress_running = false
  if (ctx.stress_abort) {
    ctx.stress_abort.abort()
    ctx.stress_abort = null
  }
  log_info('Stopping stress test...')
}

function timeout_promise (ms : number) : Promise<{ ok : false, err : string }> {
  return new Promise(resolve => {
    setTimeout(() => resolve({ ok: false, err: `Timeout (${ms}ms)` }), ms)
  })
}

function print_stress_stats (stats : StressStats) {
  console.log()
  log_info('Stress test stopped')

  const rate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(1) : '0'

  if (stats.times.length > 0) {
    const avg = Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)
    const min = Math.min(...stats.times)
    const max = Math.max(...stats.times)
    log_info(`Results: ${stats.success}/${stats.total} succeeded (${rate}%), avg: ${avg}ms, min: ${min}ms, max: ${max}ms`)
  } else {
    log_info(`Results: ${stats.success}/${stats.total} succeeded (${rate}%)`)
  }
}

/* ================ [ Helpers ] ================ */

/**
 * Resolve a peer name or pubkey to a BIP340 pubkey.
 */
function resolve_peer (ctx : NodeContext, target : string) : string | null {
  // Check if it's a known name
  const idx = ctx.names.indexOf(target)
  if (idx !== -1) {
    const member = ctx.group.members[idx]
    return convert_pubkey(member.pubkey, 'bip340')
  }

  // Check if it's a pubkey (hex)
  if (/^[0-9a-fA-F]{64}$/.test(target)) {
    return target
  }

  // Check if it's a compressed pubkey (02/03 prefix)
  if (/^0[23][0-9a-fA-F]{64}$/.test(target)) {
    return convert_pubkey(target, 'bip340')
  }

  return null
}

/**
 * Get peer name from pubkey.
 */
function get_peer_name (ctx : NodeContext, pubkey : string) : string | undefined {
  for (let i = 0; i < ctx.group.members.length; i++) {
    const member = ctx.group.members[i]
    if (convert_pubkey(member.pubkey, 'bip340') === pubkey) {
      return ctx.names[i]
    }
  }
  return undefined
}

/**
 * Setup event listeners for the node.
 */
function setup_event_listeners (ctx : NodeContext) {
  const node = ctx.node

  // Pool events (emitter spreads array payloads as separate arguments)
  node.pool.on('critical_low', (peer_idx, available) => {
    const name = ctx.names[peer_idx - 1] ?? `idx=${peer_idx}`
    log_warn(`${colors.red}Nonce pool critical!${colors.reset} ${name}: only ${available} nonces left`)
  })

  node.pool.on('needs_replenish', (peer_idx, count) => {
    const name = ctx.names[peer_idx - 1] ?? `idx=${peer_idx}`
    log_info(`Nonce pool low for ${name}, need ${count} more`)
  })

  node.pool.on('nonces_received', (peer_idx, count) => {
    const name = ctx.names[peer_idx - 1] ?? `idx=${peer_idx}`
    log_recv(`Received ${count} nonces from ${name}`)
  })

  // API handler events (incoming requests)
  node.on('/ping/handler/req', (msg) => {
    const pk = msg.event.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Ping request from ${name}`)
    // Debug: Log pubkey details for troubleshooting
    log_debug(`  msg.event.pubkey: ${pk}`)
    log_debug(`  msg.id: ${msg.id}`)
    log_debug(`  Our peers:`)
    for (const peer of ctx.node.peers) {
      log_debug(`    - ${peer.pubkey} (matches: ${peer.pubkey === pk})`)
    }
  })

  node.on('/sign/handler/req', (msg) => {
    const pk = msg.event.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Sign request from ${name}`)
  })

  node.on('/sign/handler/res', () => {
    log_send('Sent partial signature')
  })

  node.on('/ecdh/handler/req', (msg) => {
    const pk = msg.event.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`ECDH request from ${name}`)
  })

  node.on('/ecdh/handler/res', () => {
    log_send('Sent ECDH share')
  })

  node.on('/onboard/handler/req', (msg) => {
    const pk = msg.event.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Onboard request from ${name}`)
  })

  node.on('/onboard/handler/res', () => {
    log_send('Sent onboard response (group + nonces)')
  })

  // Bounced messages
  node.on('bounced', (reason, msg) => {
    const pk = msg?.event?.pubkey ?? 'unknown'
    log_warn(`Message bounced from ${format_pubkey(pk)}: ${reason}`)
  })

  // Handler rejections (errors in processing requests)
  // Note: emitter spreads array payloads as separate arguments
  node.on('/ping/handler/rej', (reason, msg) => {
    const pk = msg?.event?.pubkey ?? 'unknown'
    log_error(`Ping handler error: ${reason}`)
    log_debug(`  Full error details - pubkey: ${pk}, msg.id: ${msg?.id}, method: ${msg?.method}`)
  })

  // Raw message logging for debugging
  node.on('message', (msg) => {
    const method = msg.type === 'request' ? (msg as { method: string }).method : msg.type
    log_debug(`RAW MESSAGE: type=${msg.type}, method=${method}, id=${msg.id}, from=${format_pubkey(msg.event.pubkey)}`)
  })

  node.on('/sign/handler/rej', (reason, msg) => {
    const pk = msg?.event?.pubkey ?? 'unknown'
    log_error(`Sign handler error: ${reason}`)
  })

  node.on('/ecdh/handler/rej', (reason, msg) => {
    const pk = msg?.event?.pubkey ?? 'unknown'
    log_error(`ECDH handler error: ${reason}`)
  })
}

/* ================ [ Reconnection ] ================ */

/**
 * Setup automatic reconnection when relay connection is lost.
 */
function setup_reconnection (ctx: NodeContext): void {
  const config = get_config()

  if (!config.reconnect.enabled) {
    return
  }

  let reconnecting = false

  ctx.node.on('closed', async () => {
    if (!ctx.running || reconnecting) return

    reconnecting = true
    log_warn('Disconnected from relay, attempting to reconnect...')

    const maxAttempts = config.reconnect.maxAttempts
    const baseDelay = config.reconnect.baseDelayMs

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Exponential backoff: baseDelay * attempt (capped at 30s)
      const delay = Math.min(baseDelay * attempt, 30000)
      log_info(`Reconnect attempt ${attempt}/${maxAttempts} in ${delay}ms...`)
      await sleep(delay)

      // Check if we were stopped while waiting
      if (!ctx.running) {
        reconnecting = false
        return
      }

      try {
        await ctx.node.connect()

        // Wait briefly for ready state
        const connected = await Promise.race([
          new Promise<boolean>(resolve => {
            if (ctx.node.is_ready) {
              resolve(true)
            } else {
              ctx.node.once('ready', () => resolve(true))
            }
          }),
          new Promise<boolean>(resolve => {
            setTimeout(() => resolve(false), config.timeouts.connection)
          })
        ])

        if (connected) {
          log_success('Reconnected to relay!')
          reconnecting = false
          return
        }
      } catch (err) {
        log_error(`Reconnect attempt ${attempt} failed: ${err}`)
      }
    }

    log_error(`Failed to reconnect after ${maxAttempts} attempts`)
    reconnecting = false
  })
}

/* ================ [ REPL ] ================ */

async function run_repl (ctx : NodeContext) {
  // Check if we have a proper TTY for interactive mode
  if (!process.stdin.isTTY) {
    log_warn('No TTY detected - running in headless mode')
    log_info('Use Ctrl+C to exit')
    console.log()

    // Handle SIGINT for graceful shutdown
    process.on('SIGINT', () => {
      console.log()
      log_info('Received SIGINT, closing...')
      ctx.running = false
      ctx.node.close()
      process.exit(0)
    })

    // Keep process alive
    await new Promise<void>(() => {})
    return
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}${ctx.name}>${colors.reset} `
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      rl.prompt()
      return
    }

    const [ cmd, ...args ] = trimmed.split(/\s+/)
    const command = COMMANDS[cmd.toLowerCase()]

    if (!command) {
      log_error(`Unknown command: ${cmd}. Type 'help' for available commands.`)
      rl.prompt()
      return
    }

    try {
      await command.handler(ctx, args)
    } catch (err) {
      log_error(`Command error: ${err}`)
    }

    if (ctx.running) {
      rl.prompt()
    }
  })

  rl.on('close', () => {
    ctx.stress_running = false  // Stop stress test if running
    ctx.running = false
    log_info('Closing...')
    ctx.node.close()
    process.exit(0)
  })
}

/* ================ [ Main ] ================ */

export async function start_node (
  name   : string,
  group  : GroupPackage,
  share  : SharePackage,
  relays : string[]
) : Promise<NodeContext> {
  const names = list_share_names()

  // Create the node with debug enabled
  const node = new BifrostNode(group, share, relays, { debug: true })

  // Create context
  const ctx : NodeContext = {
    node,
    name,
    group,
    share,
    names,
    running        : true,
    stress_running : false,
    stress_abort   : null
  }

  // Setup event listeners
  setup_event_listeners(ctx)

  // Setup reconnection logic
  setup_reconnection(ctx)

  // Connect
  log_info('Connecting to relay...')

  node.on('ready', () => {
    log_success('Connected!')
    log_info(`Group: ${format_pubkey(group.group_pk)}`)
    log_info(`Your pubkey: ${format_pubkey(node.pubkey)}`)
    console.log()
  })

  node.on('closed', () => {
    if (ctx.running) {
      log_warn('Disconnected from relay')
    }
  })

  await node.connect()

  // Wait for ready with timeout (using config)
  const config = get_config()
  const connected = await Promise.race([
    new Promise<boolean>(resolve => {
      if (node.is_ready) {
        resolve(true)
      } else {
        node.once('ready', () => resolve(true))
      }
    }),
    new Promise<boolean>(resolve => {
      setTimeout(() => resolve(false), config.timeouts.connection)
    })
  ])

  if (!connected) {
    log_error('Connection timeout. Is the relay running?')
    log_info('Start the relay with: npm run demo:relay')
    process.exit(1)
  }

  return ctx
}

async function main () {
  // Handle unhandled promise rejections gracefully
  process.on('unhandledRejection', (reason) => {
    // Silently ignore connection errors (relay not running)
    const msg = String(reason)
    if (msg.includes('non-101') || msg.includes('ECONNREFUSED')) {
      return
    }
    log_error('Unhandled rejection:', reason)
  })

  // Parse arguments
  const args = parse_args()
  const name = args.get('name') as string | undefined

  if (!name) {
    log_error('Usage: npm run demo:node -- --name <alice|bob|carol|...>')
    process.exit(1)
  }

  // Initialize logging
  init_logging(name)

  print_banner(`FROSTR Demo Node - ${name}`)
  console.log()

  // Load credentials
  const group = load_group()
  const share = load_share(name)

  if (!group || !share) {
    log_error('Credentials not found. Run "npm run demo:keygen" first.')
    process.exit(1)
  }

  // Start the node
  const ctx = await start_node(name, group, share, [ DEMO_RELAY_URL ])

  // Small delay for events to settle
  await sleep(100)

  // Run the REPL
  await run_repl(ctx)
}

main().catch(err => {
  log_error('Fatal error:', err)
  process.exit(1)
})

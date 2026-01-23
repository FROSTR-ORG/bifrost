/**
 * FROSTR Demo - Onboarding
 *
 * Demonstrates the onboarding flow where a node requests group info
 * and initial nonces from a peer. In a real scenario, this would be
 * used by a new member joining the group.
 *
 * For the demo, we load full credentials but demonstrate the onboard
 * request/response flow to show how it works.
 *
 * Usage:
 *   npm run demo:onboard -- --name carol
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
  format_pubkey,
  format_pool_bar,
  load_group,
  load_share,
  load_onboard,
  list_share_names,
  get_member_name,
  sleep,
  hash_message,
  DEMO_RELAY_URL
} from './shared.js'

import { BifrostNode }  from '@/class/client.js'
import { convert_pubkey } from '@/util/crypto.js'

import type { GroupPackage, SharePackage, OnboardPackage, PeerData } from '@/types/index.js'

/* ================ [ Types ] ================ */

interface NodeContext {
  node       : BifrostNode
  name       : string
  group      : GroupPackage
  share      : SharePackage
  names      : string[]
  running    : boolean
}

/* ================ [ Helpers ] ================ */

function get_peer_name (ctx : NodeContext, pubkey : string) : string | undefined {
  for (let i = 0; i < ctx.group.members.length; i++) {
    const member = ctx.group.members[i]
    if (convert_pubkey(member.pubkey, 'bip340') === pubkey) {
      return ctx.names[i]
    }
  }
  return undefined
}

function setup_event_listeners (ctx : NodeContext) {
  const node = ctx.node

  node.pool.on('nonces_received', ([ peer_idx, count ]) => {
    const name = ctx.names[peer_idx - 1] ?? `idx=${peer_idx}`
    log_recv(`Received ${count} nonces from ${name}`)
  })

  node.on('/ping/handler/req', (msg) => {
    const pk = msg.env.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Ping request from ${name}`)
  })

  node.on('/sign/handler/req', (msg) => {
    const pk = msg.env.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Sign request from ${name}`)
  })

  node.on('/sign/handler/res', () => {
    log_send('Sent partial signature')
  })

  node.on('/onboard/handler/req', (msg) => {
    const pk = msg.env.pubkey
    const name = get_member_name(pk, ctx.group) ?? format_pubkey(pk)
    log_recv(`Onboard request from ${name}`)
  })

  node.on('/onboard/handler/res', () => {
    log_send('Sent onboard response (group + nonces)')
  })

  node.on('bounced', ([ reason, msg ]) => {
    const pk = msg.env.pubkey
    log_warn(`Message bounced from ${format_pubkey(pk)}: ${reason}`)
  })
}

/* ================ [ Commands ] ================ */

const COMMANDS : Record<string, {
  description : string
  usage?      : string
  handler     : (ctx : NodeContext, args : string[]) => Promise<void>
}> = {
  ping: {
    description: 'Ping a peer to check online status',
    usage: 'ping <name>',
    handler: async (ctx, args) => {
      if (args.length < 1) {
        log_error('Usage: ping <name|pubkey>')
        return
      }
      const target = args[0]
      const idx = ctx.names.indexOf(target)
      let peer_pk : string | null = null

      if (idx !== -1) {
        const member = ctx.group.members[idx]
        peer_pk = convert_pubkey(member.pubkey, 'bip340')
      } else if (/^[0-9a-fA-F]{64}$/.test(target)) {
        peer_pk = target
      }

      if (!peer_pk) {
        log_error(`Unknown peer: ${target}`)
        return
      }

      const name = get_peer_name(ctx, peer_pk) ?? format_pubkey(peer_pk)
      log_send(`Pinging ${name}...`)

      const result = await ctx.node.req.ping(peer_pk)
      if (!result.ok) {
        log_error(`Ping failed: ${result.err}`)
        return
      }

      log_success(`Pong! Policy: send=${result.data.policy.send}, recv=${result.data.policy.recv}`)
      if (result.data.nonces > 0) {
        log_recv(`Received ${result.data.nonces} nonces`)
      }
    }
  },
  sign: {
    description: 'Request threshold signature for a message',
    usage: 'sign <message>',
    handler: async (ctx, args) => {
      if (args.length < 1) {
        log_error('Usage: sign <message>')
        return
      }
      const message = args.join(' ')
      const sighash = await hash_message(message)

      log_info(`Message: "${message}"`)
      log_info(`Sighash: ${format_pubkey(sighash)}`)
      log_send('Signing...')

      const result = await ctx.node.req.sign(sighash)
      if (!result.ok) {
        log_error(`Sign failed: ${result.err}`)
        return
      }

      log_success('Signature obtained!')
      log_info(`Signature: ${colors.dim}${format_pubkey(result.data, 16)}${colors.reset}`)
    }
  },
  status: {
    description: 'Show node status',
    handler: async (ctx) => {
      console.log()
      console.log(`${colors.bold}Node Status${colors.reset}`)
      console.log('─'.repeat(35))
      console.log(`  Name:      ${colors.cyan}${ctx.name}${colors.reset}`)
      console.log(`  Pubkey:    ${format_pubkey(ctx.node.pubkey)}`)
      console.log(`  Connected: ${ctx.node.is_ready ? `${colors.green}Yes${colors.reset}` : `${colors.red}No${colors.reset}`}`)
      console.log()

      console.log(`${colors.bold}Peers${colors.reset}`)
      console.log('─'.repeat(35))
      for (const peer of ctx.node.peers) {
        const name = get_peer_name(ctx, peer.pubkey)
        const status = peer.status === 'online'
          ? `${colors.green}online${colors.reset}`
          : `${colors.dim}offline${colors.reset}`
        console.log(`  ${format_pubkey(peer.pubkey)} (${name ?? 'unknown'}) - ${status}`)
      }
      console.log()

      console.log(`${colors.bold}Nonce Pool${colors.reset}`)
      console.log('─'.repeat(35))
      for (const peer of ctx.node.peers) {
        const name = get_peer_name(ctx, peer.pubkey)
        const member = ctx.group.members.find(m => convert_pubkey(m.pubkey, 'bip340') === peer.pubkey)
        if (!member) continue

        const incoming = ctx.node.pool.get_available_count(member.idx)
        console.log(`  ${name ?? 'unknown'}: ${format_pool_bar(incoming)}`)
      }
      console.log()
    }
  },
  clear: {
    description: 'Clear the terminal screen',
    handler: async () => {
      // ANSI escape codes: clear screen and move cursor to top-left
      process.stdout.write('\x1b[2J\x1b[H')
    }
  },
  help: {
    description: 'Show available commands',
    handler: async () => {
      console.log()
      console.log(`${colors.bold}Available Commands${colors.reset}`)
      console.log('─'.repeat(35))
      console.log(`  ${colors.cyan}ping <name>${colors.reset}   Ping a peer`)
      console.log(`  ${colors.cyan}sign <msg>${colors.reset}    Request signature`)
      console.log(`  ${colors.cyan}status${colors.reset}        Show node status`)
      console.log(`  ${colors.cyan}clear${colors.reset}         Clear screen`)
      console.log(`  ${colors.cyan}help${colors.reset}          Show commands`)
      console.log(`  ${colors.cyan}quit${colors.reset}          Exit`)
      console.log()
    }
  },
  quit: {
    description: 'Exit gracefully',
    handler: async (ctx) => {
      log_info('Closing...')
      ctx.running = false
      await ctx.node.close()
      log_success('Goodbye!')
      process.exit(0)
    }
  },
  exit: {
    description: 'Exit gracefully',
    handler: async (ctx) => {
      await COMMANDS.quit.handler(ctx, [])
    }
  }
}

/* ================ [ Main ] ================ */

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

  const args = parse_args()
  const name = args.get('name') as string | undefined

  if (!name) {
    log_error('Usage: npm run loader demo/onboard.ts -- --name <name>')
    process.exit(1)
  }

  print_banner(`FROSTR Onboarding - ${name}`)
  console.log()

  // Load the onboard package to get peer info
  const onboard = load_onboard(name)
  if (!onboard) {
    log_error(`Onboard package not found for "${name}". Run "npm run demo:keygen" first.`)
    process.exit(1)
  }

  // Load full credentials for the demo
  const group = load_group()
  const share = load_share(name)

  if (!group || !share) {
    log_error('Credentials not found. Run "npm run demo:keygen" first.')
    process.exit(1)
  }

  const names = list_share_names()

  log_info('Loading onboard package...')
  log_info(`Peer contact: ${format_pubkey(onboard.peer_pk)}`)
  log_info(`Relay: ${onboard.relays.join(', ')}`)
  console.log()

  // Create the node
  const node = new BifrostNode(group, share, [ DEMO_RELAY_URL ])

  const ctx : NodeContext = {
    node,
    name,
    group,
    share,
    names,
    running: true
  }

  setup_event_listeners(ctx)

  log_info('Connecting to relay...')

  node.on('ready', () => {
    log_success('Connected!')
  })

  node.on('closed', () => {
    if (ctx.running) {
      log_warn('Disconnected from relay')
    }
  })

  await node.connect()

  // Wait for ready with timeout
  const connected = await Promise.race([
    new Promise<boolean>(resolve => {
      if (node.is_ready) {
        resolve(true)
      } else {
        node.once('ready', () => resolve(true))
      }
    }),
    new Promise<boolean>(resolve => {
      setTimeout(() => resolve(false), 5000)
    })
  ])

  if (!connected) {
    log_error('Connection timeout. Is the relay running?')
    log_info('Start the relay with: npm run demo:relay')
    process.exit(1)
  }

  // Demonstrate the onboard request
  log_send(`Requesting onboard from ${format_pubkey(onboard.peer_pk)}...`)

  try {
    const result = await node.req.onboard(onboard.peer_pk)

    if (!result.ok) {
      log_warn(`Onboard request failed: ${result.err}`)
      log_info('(This is expected if the peer is offline)')
      log_info('Continuing with local credentials...')
    } else {
      const response = result.data

      log_recv('GroupPackage received!')
      log_info(`Group pubkey: ${format_pubkey(response.group.group_pk)}`)
      log_info(`Threshold: ${response.group.threshold}-of-${response.group.members.length}`)
      log_info(`Members: ${response.group.members.length}`)

      if (response.nonces && response.nonces.length > 0) {
        log_recv(`Received ${response.nonces.length} initial nonces`)
      }

      log_success('Onboarding complete!')
    }
  } catch (err) {
    log_warn(`Onboard request error: ${err}`)
    log_info('(This is expected if the peer is offline)')
    log_info('Continuing with local credentials...')
  }

  console.log()
  log_info('Transitioning to interactive mode...')
  console.log()

  // Small delay for events to settle
  await sleep(100)

  // Run the REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan}${name}>${colors.reset} `
  })

  rl.prompt()

  rl.on('line', async (line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      rl.prompt()
      return
    }

    const [ cmd, ...cmdArgs ] = trimmed.split(/\s+/)
    const command = COMMANDS[cmd.toLowerCase()]

    if (!command) {
      log_error(`Unknown command: ${cmd}. Type 'help' for available commands.`)
      rl.prompt()
      return
    }

    try {
      await command.handler(ctx, cmdArgs)
    } catch (err) {
      log_error(`Command error: ${err}`)
    }

    if (ctx.running) {
      rl.prompt()
    }
  })

  rl.on('close', () => {
    ctx.running = false
    log_info('Closing...')
    node.close()
    process.exit(0)
  })
}

main().catch(err => {
  log_error('Fatal error:', err)
  process.exit(1)
})

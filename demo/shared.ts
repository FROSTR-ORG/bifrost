/**
 * Shared utilities for FROSTR demo suite
 */

import fs from 'node:fs'
import path from 'node:path'

import type { GroupPackage, SharePackage, OnboardPackage, PeerData } from '@/types/index.js'

/* ================ [ Constants ] ================ */

export const DEMO_RELAY_PORT = 8194
export const DEMO_RELAY_URL  = `ws://localhost:${DEMO_RELAY_PORT}`
export const DATA_DIR        = path.join(process.cwd(), 'demo', 'data')

/** Default member names for demo */
export const DEFAULT_MEMBERS = [ 'alice', 'bob', 'carol', 'dave', 'eve' ]

/* ================ [ Colors ] ================ */

export const colors = {
  reset   : '\x1b[0m',
  bold    : '\x1b[1m',
  dim     : '\x1b[2m',

  // Foreground
  black   : '\x1b[30m',
  red     : '\x1b[31m',
  green   : '\x1b[32m',
  yellow  : '\x1b[33m',
  blue    : '\x1b[34m',
  magenta : '\x1b[35m',
  cyan    : '\x1b[36m',
  white   : '\x1b[37m',

  // Bright foreground
  brightRed    : '\x1b[91m',
  brightGreen  : '\x1b[92m',
  brightYellow : '\x1b[93m',
  brightBlue   : '\x1b[94m',
  brightCyan   : '\x1b[96m',
}

/* ================ [ Logging ] ================ */

/**
 * Log an info message (blue).
 */
export function log_info (...args : unknown[]) : void {
  console.log(`${colors.blue}[INFO]${colors.reset}`, ...args)
}

/**
 * Log a send/outgoing message (yellow).
 */
export function log_send (...args : unknown[]) : void {
  console.log(`${colors.yellow}[SEND]${colors.reset}`, ...args)
}

/**
 * Log a receive/incoming message (cyan).
 */
export function log_recv (...args : unknown[]) : void {
  console.log(`${colors.cyan}[RECV]${colors.reset}`, ...args)
}

/**
 * Log an error message (red).
 */
export function log_error (...args : unknown[]) : void {
  console.log(`${colors.red}[ERR]${colors.reset}`, ...args)
}

/**
 * Log a success message (green).
 */
export function log_success (...args : unknown[]) : void {
  console.log(`${colors.green}[OK]${colors.reset}`, ...args)
}

/**
 * Log a warning message (bright yellow).
 */
export function log_warn (...args : unknown[]) : void {
  console.log(`${colors.brightYellow}[WARN]${colors.reset}`, ...args)
}

/* ================ [ Formatting ] ================ */

/**
 * Format a public key as truncated hex (abc123...xyz789).
 */
export function format_pubkey (pk : string, len = 6) : string {
  if (pk.length <= len * 2 + 3) return pk
  return `${pk.slice(0, len)}...${pk.slice(-len)}`
}

/**
 * Format peer status for display.
 */
export function format_peer_status (peer : PeerData, name? : string) : string {
  const pk = format_pubkey(peer.pubkey)
  const status = peer.status === 'online'
    ? `${colors.green}online${colors.reset}`
    : `${colors.dim}offline${colors.reset}`
  const policy = `send=${peer.policy.send}, recv=${peer.policy.recv}`
  const label = name ? ` (${name})` : ''
  return `  ${pk}${label} - ${status}\n    Policy: ${policy}`
}

/**
 * Format a nonce pool bar.
 */
export function format_pool_bar (count : number, max = 100) : string {
  const width = 20
  const filled = Math.round((count / max) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)

  let color = colors.green
  if (count <= 5) color = colors.red
  else if (count <= 20) color = colors.yellow

  return `${color}[${bar}]${colors.reset} ${count}`
}

/* ================ [ File I/O ] ================ */

/**
 * Ensure the data directory exists.
 */
export function ensure_data_dir () : void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load the group package from disk.
 */
export function load_group () : GroupPackage | null {
  const file = path.join(DATA_DIR, 'group.json')
  if (!fs.existsSync(file)) return null

  try {
    const content = fs.readFileSync(file, 'utf-8')
    return JSON.parse(content) as GroupPackage
  } catch {
    return null
  }
}

/**
 * Load a share package from disk by name.
 */
export function load_share (name : string) : SharePackage | null {
  const file = path.join(DATA_DIR, `share-${name}.json`)
  if (!fs.existsSync(file)) return null

  try {
    const content = fs.readFileSync(file, 'utf-8')
    return JSON.parse(content) as SharePackage
  } catch {
    return null
  }
}

/**
 * Load an onboard package from disk by name.
 */
export function load_onboard (name : string) : OnboardPackage | null {
  const file = path.join(DATA_DIR, `onboard-${name}.json`)
  if (!fs.existsSync(file)) return null

  try {
    const content = fs.readFileSync(file, 'utf-8')
    return JSON.parse(content) as OnboardPackage
  } catch {
    return null
  }
}

/**
 * Save the group package to disk.
 */
export function save_group (group : GroupPackage) : void {
  ensure_data_dir()
  const file = path.join(DATA_DIR, 'group.json')
  fs.writeFileSync(file, JSON.stringify(group, null, 2))
}

/**
 * Save a share package to disk by name.
 */
export function save_share (name : string, share : SharePackage) : void {
  ensure_data_dir()
  const file = path.join(DATA_DIR, `share-${name}.json`)
  fs.writeFileSync(file, JSON.stringify(share, null, 2))
}

/**
 * Save an onboard package to disk by name.
 */
export function save_onboard (name : string, onboard : OnboardPackage) : void {
  ensure_data_dir()
  const file = path.join(DATA_DIR, `onboard-${name}.json`)
  fs.writeFileSync(file, JSON.stringify(onboard, null, 2))
}

/**
 * Check if credentials exist.
 */
export function credentials_exist () : boolean {
  return load_group() !== null
}

/**
 * List all saved share names.
 */
export function list_share_names () : string[] {
  if (!fs.existsSync(DATA_DIR)) return []

  const files = fs.readdirSync(DATA_DIR)
  const names : string[] = []

  for (const file of files) {
    const match = file.match(/^share-(.+)\.json$/)
    if (match) names.push(match[1])
  }

  return names
}

/* ================ [ Banner ] ================ */

/**
 * Print a banner for the demo.
 */
export function print_banner (title : string) : void {
  const width = 43
  const padding = Math.max(0, width - title.length - 2)
  const left = Math.floor(padding / 2)
  const right = padding - left

  console.log(`${colors.cyan}╔${'═'.repeat(width)}╗${colors.reset}`)
  console.log(`${colors.cyan}║${colors.reset}${' '.repeat(left)} ${colors.bold}${title}${colors.reset} ${' '.repeat(right)}${colors.cyan}║${colors.reset}`)
  console.log(`${colors.cyan}╚${'═'.repeat(width)}╝${colors.reset}`)
}

/* ================ [ CLI Helpers ] ================ */

/**
 * Parse command-line arguments.
 */
export function parse_args () : Map<string, string | boolean> {
  const args = new Map<string, string | boolean>()
  const argv = process.argv.slice(2)

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]

      if (next && !next.startsWith('-')) {
        args.set(key, next)
        i++
      } else {
        args.set(key, true)
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      const next = argv[i + 1]

      if (next && !next.startsWith('-')) {
        args.set(key, next)
        i++
      } else {
        args.set(key, true)
      }
    } else {
      // Positional argument
      args.set('_pos_' + i, arg)
    }
  }

  return args
}

/**
 * Get the first positional argument (e.g., bech32 string).
 */
export function get_positional_arg () : string | undefined {
  const args = parse_args()
  for (const [ key, value ] of args) {
    if (key.startsWith('_pos_') && typeof value === 'string') {
      return value
    }
  }
  return undefined
}

/* ================ [ Utility ] ================ */

/**
 * Create deterministic secrets from member names.
 * Uses simple SHA256 hash of name for reproducibility.
 */
export async function create_deterministic_secrets (
  names : string[]
) : Promise<string[]> {
  const { sha256 } = await import('@noble/hashes/sha256')
  const { Buff }   = await import('@cmdcode/buff')

  return names.map(name => {
    const hash = sha256(new TextEncoder().encode(`frostr-demo-secret:${name}`))
    return Buff.bytes(hash).hex
  })
}

/**
 * Get the name for a member by their pubkey.
 */
export function get_member_name (
  pubkey : string,
  group  : GroupPackage
) : string | undefined {
  const names = list_share_names()
  const member = group.members.find(m => m.pubkey === pubkey || m.pubkey.slice(2) === pubkey)
  if (!member) return undefined
  return names[member.idx - 1]
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep (ms : number) : Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Hash a message string to hex32 format for signing.
 * The sign API requires a 64-character hex hash (SHA-256).
 */
export async function hash_message (message : string) : Promise<string> {
  const { sha256 } = await import('@noble/hashes/sha256')
  const { Buff }   = await import('@cmdcode/buff')
  const bytes = new TextEncoder().encode(message)
  const hash  = sha256(bytes)
  return Buff.bytes(hash).hex
}

/**
 * Generate a random valid secp256k1 public key for ECDH testing.
 */
export async function generate_random_pubkey () : Promise<string> {
  const { schnorr } = await import('@noble/curves/secp256k1')
  const privkey = schnorr.utils.randomPrivateKey()
  return Buffer.from(schnorr.getPublicKey(privkey)).toString('hex')
}

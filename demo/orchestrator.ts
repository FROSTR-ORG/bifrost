/**
 * FROSTR Demo - Unified Process Orchestrator
 *
 * Manages all demo processes (relay + nodes) with:
 * - Single entry point: `npm run demo`
 * - Prefixed logging for each process
 * - Graceful shutdown handling
 * - Auto-restart on crash
 *
 * Usage:
 *   npm run demo           # Start relay + all configured nodes
 *   npm run demo -- --no-restart  # Disable auto-restart
 */

import { spawn, ChildProcess } from 'node:child_process'
import path from 'node:path'

import {
  colors,
  log_info,
  log_success,
  log_error,
  log_warn,
  init_logging,
  print_banner,
  get_config,
  sleep
} from './shared.js'

/* ================ [ Types ] ================ */

interface ManagedProcess {
  name: string
  process: ChildProcess
  script: string
  args: string[]
  restartCount: number
  maxRestarts: number
}

interface OrchestratorOptions {
  autoRestart: boolean
  maxRestarts: number
}

/* ================ [ Color Prefixes ] ================ */

const PROCESS_COLORS: Record<string, string> = {
  relay: colors.magenta,
  alice: colors.cyan,
  bob: colors.green,
  carol: colors.yellow,
  dave: colors.blue,
  eve: colors.brightRed
}

function get_color(name: string): string {
  return PROCESS_COLORS[name] ?? colors.white
}

/* ================ [ Orchestrator ] ================ */

class DemoOrchestrator {
  private processes: Map<string, ManagedProcess> = new Map()
  private running = false
  private options: OrchestratorOptions

  constructor(options: Partial<OrchestratorOptions> = {}) {
    this.options = {
      autoRestart: options.autoRestart ?? true,
      maxRestarts: options.maxRestarts ?? 5
    }
  }

  async start(): Promise<void> {
    this.running = true
    const config = get_config()

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())

    // Start relay first
    log_info('Starting relay...')
    await this.spawn_process('relay', 'demo/relay.ts', [])

    // Wait for relay to be ready
    await this.wait_for_relay()

    // Start nodes based on config
    log_info(`Starting ${config.network.members.length} nodes...`)
    for (const name of config.network.members) {
      await this.spawn_process(name, 'demo/node.ts', ['--name', name])
      // Small delay between node starts to avoid race conditions
      await sleep(500)
    }

    log_success('All processes started!')
    console.log()
    log_info('Press Ctrl+C to stop all processes')
    console.log()

    // Keep the orchestrator running
    await this.wait_for_shutdown()
  }

  private async spawn_process(
    name: string,
    script: string,
    args: string[]
  ): Promise<void> {
    const color = get_color(name)
    const prefix = `${color}[${name.padEnd(6)}]${colors.reset}`

    const proc = spawn(
      'npx',
      ['tsx', '--tsconfig', './test/tsconfig.json', script, ...args],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1' },
        cwd: process.cwd()
      }
    )

    // Handle stdout with prefix
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line.trim()) {
          console.log(`${prefix} ${line}`)
        }
      }
    })

    // Handle stderr with prefix
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        if (line.trim()) {
          console.error(`${prefix} ${colors.red}${line}${colors.reset}`)
        }
      }
    })

    // Handle process exit
    proc.on('exit', (code, signal) => {
      const managed = this.processes.get(name)

      if (!this.running) {
        // Expected shutdown, don't restart
        return
      }

      if (code !== 0 && code !== null) {
        log_warn(`${prefix} Process exited with code ${code}`)

        if (this.options.autoRestart && managed) {
          if (managed.restartCount < managed.maxRestarts) {
            managed.restartCount++
            log_info(`${prefix} Restarting (attempt ${managed.restartCount}/${managed.maxRestarts})...`)
            setTimeout(() => {
              if (this.running) {
                this.spawn_process(name, script, args)
              }
            }, 2000)
          } else {
            log_error(`${prefix} Max restarts reached, not restarting`)
          }
        }
      } else if (signal) {
        log_info(`${prefix} Process killed by signal ${signal}`)
      }
    })

    proc.on('error', (err) => {
      log_error(`${prefix} Failed to start: ${err.message}`)
    })

    this.processes.set(name, {
      name,
      process: proc,
      script,
      args,
      restartCount: this.processes.get(name)?.restartCount ?? 0,
      maxRestarts: this.options.maxRestarts
    })
  }

  private async wait_for_relay(): Promise<void> {
    // Give relay time to start listening
    await sleep(1500)
    log_success('Relay ready')
  }

  private async wait_for_shutdown(): Promise<void> {
    // Keep process alive until shutdown is triggered
    await new Promise<void>(() => {
      // This promise never resolves - we exit via shutdown()
    })
  }

  private async shutdown(): Promise<void> {
    if (!this.running) return
    this.running = false

    console.log()
    log_info('Shutting down all processes...')

    // Stop nodes first (reverse order)
    const config = get_config()
    const nodeNames = [...config.network.members].reverse()

    for (const name of nodeNames) {
      const managed = this.processes.get(name)
      if (managed?.process && !managed.process.killed) {
        log_info(`Stopping ${name}...`)
        managed.process.kill('SIGTERM')
      }
    }

    // Wait for nodes to stop
    await sleep(1000)

    // Stop relay last
    const relay = this.processes.get('relay')
    if (relay?.process && !relay.process.killed) {
      log_info('Stopping relay...')
      relay.process.kill('SIGTERM')
    }

    await sleep(500)

    // Force kill any remaining processes
    for (const [name, managed] of this.processes) {
      if (managed.process && !managed.process.killed) {
        log_warn(`Force killing ${name}...`)
        managed.process.kill('SIGKILL')
      }
    }

    log_success('All processes stopped')
    process.exit(0)
  }
}

/* ================ [ Main ] ================ */

async function main(): Promise<void> {
  // Initialize logging
  init_logging('orchestrator')

  print_banner('FROSTR Demo Orchestrator')
  console.log()

  // Parse arguments
  const args = process.argv.slice(2)
  const noRestart = args.includes('--no-restart')

  const orchestrator = new DemoOrchestrator({
    autoRestart: !noRestart
  })

  try {
    await orchestrator.start()
  } catch (err) {
    log_error('Orchestrator error:', err)
    process.exit(1)
  }
}

main()

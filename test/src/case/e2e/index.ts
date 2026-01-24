import { LIB }                from '@vbyte/nostr-sdk'
const { sleep } = LIB
import { import_test_nodes }  from '@/test/lib/node.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { NostrRelay }         from '@/test/lib/relay.js'

import type { TestNetwork } from '@/test/types.js'

import ecdh_e2e_case from './ecdh.test.js'
import echo_e2e_case from './echo.test.js'
import ping_e2e_case from './ping.test.js'
import sign_e2e_case from './sign.test.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  const labels = [ 'alice', 'bob', 'carol' ]
  const relay  = new NostrRelay(8192)
  const hosts  = [ relay.url ]
  const vec    = parse_group_vector(VECTOR)

  // Context is populated after relay starts (nodes must be created AFTER relay)
  let ctx : TestNetwork

  // Cleanup function that always runs
  const cleanup = async () => {
    try {
      if (ctx) {
        for (const node of ctx.nodes.values()) {
          await node.close().catch(() => {})
        }
      }
      relay.close()
    } catch { /* ignore cleanup errors */ }
  }

  tape.test('starting relay and nodes', async t => {
    try {
      // Start relay FIRST
      await relay.start()

      // Create nodes AFTER relay is running (critical for WebSocket connections)
      const pkg = import_test_nodes(labels, vec, hosts, {
        debug      : true,
        sdk_config : { msg_timeout: 15000, sub_timeout: 30000 }
      })
      ctx = { ...pkg, relays: hosts }

      // Connect nodes sequentially
      for (const node of ctx.nodes.values()) {
        await node.connect()
        await sleep(100)
      }
      await sleep(200)
      t.pass('relay and nodes started')
    } catch (err) {
      await cleanup()
      t.fail('Setup failed: ' + String(err))
    }
  })

  tape.test('running e2e tests', t => {
    ping_e2e_case(ctx, t)
    ecdh_e2e_case(ctx, t)
    echo_e2e_case(ctx, t)
    sign_e2e_case(ctx, t)
  })

  tape.test('stopping relay and nodes', async t => {
    await cleanup()
    // Wait for resources to fully release before next test suite
    await sleep(500)
    t.pass('relay and nodes stopped')
  })
}

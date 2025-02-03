import tape from 'tape'

import { sleep }             from '@cmdcode/nostr-p2p/util'
import { parse_test_vector } from '@/test/lib/parse.js'
import { NostrRelay }        from '@/test/lib/relay.js'

import type { TestGroupContext } from '@/test/types.js'

import ecdh_test_case from './src/case/ecdh.test.js'
import sign_test_case from './src/case/sign.test.js'

import VECTOR from './src/vector/pkg.json' assert { type: 'json' }
import { import_test_nodes } from './src/lib/node.js'

const RELAYS  = [ 'ws://localhost:8002' ]

tape('Nostr P2P Test Suite', async t => {

  const vec   = parse_test_vector(VECTOR)
  const pkg   = import_test_nodes(RELAYS, vec)
  const relay = new NostrRelay(8002)
  
  const ctx : TestGroupContext = { ...pkg, relays: RELAYS, tape: t }

  t.test('starting relay and nodes', async t => {
    ctx.nodes.values().forEach(e => e.client.on('bounced', (res) => {
      console.log('bounced:', res)
    }))
    await relay.start()
    await Promise.all(ctx.nodes.values().map(e => e.connect()))
    t.pass('relay and nodes started')
  })

  //await ecdh_test_case(ctx)
  await sign_test_case(ctx)

  t.test('stopping relay and nodes', async t => {
    await sleep(1000) 
    await Promise.all(ctx.nodes.values().map(node => node.close()))
    relay.close()
    t.pass('relay and nodes stopped')
  })
})

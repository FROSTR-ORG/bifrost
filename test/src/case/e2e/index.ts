import { sleep }              from '@cmdcode/nostr-p2p/util'
import { import_test_nodes }  from '@/test/lib/node.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { NostrRelay }         from '@/test/lib/relay.js'

import type { TestNetwork } from '@/test/types.js'

import ecdh_e2e_case from './ecdh.test.js'
import sign_e2e_case from './sign.test.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  const labels = [ 'alice', 'bob', 'carol' ]
  const relay  = new NostrRelay(8192)
  const hosts  = [ relay.url ]

  const vec    = parse_group_vector(VECTOR)
  const pkg    = import_test_nodes(labels, vec, hosts, { debug : true })
  
  const ctx : TestNetwork = { ...pkg, relays: hosts }

  tape.test('starting relay and nodes', async t => {
    // ctx.nodes.values().forEach(e => {
    //   e.on('*', (...params) => {
    //     console.log(params)
    //   })
    // })

    await relay.start()
    await Promise.all(ctx.nodes.values().map(e => e.connect()))
    t.pass('relay and nodes started')
  })

  tape.test('running e2e tests', t => {
    ecdh_e2e_case(ctx, t)
    sign_e2e_case(ctx, t)
  })

  tape.test('stopping relay and nodes', async t => {
    await sleep(1000) 
    await Promise.all(ctx.nodes.values().map(node => node.close()))
    relay.close()
    t.pass('relay and nodes stopped')
  })
}

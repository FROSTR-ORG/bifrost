import tape from 'tape'

import ecdh_test_case from './src/case/ecdh.test.js'
import sign_test_case from './src/case/sign.test.js'
import { FrostNode } from '@/index.js'
import { WSSRelay }  from './src/util/relay.js'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

import PKG from './src/vector/pkg.json' assert { type: 'json' }

const GROUP   = decode_group_pkg(PKG.group)

const SHARE_1 = decode_share_pkg(PKG.shares[0])
const SHARE_2 = decode_share_pkg(PKG.shares[1])
const SHARE_3 = decode_share_pkg(PKG.shares[2])

const RELAYS  = [ 'ws://localhost:8002' ]

tape('Bifrost Test Suite', async t => {

  const relay = new WSSRelay(8002)

  const nodes = [
    new FrostNode(RELAYS, GROUP, SHARE_1),
    new FrostNode(RELAYS, GROUP, SHARE_2),
    new FrostNode(RELAYS, GROUP, SHARE_3)
  ]

  await relay.connect()

  await Promise.all(nodes.map(e => e.connect()))

  // await ecdh_test_case(t, nodes)
  await sign_test_case(t, nodes)

  t.teardown(() => {
    relay.close()
    process.exit()
  })

})

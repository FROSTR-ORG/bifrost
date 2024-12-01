import { Buff }      from '@cmdcode/buff'
import { FrostNode } from '@frostr/bifrost'
import { WSSRelay }  from '@/test/util/relay.js'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

import PKG from './src/vector/pkg.json' assert { type: 'json' }

const GROUP   = decode_group_pkg(PKG.group)
const SHARE_1 = decode_share_pkg(PKG.shares[0])
const SHARE_2 = decode_share_pkg(PKG.shares[1])
const SHARE_3 = decode_share_pkg(PKG.shares[2])

const MESSAGE = Buff.str("the sun is shining bright today").hex
const PEERS   = GROUP.commits.map(e => e.pubkey)
const RELAYS  = [ 'ws://localhost:8002' ]

const Relay = new WSSRelay(8002)

const Alice = new FrostNode(RELAYS, GROUP, SHARE_1)
const Bob   = new FrostNode(RELAYS, GROUP, SHARE_2)
const Carol = new FrostNode(RELAYS, GROUP, SHARE_3)

Alice.event.on('init', async () => {
  console.log(`Alice is now online`)
  const peers = PEERS.filter(e => e !== Alice.signer.pubkey)
  Alice.req_sig(peers, MESSAGE).then(res => {
    console.log('sign msg res:', res)
    cleanup()
  })
})

Bob.event.on('init', async () => {
  console.log(`Bob is now online`)
})

Carol.event.on('init', async () => {
  console.log(`Carol is now online`)
})

Relay.onconnect(async () => {
  console.log('Relay is online')
  await Bob.connect()
  await Carol.connect()
  await Alice.connect()
})

Relay.connect()

function cleanup () {
  Relay.close()
  process.exit()
}

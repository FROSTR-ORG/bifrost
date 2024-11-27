import { get_shared_secret } from '@cmdcode/nostr-p2p/lib'
import { FrostNode }         from '@frostr/bifrost'
import { WSSRelay }          from '@/test/util/relay.js'

import {
  generate_seckey,
  get_pubkey
} from '@cmdcode/frost/lib'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

import PKG  from '../vectors/pkg.json' assert { type: 'json' }



const GROUP   = decode_group_pkg(PKG.group)
const SHARE_1 = decode_share_pkg(PKG.shares[0])
const SHARE_2 = decode_share_pkg(PKG.shares[1])
const SHARE_3 = decode_share_pkg(PKG.shares[2])

const PEERS  = GROUP.commits.map(e => e.pubkey.slice(2))
const RELAYS = [ 'ws://localhost:8002' ]

const ECDH_SECKEY = generate_seckey()
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY)

const relay = new WSSRelay(8002)

const client = new FrostNode(RELAYS, GROUP, SHARE_1)

client.event.on('init', async () => {
  const ALIAS = 'alice'
  console.log(`${ALIAS} is now online`)

  const res1 = await client.req_ecdh(PEERS, ECDH_PUBKEY)
  console.log('ecdh res:', res1)

  // const res2 = await client.req_sign_msg(PEERS, MESSAGE)
  // console.log('sign msg res:', res2)
})

relay.onconnect(() => {
  console.log('relay is online')
  client.connect()
})

relay.connect()

// import { generate_seckey } from '@cmdcode/frost/lib'

// import {
//   generate_key_set,
//   encode_group_pkg,
//   encode_share_pkg
// } from '@frostr/bifrost/api'

// const THRESHOLD   = 2
// const SHARE_COUNT = 3

// const SECKEY = generate_seckey().hex

// const keyset = generate_key_set(THRESHOLD, SHARE_COUNT, [ SECKEY ])

// console.log('key set:')
// console.dir(keyset, { depth: null })

// const group_enc = encode_group_pkg(keyset.group)

// console.log(`group share:\n${group_enc}`)

// keyset.shares.forEach(share => {
//   const share_enc = encode_share_pkg(share)
//   console.log(`share idx: ${share.idx}\n${share_enc}`)
// })

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

import PKG  from './src/vectors/pkg.json' assert { type: 'json' }
import { sleep } from '@/util/helpers.js'



const GROUP   = decode_group_pkg(PKG.group)
const SHARE_1 = decode_share_pkg(PKG.shares[0])
const SHARE_2 = decode_share_pkg(PKG.shares[1])
const SHARE_3 = decode_share_pkg(PKG.shares[2])

const MESSAGE = ""
const PEERS   = GROUP.commits.map(e => e.pubkey.slice(2))
const RELAYS  = [ 'ws://localhost:8002' ]

const ECDH_SECKEY = generate_seckey()
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY)

const Relay = new WSSRelay(8002)

const Alice = new FrostNode(RELAYS, GROUP, SHARE_1)
const Bob   = new FrostNode(RELAYS, GROUP, SHARE_2)
const Carol = new FrostNode(RELAYS, GROUP, SHARE_3)

Alice.event.on('init', async () => {
  console.log(`Alice is now online`)
  
  // await sleep(7000)

  // const res1 = await Alice.req_ecdh(PEERS, ECDH_PUBKEY)
  // console.log('ecdh res:', res1)

  const res2 = await Alice.sign_msg(PEERS, MESSAGE)
  console.log('sign msg res:', res2)
})

Bob.event.on('init', async () => {
  console.log(`Bob is now online`)
})

Carol.event.on('init', async () => {
  console.log(`Carol is now online`)

  const res1 = await Alice.req_ecdh(PEERS, ECDH_PUBKEY)
  console.log('ecdh res:', res1)
})

Relay.onconnect(async () => {
  console.log('Relay is online')
  // await sleep(2000)
  await Alice.connect()
  await Bob.connect()
  await Carol.connect()
})

Relay.connect()

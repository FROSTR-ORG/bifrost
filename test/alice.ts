import { Buff }        from '@cmdcode/buff'
import { NostrClient } from '@cmdcode/nostr-node'
import { get_pubkey, sleep }  from '@cmdcode/nostr-node/lib'

const KINDS = [ 20004 ]

const PEERS = [
  'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e',
  'd6fe5186bf6d3f09ac0804bd70df4d13283d2bde5498809a0fb58e12735aace1'
]

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const alice_sk = 'fb28f2dd3e34ffeef84e533816b1f8c57b83b447f7f005101c079264b6406186'
const alice_pk = get_pubkey(alice_sk)

console.log('alice sk:', alice_sk)
console.log('alice pk:', alice_pk)

const node = new NostrClient(KINDS, PEERS, RELAYS, alice_sk)
const mid  = Buff.random(16).hex

node.evt.on('filter', err => console.log('filter', err))

node.rpc.on('pong', msg => {
  console.log('alice received rpc:', msg.tag, msg.dat)
})

node.msg.on(mid, msg => {
  console.log('alice received msg:', msg.mid, msg.dat)
})

await node.connect()

console.log('connected')

await sleep(2000)

console.log('sending message ...')

// const relays = await node.send('ping', 'ping!', PEERS[0], mid)

// console.log(relays)

const res = await node.req('ping', 'ping!', PEERS)

console.log('events:', res)
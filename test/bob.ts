import { Buff }              from '@cmdcode/buff'
import { NostrClient }       from '@cmdcode/nostr-node'
import { get_pubkey, sleep } from '@cmdcode/nostr-node/lib'

const KINDS = [ 20004 ]

const PEERS = [
  '838c5a02218f2e9ae120dfbd397ee7352f567f3cf1eba044808947b4310c2bbf',
  'd6fe5186bf6d3f09ac0804bd70df4d13283d2bde5498809a0fb58e12735aace1'
]

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const bob_sk = '2d91e39980bd3eaf45f59ff242b4e4fa83f78d391714c33ca11bb2e49348affc'
const bob_pk = get_pubkey(bob_sk)

console.log('bob sk:', bob_sk)
console.log('bob pk:', bob_pk)

const node = new NostrClient(KINDS, PEERS, RELAYS, bob_sk)

node.evt.on('filter', err => console.log('filter', err))

node.rpc.on('ping', async msg => {
  console.log('bob received rpc:', msg.tag, msg.dat)
  await sleep(2000)
  console.log('sending response ...')
  const relays = await node.send('pong', 'pong!', PEERS[0], msg.mid)
  console.log(relays)
})

await node.connect()

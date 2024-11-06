import { Buff }              from '@cmdcode/buff'
import { NostrClient }       from '@cmdcode/nostr-node'
import { gen_seckey, get_pubkey, sleep } from '@cmdcode/nostr-node/lib'

const KINDS = [ 20004 ]

const PEERS = [
  '838c5a02218f2e9ae120dfbd397ee7352f567f3cf1eba044808947b4310c2bbf',
  'fb19683d99686c11243cb854968e2fb9657df3babfd65dc51acdeb95aef6743e'
]

const RELAYS = [
  'wss://relay.nostrdice.com',
  'wss://relay.snort.social'
]

const carol_sk = gen_seckey('df3566790211b7af4557b533ccf5144e6a0283d6c3b7e079d8662fa2358481b4')
const carol_pk = get_pubkey(carol_sk)

console.log('carol sk:', carol_sk)
console.log('carol pk:', carol_pk)

const node = new NostrClient(KINDS, PEERS, RELAYS, carol_sk)

node.evt.on('filter', err => console.log('filter', err))

node.rpc.on('ping', async msg => {
  console.log('carol received rpc:', msg.tag, msg.dat)
  await sleep(2000)
  console.log('sending response ...')
  const relays = await node.send('pong', 'pong!', PEERS[0], msg.mid)
  console.log(relays)
})

await node.connect()

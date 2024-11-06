import { get_pubkey } from '@/client/lib/event.js'
import { generate_seckey } from '@cmdcode/frost/lib'
import { NostrClient } from '@cmdcode/nostr-node'

const KINDS = [ 20004 ]
const RELAYS : string[] = [
  'wss://relay.nostrdice.com',
  'njump.me',
  'relay.snort.social'
]

const alice_sk = generate_seckey().hex
const alice_pk = get_pubkey(alice_sk)

const bob_sk = generate_seckey().hex
const bob_pk = get_pubkey(alice_sk)

const peers = [ alice_pk, bob_pk ]

const node_a = new NostrClient(KINDS, peers, RELAYS, alice_sk)
const node_b = new NostrClient(KINDS, peers, RELAYS, bob_sk)

node_a.rpc.on('test', msg => {
  console.log('alice recvd:', msg)
})

node_b.rpc.on('test', msg => {
  console.log('alice recvd:', msg)
})

node_a.send('test', 'hello bob!', bob_pk)

node_b.connect()
node_a.connect()

import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { Test }        from 'tape'
import type { TestNetwork } from '@/test/types.js'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice')!
  const Bob   = ctx.nodes.get('bob')!
  const Carol = ctx.nodes.get('carol')!

  tape.test('Ping Test', async t => {
    try {
      // Ping all peers to exchange nonces
      // This is needed for signing to work with the nonce pool system
      const pingPromises = [
        Alice.req.ping(Bob.pubkey),
        Alice.req.ping(Carol.pubkey),
        Bob.req.ping(Alice.pubkey),
        Bob.req.ping(Carol.pubkey),
        Carol.req.ping(Alice.pubkey),
        Carol.req.ping(Bob.pubkey)
      ]

      const results = await Promise.all(pingPromises)

      // Check if all pings succeeded
      for (const res of results) {
        if (!res.ok) {
          t.fail('Ping failed: ' + res.err)
          t.end()
          return
        }
      }

      // Verify Alice's peer state for Bob
      const peer = Alice.peers.find(e => e.pubkey === Bob.pubkey)
      if (peer === undefined) throw new Error('peer data not found')
      t.equal(peer.policy.send, true, `${peer.pubkey.slice(0, 6)} send policy matches`)
      t.equal(peer.policy.recv, true, `${peer.pubkey.slice(0, 6)} recv policy matches`)
      t.equal(peer.status, 'online',  `${peer.pubkey.slice(0, 6)} status is online`)
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

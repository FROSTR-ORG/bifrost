import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { Test }        from 'tape'
import type { TestNetwork } from '@/test/types.js'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice')!
  const Bob   = ctx.nodes.get('bob')!

  tape.test('Ping Test', async t => {
    try {
      const res = await Alice.req.ping(Bob.pubkey)
      if (!res.ok) {
        t.fail(res.err)
      } else {
        const peer = Alice.peers.find(e => e.pubkey === Bob.pubkey)
        if (peer === undefined) throw new Error('peer data not found')
        t.equal(peer.policy.send, true, `${peer.pubkey.slice(0, 6)} send policy matches`)
        t.equal(peer.policy.recv, true, `${peer.pubkey.slice(0, 6)} recv policy matches`)
        t.equal(peer.status, 'online',  `${peer.pubkey.slice(0, 6)} status is online`)
      }
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

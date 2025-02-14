import { TestNetwork } from '@/test/types.js'
import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { Test } from 'tape'
import { get_pubkey } from '@/lib/crypto.js'

const ECDH_SECKEY = '9e1aa53570f21eb33373b526853b409bb735d085b0238326d3014dbdd39cbcb0'
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY, 'bip340')
const ECDH_TARGET = '02d8a9d1ca9a01702f0a4dad3cbfea1a770890e28bc10919cdeb099cdb8814da0c'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice')!
  const Bob   = ctx.nodes.get('bob')!

  tape.test('ECDH Test', async t => {
    try {
      const res = await Alice.req.ecdh(ECDH_PUBKEY, [ Bob.pubkey ])
      if (!res.ok) {
        t.fail(res.err)
      } else {
        t.equal(res.data, ECDH_TARGET, 'ECDH target matches')
      }
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

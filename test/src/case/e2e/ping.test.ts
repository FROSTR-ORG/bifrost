import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { Test }        from 'tape'
import type { TestNetwork } from '@/test/types.js'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice')!

  tape.test('Ping Test', async t => {
    try {
      const res = await Alice.req.ping()
      if (!res.ok) {
        t.fail(res.err)
      } else {
        t.equal(res.data.length, 2, 'Ping response length matches')
      }
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

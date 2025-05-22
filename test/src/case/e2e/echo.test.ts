import { Buff }        from '@cmdcode/buff'
import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { Test }        from 'tape'
import type { TestNetwork } from '@/test/types.js'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice')!

  tape.test('Echo Test', async t => {
    try {
      const chal = Buff.random(32).hex
      const res  = await Alice.req.echo(chal)
      if (!res.ok) {
        t.fail(res.err)
      } else {
        t.equal(res.data, chal, 'echo response matches')
      }
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

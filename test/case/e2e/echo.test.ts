import { Buff }        from '@vbyte/buff'
import { LIB }         from '@vbyte/nostr-sdk'
const { parse_error } = LIB

import type { Test }        from 'tape'
import type { TestNetwork } from '@/test/types.js'

export default function (
  ctx  : TestNetwork,
  tape : Test
) {
  tape.test('Echo Test', async t => {
    const Alice = ctx.nodes.get('alice')!

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

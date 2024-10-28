import { Buff }             from '@cmdcode/buff'
import { verify_signature } from '@/lib/crypto.js'
import { parse_error }      from '@/util/index.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

const MESSAGE = Buff.str('Hello, world!').digest.hex

export default function (
  ctx : TestNetwork,
  tape : Test
) {
  const Alice    = ctx.nodes.get('alice')!
  const Bob      = ctx.nodes.get('bob')!
  const group_pk = Alice.group.group_pk

  tape.test('Signature Test', async t => {
    try {
      const res = await Alice.req.sign(MESSAGE, [ Bob.pubkey ])
      if (!res.ok) {
        t.fail(res.err)
      } else {
        const is_valid = verify_signature(res.data, MESSAGE, group_pk, 'bip340')
        t.ok(is_valid, 'signature is valid')
      }
    } catch (err) {
      console.log('error:', err)
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

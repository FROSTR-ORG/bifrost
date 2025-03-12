import { Buff }             from '@cmdcode/buff'
import { verify_signature } from '@/lib/crypto.js'
import { parse_error }      from '@/util/index.js'

import type { SighashVector } from '@/types/sign.js'
import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

const MESSAGES : SighashVector[] = [
  [ Buff.str('Hello, world!').digest.hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
  [ Buff.random(32).hex ],
]

export default function (
  ctx : TestNetwork,
  tape : Test
) {
  const Alice    = ctx.nodes.get('alice')!
  const group_pk = Alice.group.group_pk

  tape.test('Signature Test', async t => {
    try {
      const res = await Alice.req.sign(MESSAGES)
      if (!res.ok) {
        t.fail(res.err)
      } else {
        const checks = res.data.map(([ msg, sig ]) => {
          return verify_signature(sig, msg, group_pk, 'bip340')
        })
        t.ok(checks.every(e => e === true), 'all signatures are valid')
      }
    } catch (err) {
      console.log('error:', err)
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

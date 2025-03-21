import { Buff }             from '@cmdcode/buff'
import { verify_signature } from '@/lib/crypto.js'
import { parse_error }      from '@/util/index.js'
import { BifrostNode }      from '@/class/client.js'

import type { SighashVector } from '@/types/sign.js'
import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

const MESSAGES : SighashVector[] = [
  [ Buff.str('Hello, world!').digest.hex, Buff.random(32).hex ],
  [ Buff.random(32).hex, Buff.random(32).hex ],
  [ Buff.random(32).hex, Buff.random(32).hex ]
]

export default function (
  ctx : TestNetwork,
  tape : Test
) {
  const Alice = ctx.nodes.get('alice') as BifrostNode

  tape.test('Signature Test', async t => {
    try {
      const sigs   = await Promise.all(MESSAGES.map(msg => Alice.req.queue(msg)))
      const checks = sigs.map(([ msg, pubkey, sig ]) => {
        return verify_signature(sig, msg, pubkey, 'bip340')
      })
      t.ok(checks.every(e => e === true), 'all signatures are valid')
    } catch (err) {
      console.log('error:', err)
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

import { Buff }             from '@vbyte/buff'
import { verify_signature } from '@/util/crypto.js'
import { parse_error }      from '@/util/index.js'
import { BifrostNode }      from '@/class/client.js'
import { hash_string }      from '@/test/lib/hash.js'

import type { SighashVector } from '@/types/sign.js'
import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

const MESSAGES : SighashVector[] = [
  [ hash_string('Hello, world!'), Buff.random(32).hex ],
  [ Buff.random(32).hex, Buff.random(32).hex ],
  [ Buff.random(32).hex, Buff.random(32).hex ]
]

export default function (
  ctx : TestNetwork,
  tape : Test
) {
  tape.test('Signature Test', async t => {
    const Alice = ctx.nodes.get('alice') as BifrostNode

    try {
      const results = await Promise.all(MESSAGES.map(msg => Alice.req.sign(msg)))

      // Check all requests succeeded
      const all_ok = results.every(r => r.ok)
      t.ok(all_ok, 'all sign requests succeeded')

      // Verify all signatures
      const checks = results.map(r => {
        const [ msg, pubkey, sig ] = r.data
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

import { Buff }        from '@cmdcode/buff'
import { verify_sig }  from '@cmdcode/nostr-p2p/lib'
import { parse_error } from '@cmdcode/nostr-p2p/util'

import type { TestGroupContext } from '@/test/types.js'

const MESSAGE = Buff.str('Hello, world!').digest.hex
const TIMEOUT = 6000

export default function (ctx : TestGroupContext) {
  const Alice    = ctx.nodes.get('alice')!
  const Bob      = ctx.nodes.get('bob')!
  const peers    = [ Bob.client.pubkey ]
  const group_pk = Alice.group.pubkey

  return new Promise((resolve) => {
    ctx.tape.test('Signature Test', async t => {
      const timer = setTimeout(() => resolve('timeout'), TIMEOUT)
      try {
        const res = await Alice.req.sign(MESSAGE, peers)
        if (!res.ok) {
          t.fail(res.err)
        } else {
          const is_valid = verify_sig(MESSAGE, group_pk, res.data)
          t.ok(is_valid, 'signature is valid')
        }
      } catch (err) {
        t.fail(parse_error(err))
      } finally {
        t.end()
        clearTimeout(timer)
        resolve(null)
      }
    })
  })
}

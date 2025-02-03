import { get_pubkey }  from '@cmdcode/frost/lib'
import { TestGroupContext } from '@/test/types.js'
import { parse_error } from '@cmdcode/nostr-p2p/util'

const TIMEOUT     = 6000

const ECDH_SECKEY = '9e1aa53570f21eb33373b526853b409bb735d085b0238326d3014dbdd39cbcb0'
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY)
const ECDH_TARGET = '0272af2dea337c5c214f5f0934ec32257312da1889e40f3fd95fec9913f1db2ceb'

export default function (ctx : TestGroupContext) {
  const Alice = ctx.nodes.get('alice')!
  const Bob   = ctx.nodes.get('bob')!

  return new Promise((resolve) => {
    ctx.tape.test('ECDH Test', async t => {
      const timer = setTimeout(() => resolve('timeout'), TIMEOUT)
      try {
        const res = await Alice.req.ecdh([ Bob.client.pubkey ], ECDH_PUBKEY)
        if (!res.ok) {
          t.fail(res.err)
        } else {
          t.equal(res.data, ECDH_TARGET, 'ECDH target matches')
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

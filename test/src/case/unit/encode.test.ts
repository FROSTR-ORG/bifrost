import { Buff }                from '@cmdcode/buff'
import { generate_dealer_pkg } from '@frostr/bifrost/lib'
import { parse_error }         from '@frostr/bifrost/util'

import {
  decode_group_pkg,
  decode_share_pkg,
  encode_group_pkg,
  encode_share_pkg
} from '@/encoder/index.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {
  const vec_group   = VECTOR.group
  const vec_shares  = VECTOR.shares
  const vec_seeds   = VECTOR.seeds
  const nonce_seeds = vec_seeds.map(e => Buff.join([ e, e ]).hex)

  const pkg = generate_dealer_pkg(2, 3, vec_seeds, nonce_seeds)

  tape.test('encoding tests', t => {
    try {
      const enc_group  = encode_group_pkg(pkg.group)
      const enc_shares = pkg.shares.map(e => encode_share_pkg(e))
      const dec_group  = decode_group_pkg(enc_group)
      const dec_shares = enc_shares.map(e => decode_share_pkg(e))

      t.equal(enc_group,  vec_group,      'group encodings are equal')
      t.deepEqual(enc_shares, vec_shares, 'all shares encodings are equal')

      t.deepEqual(dec_group,  pkg.group,   'group encodes and decodes')
      t.deepEqual(dec_shares, pkg.shares,  'all shares encode and decode')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

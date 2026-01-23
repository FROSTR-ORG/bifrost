import { parse_error } from '@frostr/bifrost/util'

import {
  generate_dealer_package,
  recover_secret_key
} from '@frostr/bifrost/lib'

import {
  decode_group_package,
  decode_share_package
} from '@/encoder/index.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {
  const vec_group   = VECTOR.group
  const vec_shares  = VECTOR.shares
  const vec_seed    = VECTOR.seeds.at(0)!
  const pkg         = generate_dealer_package(2, 3, [ vec_seed ])

  tape.test('vector recovery test', t => {
    try {
      const dec_group  = decode_group_package(vec_group)
      const dec_shares = vec_shares.map(e => decode_share_package(e))
      const seckey     = recover_secret_key(dec_group, dec_shares)
      t.equal(seckey, vec_seed, 'secret key is recovered from vector')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })

  tape.test('random recovery test', t => {
    try {
      const seckey = recover_secret_key(pkg.group, pkg.shares)
      t.equal(seckey, vec_seed, 'secret key is recovered from random shares')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

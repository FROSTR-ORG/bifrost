import { Buff }   from '@vbyte/buff'

import { generate_dealer_package } from '@/lib/index.js'
import { hash_string }             from '@/test/lib/hash.js'

import {
  encode_group_package,
  encode_share_package
} from '@/encoder/index.js'

const DEFAULT_SECRETS = [ 'alice', 'bob', 'carol' ]

export default function (secrets = DEFAULT_SECRETS) {

  const share_seeds = secrets.map(e => hash_string(e))
  const nonce_seeds = share_seeds.map(e => Buff.join([ e, e ]).hex)

  const pkg    = generate_dealer_package(2, 3, share_seeds, nonce_seeds)
  const group  = encode_group_package(pkg.group)
  const shares = pkg.shares.map(e => encode_share_package(e))
  const vector = { group, shares, seeds: share_seeds }

  return vector
}

import { generate_key_set } from '@/api/generate.js'

import {
  encode_group_pkg,
  encode_share_pkg
} from '@/api/encoder.js'

const keyset = generate_key_set(2,3)

console.dir(keyset, { depth: null })

const group  = encode_group_pkg(keyset.group)
const shares = keyset.shares.map(e => encode_share_pkg(e))

console.log(JSON.stringify({ group, shares }, null, 2))

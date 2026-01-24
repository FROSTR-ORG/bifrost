import { z }      from 'zod'
import { Schema } from '@/index.js'

import {
  decode_group_package,
  decode_share_package
} from '@/encoder/index.js'

import type { GroupTestVector } from '@/test/types.js'

const group_schema = z.object({
  group   : Schema.base.bech32,
  shares  : Schema.base.bech32.array(),
  seeds   : Schema.base.hex32.array()
})

export function parse_group_vector (vector : unknown) : GroupTestVector {
  const parsed = group_schema.safeParse(vector)
  if (!parsed.success) {
    console.log(parsed.error)
    throw new Error('test vector failed schema validation')
  }
  const group   = decode_group_package(parsed.data.group)
  const shares  = parsed.data.shares.map(e => decode_share_package(e))
  const seeds   = parsed.data.seeds
  return { group, shares, seeds }
}

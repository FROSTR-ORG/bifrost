import { z }      from 'zod'
import { Schema } from '@frostr/bifrost'

import type { TestGroupVector } from '@/test/types.js'

const vector_schema = z.object({
  group  : Schema.base.bech32,
  shares : z.tuple([ z.string(), Schema.base.bech32 ]).array()
})

export function parse_test_vector (vector : unknown) : TestGroupVector {
  const parsed = vector_schema.safeParse(vector)
  if (!parsed.success) throw new Error('test vector failed schema validation')
  return parsed.data
}


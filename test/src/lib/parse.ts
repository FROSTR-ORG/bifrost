import { z }      from 'zod'
import { Schema } from '@frostr/bifrost'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@/lib/encoder.js'

import type { GroupVector, SessionVector } from '@/test/types.js'

const { commit, member } = Schema.sign

const group_schema = z.object({
  group   : Schema.base.bech32,
  shares  : Schema.base.bech32.array(),
  seeds   : Schema.base.hex32.array()
})

const session_schema = group_schema.extend({
  members : member.merge(commit).array(),
  session : Schema.sign.session
})

export function parse_group_vector (vector : unknown) : GroupVector {
  const parsed = group_schema.safeParse(vector)
  if (!parsed.success) {
    console.log(parsed.error)
    throw new Error('test vector failed schema validation')
  }
  const group   = decode_group_pkg(parsed.data.group)
  const shares  = parsed.data.shares.map(e => decode_share_pkg(e))
  const seeds   = parsed.data.seeds
  return { group, shares, seeds }
}

export function parse_session_vector (vector : unknown) : SessionVector {
  const parsed = session_schema.safeParse(vector)
  if (!parsed.success) {
    console.log(parsed.error)
    throw new Error('test vector failed schema validation')
  }
  const group   = decode_group_pkg(parsed.data.group)
  const members = parsed.data.members
  const session = parsed.data.session
  const shares  = parsed.data.shares.map(e => decode_share_pkg(e))
  const seeds   = parsed.data.seeds
  return { group, members, session, shares, seeds }
}

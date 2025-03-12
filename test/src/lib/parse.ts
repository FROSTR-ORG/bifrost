import { z }      from 'zod'
import { Schema } from '@frostr/bifrost'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@/lib/encoder.js'

import type { GroupTestVector, SessionTestVector } from '@/test/types.js'

const group_schema = z.object({
  group   : Schema.base.bech32,
  shares  : Schema.base.bech32.array(),
  seeds   : Schema.base.hex32.array()
})

const session_schema = group_schema.extend({
  session     : Schema.sign.session,
  sig_commits : Schema.sign.commit.array(),
  sig_shares  : Schema.sign.member.array()
})

export function parse_group_vector (vector : unknown) : GroupTestVector {
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

export function parse_session_vector (vector : unknown) : SessionTestVector {
  const parsed = session_schema.safeParse(vector)
  if (!parsed.success) {
    console.log(parsed.error)
    throw new Error('test vector failed schema validation')
  }
  const group       = decode_group_pkg(parsed.data.group)
  const session     = parsed.data.session
  const shares      = parsed.data.shares.map(e => decode_share_pkg(e))
  const seeds       = parsed.data.seeds
  const sig_commits = parsed.data.sig_commits
  const sig_shares  = parsed.data.sig_shares
  return { group, session, shares, seeds, sig_commits, sig_shares }
}

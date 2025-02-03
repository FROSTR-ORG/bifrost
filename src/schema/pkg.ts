import { z } from 'zod'
import base  from './base.js'

const members = base.hex32.array()

const session = z.object({
  members,
  message : base.hex32,
  sid     : base.hex32,
  stamp   : base.stamp
})

const ecdh = z.object({
  idx      : base.num,
  keyshare : base.hex,
  members,
  peer_pk  : base.hex
})

const sign = session.extend({
  idx     : base.num,
  psig    : base.hex,
  pubkey  : base.hex
})

export default {
  ecdh,
  session,
  sign
}

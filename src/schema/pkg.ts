import { z } from 'zod'
import base  from './base.js'

const members = base.hex32.array()

const commit = z.object({
  idx       : base.num,
  pubkey    : base.hex32,
  hidden_pn : base.hex33,
  binder_pn : base.hex33
})

const group = z.object({
  commits   : z.array(commit),
  pubkey    : base.hex32,
  threshold : base.num
})

const share = z.object({
  idx       : base.num,
  pubkey    : base.hex32,
  hidden_pn : base.hex33,
  binder_pn : base.hex33,
  binder_sn : base.hex32,
  hidden_sn : base.hex32,
  seckey    : base.hex32
})

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
  commit,
  ecdh,
  group,
  session,
  share,
  sign
}

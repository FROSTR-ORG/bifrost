import { z } from 'zod'
import base  from './base.js'

const commit = z.object({
  idx       : base.num,
  pubkey    : base.hex33,
  hidden_pn : base.hex33,
  binder_pn : base.hex33
})

const group = z.object({
  commits   : z.array(commit),
  group_pk  : base.hex33,
  threshold : base.num
})

const share = z.object({
  idx       : base.num,
  binder_sn : base.hex32,
  hidden_sn : base.hex32,
  seckey    : base.hex32
})

const ecdh = z.object({
  idx      : base.num,
  keyshare : base.hex,
  members  : base.num.array(),
  ecdh_pk  : base.hex
})

const session = z.object({
  gid     : base.hex32,
  members : base.num.array(),
  message : base.hex32,
  sid     : base.hex32,
  stamp   : base.num
})

const psig = z.object({
  idx     : base.num,
  psig    : base.hex,
  pubkey  : base.hex33,
  sid     : base.hex32
})

export default {
  commit,
  ecdh,
  group,
  share,
  session,
  psig
}

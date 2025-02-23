import z from 'node_modules/zod/lib/index.js'
import base  from './base.js'
import pkg   from './pkg.js'

const commit = pkg.commit.extend({
  bind_hash : base.hex32
})

const member = pkg.share.extend({
  bind_hash : base.hex32
})

const session = z.object({
  gid     : base.hex32,
  members : base.num.array(),
  message : base.hex32,
  payload : base.str.nullable(),
  sid     : base.hex32,
  stamp   : base.num,
  type    : base.str,
  tweaks  : base.hex32.array()
})

const psig = z.object({
  idx     : base.num,
  psig    : base.hex,
  pubkey  : base.hex33,
  sid     : base.hex32
})

export default { commit, member, psig, session }

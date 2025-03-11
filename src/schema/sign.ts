import z     from 'zod'
import base  from './base.js'
import pkg   from './pkg.js'

const commit = pkg.commit.extend({
  bind_hash : base.hex32,
  sighash   : base.hex32
})

const member = pkg.share.extend({
  bind_hash : base.hex32,
  sighash   : base.hex32
})

const psig_entry = z.tuple([ base.hex32, base.hex32 ])
const hash_entry = z.tuple([ base.hex32 ]).rest(base.hex32)

const session = z.object({
  content : base.str.nullable(),
  gid     : base.hex32,
  hashes  : hash_entry.array(),
  members : base.num.array(),
  sid     : base.hex32,
  stamp   : base.num,
  type    : base.str,
})

const psig = z.object({
  idx     : base.num,
  psigs   : psig_entry.array(),
  pubkey  : base.hex33,
  sid     : base.hex32
})

export default { commit, member, psig, session }

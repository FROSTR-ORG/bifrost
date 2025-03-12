import z     from 'zod'
import base  from './base.js'
import pkg   from './pkg.js'

const commit = pkg.commit.extend({
  bind_hash : base.hex32,
  sid       : base.hex32,
  sighash   : base.hex32
})

const member = pkg.share.extend({
  bind_hash : base.hex32,
  sid       : base.hex32,
  sighash   : base.hex32
})

const psig_entry  = z.tuple([ base.hex32, base.hex32 ])
const sighash_vec = z.tuple([ base.hex32 ]).rest(base.hex32)

const template = z.object({
  content : base.str.nullable(),
  hashes  : sighash_vec.array(),
  members : base.num.array(),
  stamp   : base.num,
  type    : base.str,
})

const session = template.extend({
  gid : base.hex32,
  sid : base.hex32,
})

const psig_pkg = z.object({
  idx     : base.num,
  psigs   : psig_entry.array(),
  pubkey  : base.hex33,
  sid     : base.hex32
})

export default { commit, member, psig_entry, psig_pkg, session, sighash_vec, template }

import base  from './base.js'
import pkg   from './pkg.js'

const commit = pkg.commit.extend({
  bind_hash : base.hex32
})

const member = pkg.share.extend({
  bind_hash : base.hex32
})

export default { commit, member }

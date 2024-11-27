import { z } from 'zod'
import base  from './base.js'

const members = base.num.array()

const session_pkg = z.object({
  binder  : base.hex32,
  members,
  sid     : base.hex32,
  stamp   : base.stamp
})

const ecdh_pkg = z.object({
  idx      : base.num,
  members,
  peer_pk  : base.hex,
  pubshare : base.hex
})

const sign_msg_pkg = z.object({
  idx     : base.num,
  message : base.str,
  psig    : base.hex,
  pubkey  : base.hex,
  session : session_pkg
})

export default {
  ecdh_pkg,
  session_pkg,
  sign_msg_pkg
}

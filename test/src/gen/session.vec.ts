import { Buff }            from '@cmdcode/buff'
import { get_memberships } from '@/test/lib/util.js'

import {
  decode_group_pkg,
  create_session_pkg,
  decode_share_pkg
} from '@frostr/bifrost/lib'

import generate_group from './group.vec.js'

const DEFAULT_CONFIG = {
  secrets : [ 'alice', 'bob', 'carol' ],
  message : Buff.str('hello world').digest.hex,
  members : [ 1, 3 ]
}

export default function (opt ?: Partial<typeof DEFAULT_CONFIG>) {
  const config  = { ...DEFAULT_CONFIG, ...opt }
 
  const vector  = generate_group(config.secrets)
  const group   = decode_group_pkg(vector.group)
  const shares  = vector.shares.map(e => decode_share_pkg(e))
  const session = create_session_pkg(group, config.members, config.message)
  const members = get_memberships(group, session, shares)

  return { ...vector, session, members }
}

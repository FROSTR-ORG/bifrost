import { Buff } from '@cmdcode/buff'

import { create_session_shares } from '@/test/lib/util.js'

import {
  decode_group_pkg,
  create_session_pkg,
  decode_share_pkg,
  create_session_template,
  create_session_commits
} from '@frostr/bifrost/lib'

import generate_group from './group.vec.js'

const DEFAULT_CONFIG = {
  secrets  : [ 'alice', 'bob', 'carol' ],
  messages : [
    [ Buff.str('msg-alpha').digest.hex, Buff.str('twk-alpha').digest.hex ],
    [ Buff.str('msg-beta').digest.hex,  Buff.str('twk-beta').digest.hex  ],
    [ Buff.str('msg-gamma').digest.hex, Buff.str('twk-gamma').digest.hex ],
    [ Buff.str('msg-delta').digest.hex, Buff.str('twk-delta').digest.hex ],
  ],
  members  : [ 1, 3 ]
}

export default function (opt ?: Partial<typeof DEFAULT_CONFIG>) {
  const config   = { ...DEFAULT_CONFIG, ...opt }
  const vector   = generate_group(config.secrets)
  const group    = decode_group_pkg(vector.group)
  const shares   = vector.shares.map(e => decode_share_pkg(e))
  const template = create_session_template(config.members, config.messages)
  if (template === null) throw new Error('template is null')
  const session     = create_session_pkg(group, template)
  const sig_commits = create_session_commits(group, session)
  const sig_shares  = create_session_shares(session, shares)
  return { ...vector, session, sig_commits, sig_shares }
}

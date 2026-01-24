import { create_session_shares } from '@/test/lib/util.js'
import { hash_string }           from '@/test/lib/hash.js'

import {
  decode_group_package,
  decode_share_package
} from '@frostr/bifrost/encoder'

import {
  create_session_pkg,
  create_session_template,
  create_session_commits
} from '@frostr/bifrost/lib'

import generate_group from './group.vec.js'

const DEFAULT_CONFIG = {
  secrets  : [ 'alice', 'bob', 'carol' ],
  messages : [
    [ hash_string('msg-alpha'), hash_string('twk-alpha') ],
    [ hash_string('msg-beta'),  hash_string('twk-beta')  ],
    [ hash_string('msg-gamma'), hash_string('twk-gamma') ],
    [ hash_string('msg-delta'), hash_string('twk-delta') ],
  ],
  members  : [ 1, 3 ]
}

export default function (opt ?: Partial<typeof DEFAULT_CONFIG>) {
  const config   = { ...DEFAULT_CONFIG, ...opt }
  const vector   = generate_group(config.secrets)
  const group    = decode_group_package(vector.group)
  const shares   = vector.shares.map(e => decode_share_package(e))
  const template = create_session_template(config.members, config.messages)
  if (template === null) throw new Error('template is null')
  const session     = create_session_pkg(group, template)
  const sig_commits = create_session_commits(group, session)
  const sig_shares  = create_session_shares(session, shares)
  return { ...vector, session, sig_commits, sig_shares }
}

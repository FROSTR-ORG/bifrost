import { parse_error }          from '@frostr/bifrost/util'
import { parse_session_vector } from '@/test/lib/parse.js'

import {
  create_session_pkg,
  verify_session_pkg
} from '@/lib/session.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/session.vec.json' with { type: 'json' }

export default function (tape : Test) {
  const { group, session: target } = parse_session_vector(VECTOR)

  tape.test('test session creation', t => {
    try {
      const session  = create_session_pkg(group, target.members, target.message, target.stamp)
      const is_valid = verify_session_pkg(group, session)

      t.equal(session.gid, target.gid, 'group id is correct')
      t.equal(session.sid, target.sid, 'session id is correct')
      t.true(is_valid,                 'session is valid')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })
}

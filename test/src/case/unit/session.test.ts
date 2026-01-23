import { Assert, parse_error }     from '@frostr/bifrost/util'
import { generate_dealer_package } from '@frostr/bifrost/lib'

import {
  create_session_pkg,
  create_session_template,
  verify_session_pkg
} from '@/lib/session.js'

import type { Test } from 'tape'

export default function (tape : Test) {
  tape.test('test session creation', t => {
    try {
      // Generate a fresh package for testing
      const { group } = generate_dealer_package(2, 3)

      const members = [ 1, 3 ]
      const hashes  = [
        ['deadbeef'.repeat(8), 'cafebabe'.repeat(8)],
        ['12345678'.repeat(8), 'abcdef01'.repeat(8)]
      ]
      const options = {
        content : null,
        stamp   : 1700000000,
        type    : 'message'
      }

      const template = create_session_template(members, hashes, options)
      Assert.exists(template, 'session template is not null')

      const session = create_session_pkg(group, template)
      const is_valid = verify_session_pkg(group, session)

      // Verify session properties
      t.ok(typeof session.gid === 'string' && session.gid.length === 64, 'group id is a valid 32-byte hex string')
      t.ok(typeof session.sid === 'string' && session.sid.length === 64, 'session id is a valid 32-byte hex string')
      t.true(is_valid, 'session is valid')

      // Verify session matches template
      t.deepEqual(session.members, members, 'members match')
      t.deepEqual(session.hashes, hashes, 'hashes match')
      t.equal(session.content, options.content, 'content matches')
      t.equal(session.stamp, options.stamp, 'stamp matches')
      t.equal(session.type, options.type, 'type matches')

      // Verify deterministic session ID
      const session2 = create_session_pkg(group, template)
      t.equal(session.gid, session2.gid, 'same group produces same gid')
      t.equal(session.sid, session2.sid, 'same template produces same sid')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })
}

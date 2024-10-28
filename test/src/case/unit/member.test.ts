import { get_pubkey }           from '@frostr/bifrost/lib'
import { Assert, parse_error }  from '@frostr/bifrost/util'
import { parse_session_vector } from '@/test/lib/parse.js'
import { get_session_commit }   from '@/lib/session.js'
import { get_memberships }      from '@/test/lib/util.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/session.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  tape.test('test session memberships', t => {
    const { group, session, shares, members: targets } = parse_session_vector(VECTOR)

    const memberships = get_memberships(session, shares)

    for (const mbr of memberships) {
      try {
        const commit = get_session_commit(group, session, mbr.idx)
        const target = targets.find(e => e.idx === mbr.idx)
        Assert.exists(target, 'target not found for member: ' + mbr.idx)

        t.equal(mbr.bind_hash, target.bind_hash, 'member bind hash matches target')
        t.equal(mbr.hidden_sn, target.hidden_sn, 'member hidden secnonce matches target')
        t.equal(mbr.binder_sn, target.binder_sn, 'member binder secnonce matches target')

        t.equal(commit.bind_hash, target.bind_hash, 'commit bind hash matches target')
        t.equal(commit.hidden_pn, target.hidden_pn, 'commit hidden pubnonce matches target') 
        t.equal(commit.binder_pn, target.binder_pn, 'commit binder pubnonce matches target')

        const derived_hidden_pn = get_pubkey(mbr.hidden_sn, 'ecdsa')
        const derived_binder_pn = get_pubkey(mbr.binder_sn, 'ecdsa')

        t.equal(derived_hidden_pn, target.hidden_pn, 'derived hidden pubnonce matches target')
        t.equal(derived_binder_pn, target.binder_pn, 'derived binder pubnonce matches target')
      } catch (err) {
        t.fail(parse_error(err))
      }
    }
    t.end()
  })
}

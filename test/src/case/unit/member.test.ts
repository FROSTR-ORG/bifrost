import { Assert, parse_error }   from '@frostr/bifrost/util'
import { parse_session_vector }  from '@/test/lib/parse.js'

import {
  create_session_shares,
  get_sighash_commit,
  get_sighash_share
} from '@/test/lib/util.js'

import { create_session_commits } from '@frostr/bifrost/lib'
import { get_pubkey }             from '@/util/crypto.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/session.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  tape.test('test session memberships', t => {
    const { group, session, shares, sig_commits, sig_shares } = parse_session_vector(VECTOR)

    const gen_commits = create_session_commits(group, session)
    const gen_shares  = create_session_shares(session, shares)

    for (const target of sig_commits) {
      try {
        const commit = get_sighash_commit(gen_commits, target.idx, target.sighash)
        Assert.exists(commit, 'sighash commit not found for member: ' + target.idx)

        const share = get_sighash_share(gen_shares, target.idx, target.sighash)
        Assert.exists(share, 'sighash share not found for member: ' + target.idx)

        Assert.equal(commit.idx, target.idx,             'member index does not match target')
        Assert.equal(commit.sid, target.sid,             'member session id does not match target')
        Assert.equal(commit.bind_hash, target.bind_hash, 'member bind hash does not match target')
        Assert.equal(commit.hidden_pn, target.hidden_pn, 'member hidden pubnonce does not match target')
        Assert.equal(commit.binder_pn, target.binder_pn, 'member binder pubnonce does not match target')

        const derived_hidden_pn = get_pubkey(share.hidden_sn, 'ecdsa')
        const derived_binder_pn = get_pubkey(share.binder_sn, 'ecdsa')

        Assert.equal(derived_hidden_pn, target.hidden_pn, 'derived hidden pubnonce does not match target')
        Assert.equal(derived_binder_pn, target.binder_pn, 'derived binder pubnonce does not match target')

      } catch (err) {
        t.fail(parse_error(err))
      }
    }

    t.pass('all sighash commits match their targets')

    for (const target of sig_shares) {
      try {
        const share = get_sighash_share(gen_shares, target.idx, target.sighash)
        Assert.exists(share, 'sighash share not found for member: ' + target.idx)

        Assert.equal(share.idx, target.idx,             'member index does not match target')
        Assert.equal(share.sid, target.sid,             'member session id does not match target')
        Assert.equal(share.bind_hash, target.bind_hash, 'member bind hash does not match target')
        Assert.equal(share.hidden_sn, target.hidden_sn, 'member hidden secnonce does not match target')
        Assert.equal(share.binder_sn, target.binder_sn, 'member binder secnonce does not match target')

      } catch (err) {
        t.fail(parse_error(err))
      }
    }

    t.pass('all sighash shares match their targets')

    t.end()
  })
}

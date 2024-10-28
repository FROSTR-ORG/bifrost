import { Buff }    from '@cmdcode/buff'
import { schnorr } from '@noble/curves/secp256k1'

import {
  combine_partial_sigs,
  get_group_signing_ctx,
  verify_partial_sig
} from '@cmdcode/frost/lib'

import { create_share_psig }  from '@/lib/sign.js'
import { parse_error }        from '@/util/index.js'
import { parse_group_vector } from '@/test/lib/parse.js'

import { normalize_pubkey } from '@/lib/crypto.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }
import { generate_dealer_pkg } from '@/lib/pkg.js'

export default function (tape : Test) {

  tape.test('group signature test (vector)', t => {
    const { group, shares } = parse_group_vector(VECTOR)

    const commits  = [ group.commits[0], group.commits[2] ]
    const group_pk = normalize_pubkey(group.group_pk, 'bip340')
    const message  = Buff.str('test message').digest.hex

    try {
      const ctx   = get_group_signing_ctx(group.group_pk, commits, message)
      const psigs = commits.map(commit => {
        const share = shares.find(share => share.idx === commit.idx)
        if (!share) throw new Error('share not found')
        const psig  = create_share_psig(ctx, share)
        const valid = verify_partial_sig(ctx, commit, psig.pubkey, psig.psig)
        if (!valid) throw new Error('partial signature invalid for idx: ' + share.idx)
        return psig
      })
      const group_sig = combine_partial_sigs(ctx, psigs)
      const is_valid  = schnorr.verify(group_sig, message, group_pk)
      t.ok(is_valid, 'signature is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })

  tape.test('group signature test (random)', t => {
    const { group, shares } = generate_dealer_pkg(2, 3)

    const commits  = [ group.commits[0], group.commits[2] ]
    const group_pk = normalize_pubkey(group.group_pk, 'bip340')
    const message  = Buff.str('test message').digest.hex
    
    try {
      const ctx   = get_group_signing_ctx(group.group_pk, commits, message)
      const psigs = commits.map(commit => {
        const share = shares.find(share => share.idx === commit.idx)
        if (!share) throw new Error('share not found')
        const psig  = create_share_psig(ctx, share)
        const valid = verify_partial_sig(ctx, commit, psig.pubkey, psig.psig)
        if (!valid) throw new Error('partial signature invalid for idx: ' + share.idx)
        return psig
      })
      const group_sig = combine_partial_sigs(ctx, psigs)
      const is_valid  = schnorr.verify(group_sig, message, group_pk)
      t.ok(is_valid, 'signature is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

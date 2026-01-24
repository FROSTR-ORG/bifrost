import { Buff }        from '@vbyte/buff'
import { schnorr }     from '@noble/curves/secp256k1.js'
import { hash_string } from '@/test/lib/hash.js'

import {
  combine_partial_sigs,
  get_group_signing_ctx,
  verify_partial_sig
} from '@vbyte/frost/lib'

import { generate_dealer_package }   from '@/lib/package.js'
import { create_partial_sig }    from '@/lib/sign.js'
import { generate_nonce_pair, derive_secret_nonce, to_member_nonce } from '@/lib/nonce.js'
import { parse_error }           from '@/util/index.js'

import { convert_pubkey, get_pubkey } from '@/util/crypto.js'

import type { Test } from 'tape'

/**
 * Create commit data for FROST signing context.
 * This mimics what the session context does but at the low level.
 */
function create_commit_for_signing (
  member  : { idx: number, pubkey: string },
  nonce   : { binder_pn: string, hidden_pn: string }
) {
  return {
    idx       : member.idx,
    pubkey    : member.pubkey,
    binder_pn : nonce.binder_pn,
    hidden_pn : nonce.hidden_pn
  }
}

export default function (tape : Test) {

  tape.test('group signature test (random)', t => {
    const { group, shares } = generate_dealer_package(2, 3)

    const members  = [ group.members[0], group.members[2] ]
    const group_pk = convert_pubkey(group.group_pk, 'bip340')
    const message  = hash_string('test message')

    try {
      // Generate nonces for each signing member
      const nonces = members.map(member => {
        const share = shares.find(s => s.idx === member.idx)
        if (!share) throw new Error('share not found for member: ' + member.idx)
        // Generate nonce with code (no idx parameter anymore)
        const nonce = generate_nonce_pair(share.seckey)
        // Derive secret from code (no idx parameter anymore)
        const secret = derive_secret_nonce(share.seckey, nonce.code)
        // Convert to MemberPublicNonce for context creation
        const member_nonce = to_member_nonce(nonce, member.idx)
        return { member, secret, public: member_nonce }
      })

      // Create commits for the FROST context
      const commits = nonces.map(n => create_commit_for_signing(n.member, n.public))

      // Get the FROST signing context
      const ctx = get_group_signing_ctx(group.group_pk, commits, message)

      // Create partial signatures
      const psigs = nonces.map(n => {
        const share = shares.find(s => s.idx === n.member.idx)
        if (!share) throw new Error('share not found')
        const pubkey = get_pubkey(share.seckey, 'ecdsa')
        const commit = commits.find(c => c.idx === n.member.idx)
        if (!commit) throw new Error('commit not found')

        // Use the low-level create_partial_sig with nonce
        const psig = create_partial_sig(ctx, share, n.secret)
        const valid = verify_partial_sig(ctx, commit, pubkey, psig)
        if (!valid) throw new Error('partial signature invalid for idx: ' + share.idx)
        return { idx : n.member.idx, pubkey, psig }
      })

      const group_sig = combine_partial_sigs(ctx, psigs)
      const is_valid  = schnorr.verify(Buff.hex(group_sig), Buff.hex(message), Buff.hex(group_pk))
      t.ok(is_valid, 'signature is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

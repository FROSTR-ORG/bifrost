import { Buff }                 from '@cmdcode/buff'
import { schnorr }              from '@noble/curves/secp256k1'
import { parse_error, now }     from '@/util/index.js'
import { parse_session_vector } from '@/test/lib/parse.js'

import {
  get_event_id,
  verify_event
} from '@cmdcode/nostr-p2p/lib'

import {
  create_session_pkg,
  get_session_ctx
} from '@/lib/session.js'

import {
  combine_signature_pkgs,
  create_signature_pkg,
  generate_dealer_pkg,
  normalize_pubkey,
  verify_signature_pkg
} from '@frostr/bifrost/lib'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/session.vec.json' assert { type: 'json' }

export default function (tape : Test) {
  
  tape.test('signature test (vector)', t => {
    const { group, session, shares } = parse_session_vector(VECTOR)

    try {
      const ctx = get_session_ctx(group, session)
      const psigs = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_signature_pkg(ctx, share)
        const err   = verify_signature_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const group_sig = combine_signature_pkgs(ctx, psigs)
      const group_pk  = normalize_pubkey(group.group_pk, 'bip340')
      const is_valid  = schnorr.verify(group_sig, session.message, group_pk)
      t.true(is_valid, 'group signature is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })

  tape.test('signature test (random)', t => {

    const { group, shares } = generate_dealer_pkg(2, 3)

    const message = Buff.random(32).hex
    const members = [ 1, 3 ]
    const session = create_session_pkg(group, members, message)

    try {
      const ctx = get_session_ctx(group, session)
      const psigs = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_signature_pkg(ctx, share)
        const err   = verify_signature_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const group_sig = combine_signature_pkgs(ctx, psigs)
      const group_pk  = normalize_pubkey(group.group_pk, 'bip340')
      const is_valid  = schnorr.verify(group_sig, session.message, group_pk)
      t.true(is_valid, 'group signature is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })

  tape.test('signature test (event)', t => {
    const { group, shares } = parse_session_vector(VECTOR)

    const template = {
      content    : 'hello world',
      kind       : 1,
      tags       : [],
      pubkey     : normalize_pubkey(group.group_pk, 'bip340'),
      created_at : now()
    }

    const id = get_event_id(template)
    
    try {
      const session = create_session_pkg(group, [ 1, 3 ], id)
      const ctx     = get_session_ctx(group, session)
      const psigs   = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_signature_pkg(ctx, share)
        const err   = verify_signature_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const sig = combine_signature_pkgs(ctx, psigs)
      const err = verify_event({ ...template, id, sig})
      t.true(err === null, 'event is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

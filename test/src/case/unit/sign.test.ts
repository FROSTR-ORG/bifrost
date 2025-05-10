import { Buff }                 from '@cmdcode/buff'
import { schnorr }              from '@noble/curves/secp256k1'
import { parse_session_vector } from '@/test/lib/parse.js'
import { convert_pubkey }       from '@/util/crypto.js'

import {
  get_event_id,
  verify_event
} from '@cmdcode/nostr-p2p/lib'

import {
  create_session_pkg,
  create_session_template,
  get_session_ctx
} from '@/lib/session.js'

import {
  parse_error,
  now,
  Assert
} from '@/util/index.js'

import {
  combine_signature_pkgs,
  create_psig_pkg,
  generate_dealer_pkg,
  verify_psig_pkg
} from '@frostr/bifrost/lib'


import type { Test } from 'tape'

import VECTOR from '@/test/vector/session.vec.json' assert { type: 'json' }

export default function (tape: Test) {
  // TODO: Fix tweak application to signature aggregation.
  test_vector_signature(tape)
  test_random_signature(tape)
  test_event_signature(tape)
}

// Test with vector data
function test_vector_signature (tape: Test) {
  tape.test('signature test (vector)', t => {
    const { group, session, shares } = parse_session_vector(VECTOR)

    try {
      const ctx   = get_session_ctx(group, session)
      const psigs = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_psig_pkg(ctx, share)
        const err   = verify_psig_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const sig_entries = combine_signature_pkgs(ctx, psigs)
      const results     = sig_entries.map(e => {
        const [ sighash, pubkey, signature ] = e
        const group_pk = convert_pubkey(pubkey, 'bip340')
        return schnorr.verify(signature, sighash, group_pk)
      })
      t.true(results.every(e => e === true), 'all signatures are valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

// Test with random data
function test_random_signature (tape: Test) {
  tape.test('signature test (random)', t => {
    const { group, shares } = generate_dealer_pkg(2, 3)

    const messages = [ 
      [ Buff.random(32).hex, Buff.random(32).hex, Buff.random(32).hex ],
      [ Buff.random(32).hex, Buff.random(32).hex, Buff.random(32).hex ]
    ]

    const members  = [ 1, 3 ]
    const template = create_session_template(members, messages)
    Assert.exists(template, 'session template is not null')
    const session  = create_session_pkg(group, template)

    try {
      const ctx = get_session_ctx(group, session)
      const psigs = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_psig_pkg(ctx, share)
        const err   = verify_psig_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const sig_entries = combine_signature_pkgs(ctx, psigs)
      const results     = sig_entries.map(e => {
        const [ sighash, pubkey, signature ] = e
        const group_pk = convert_pubkey(pubkey, 'bip340')
        return schnorr.verify(signature, sighash, group_pk)
      })
      t.true(results.every(e => e === true), 'all signatures are valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

// Test with event data
function test_event_signature (tape: Test) {
  tape.test('signature test (event)', t => {
    const { group, shares } = parse_session_vector(VECTOR)

    const event_template = {
      content    : 'hello world',
      kind       : 1,
      tags       : [],
      pubkey     : convert_pubkey(group.group_pk, 'bip340'),
      created_at : now()
    }

    const event_id = get_event_id(event_template)
    
    try {
      const template = create_session_template([ 1, 3 ], event_id)
      Assert.exists(template, 'session template is not null')
      const session  = create_session_pkg(group, template)
      const ctx      = get_session_ctx(group, session)
      const psigs    = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const psig  = create_psig_pkg(ctx, share)
        const err   = verify_psig_pkg(ctx, psig)
        if (err !== null) {
          t.fail(err + ': ' + psig.idx)
        } else {
          t.pass('partial signature is valid for member: ' + psig.idx)
        }
        return psig
      })
      const pkgs = combine_signature_pkgs(ctx, psigs)
      const sig  = pkgs.at(0)?.at(2)
      Assert.exists(sig, 'signature is undefined')
      const err  = verify_event({ ...event_template, id: event_id, sig })
      t.true(err === null, 'event is valid')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

import { Buff }                 from '@vbyte/buff'
import { schnorr }              from '@noble/curves/secp256k1.js'
import { parse_group_vector }   from '@/test/lib/parse.js'
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
  generate_dealer_package,
  generate_nonce_pair,
  derive_secret_nonce,
  to_member_nonce,
  verify_psig_pkg
} from '@frostr/bifrost/lib'

import type { SecretNoncePair, MemberPublicNonce, SharePackage } from '@frostr/bifrost'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

/**
 * Generate nonces for signing members.
 * Returns a map of member index to their secret/public nonce pairs.
 */
function generate_member_nonces (
  shares  : SharePackage[],
  members : number[]
) : { secrets: Map<number, SecretNoncePair>, publics: MemberPublicNonce[] } {
  const secrets = new Map<number, SecretNoncePair>()
  const publics : MemberPublicNonce[] = []

  for (const idx of members) {
    const share = shares.find(e => e.idx === idx)
    Assert.exists(share, 'share not found for member: ' + idx)
    // Generate nonce with code (no idx parameter)
    const nonce = generate_nonce_pair(share.seckey)
    // Derive the secret from the code (no idx parameter)
    const secret = derive_secret_nonce(share.seckey, nonce.code)
    secrets.set(idx, secret)
    // Convert to MemberPublicNonce with idx for signing
    publics.push(to_member_nonce(nonce, idx))
  }

  return { secrets, publics }
}

export default function (tape: Test) {
  test_random_signature(tape)
  test_event_signature(tape)
}

// Test with random data
function test_random_signature (tape: Test) {
  tape.test('signature test (random)', t => {
    const { group, shares } = generate_dealer_package(2, 3)

    const messages = [
      [ Buff.random(32).hex, Buff.random(32).hex, Buff.random(32).hex ],
      [ Buff.random(32).hex, Buff.random(32).hex, Buff.random(32).hex ]
    ]

    const members  = [ 1, 3 ]
    const template = create_session_template(members, messages)
    Assert.exists(template, 'session template is not null')

    // Generate nonces for signing
    const { secrets, publics } = generate_member_nonces(shares, members)

    // Create session with unified nonces array
    const base_session = create_session_pkg(group, template)
    const session = { ...base_session, nonces: publics }

    try {
      const ctx = get_session_ctx(group, session)
      const psigs = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const secret_nonce = secrets.get(idx)!
        const psig  = create_psig_pkg(ctx, share, secret_nonce)
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
        return schnorr.verify(Buff.hex(signature), Buff.hex(sighash), Buff.hex(group_pk))
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
    const { group, shares } = parse_group_vector(VECTOR)

    const event_template = {
      content    : 'hello world',
      kind       : 1,
      tags       : [],
      pubkey     : convert_pubkey(group.group_pk, 'bip340'),
      created_at : now()
    }

    const event_id = get_event_id(event_template)
    const members  = [ 1, 3 ]

    try {
      const template = create_session_template(members, event_id)
      Assert.exists(template, 'session template is not null')

      // Generate nonces for signing
      const { secrets, publics } = generate_member_nonces(shares, members)

      // Create session with unified nonces array
      const base_session = create_session_pkg(group, template)
      const session = { ...base_session, nonces: publics }

      const ctx      = get_session_ctx(group, session)
      const psigs    = session.members.map(idx => {
        const share = shares.find(e => e.idx === idx)!
        const secret_nonce = secrets.get(idx)!
        const psig  = create_psig_pkg(ctx, share, secret_nonce)
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

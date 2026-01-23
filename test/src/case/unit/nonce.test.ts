/**
 * Nonce Derivation Tests
 *
 * Tests for the HMAC-based nonce derivation system that allows
 * stateless secret recovery from derivation codes.
 */

import { Buff }          from '@cmdcode/buff'
import { parse_error }   from '@/util/index.js'
import { get_pubkey }    from '@/util/crypto.js'

import {
  generate_nonce_pair,
  generate_nonce_pairs,
  derive_secret_nonce,
  derive_nonce_secret,
  verify_nonce_code,
  get_public_nonce,
  to_member_nonce
} from '@/lib/nonce.js'

import type { Test } from 'tape'

export default function (tape : Test) {

  tape.test('Nonce: generate_nonce_pair creates valid nonce', t => {
    try {
      const share_secret = Buff.random(32).hex

      const nonce = generate_nonce_pair(share_secret)

      // Verify structure (no id, no idx in DerivedPublicNonce)
      t.ok(nonce.binder_pn.length === 66, 'binder_pn is 33-byte compressed point')
      t.ok(nonce.hidden_pn.length === 66, 'hidden_pn is 33-byte compressed point')
      t.ok(nonce.code.length === 64, 'code is 32-byte hex')

      // Verify prefix bytes (02 or 03 for compressed points)
      t.ok(['02', '03'].includes(nonce.binder_pn.slice(0, 2)), 'binder_pn has valid prefix')
      t.ok(['02', '03'].includes(nonce.hidden_pn.slice(0, 2)), 'hidden_pn has valid prefix')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: derive_secret_nonce reproduces same secret', t => {
    try {
      const share_secret = Buff.random(32).hex

      // Generate a nonce pair
      const nonce = generate_nonce_pair(share_secret)

      // Re-derive the secret from the code
      const derived = derive_secret_nonce(share_secret, nonce.code)

      // Verify the derived secret produces the same public nonces
      const derived_binder_pn = get_pubkey(derived.binder_sn, 'ecdsa')
      const derived_hidden_pn = get_pubkey(derived.hidden_sn, 'ecdsa')

      t.equal(derived.code, nonce.code, 'derived nonce code matches original')
      t.equal(derived_binder_pn, nonce.binder_pn, 'derived binder_pn matches original')
      t.equal(derived_hidden_pn, nonce.hidden_pn, 'derived hidden_pn matches original')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: derive_nonce_secret is deterministic', t => {
    try {
      const share_secret = Buff.random(32).hex
      const code = Buff.random(32).hex
      const domain = 'test/domain'

      // Derive multiple times
      const secret1 = derive_nonce_secret(share_secret, code, domain)
      const secret2 = derive_nonce_secret(share_secret, code, domain)
      const secret3 = derive_nonce_secret(share_secret, code, domain)

      t.equal(secret1, secret2, 'same inputs produce same secret (1-2)')
      t.equal(secret2, secret3, 'same inputs produce same secret (2-3)')

      // Different code produces different secret
      const other_code = Buff.random(32).hex
      const secret4 = derive_nonce_secret(share_secret, other_code, domain)
      t.notEqual(secret1, secret4, 'different code produces different secret')

      // Different domain produces different secret
      const secret5 = derive_nonce_secret(share_secret, code, 'other/domain')
      t.notEqual(secret1, secret5, 'different domain produces different secret')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: verify_nonce_code validates authentic codes', t => {
    try {
      const share_secret = Buff.random(32).hex
      const idx = 1

      const nonce = generate_nonce_pair(share_secret)
      // Convert to MemberPublicNonce for verification
      const member_nonce = to_member_nonce(nonce, idx)

      // Valid code should verify
      const is_valid = verify_nonce_code(share_secret, member_nonce)
      t.ok(is_valid, 'valid code is verified')

      // Wrong code should fail
      const fake_nonce = { ...member_nonce, code: Buff.random(32).hex }
      const is_fake_valid = verify_nonce_code(share_secret, fake_nonce)
      t.notOk(is_fake_valid, 'wrong code fails verification')

      // Wrong share_secret should fail
      const wrong_secret = Buff.random(32).hex
      const is_wrong_secret = verify_nonce_code(wrong_secret, member_nonce)
      t.notOk(is_wrong_secret, 'wrong share_secret fails verification')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: generate_nonce_pairs creates multiple unique nonces', t => {
    try {
      const share_secret = Buff.random(32).hex
      const count = 10

      const nonces = generate_nonce_pairs(share_secret, count)

      t.equal(nonces.length, count, `generated ${count} nonces`)

      // All codes should be unique
      const codes = new Set(nonces.map(n => n.code))
      t.equal(codes.size, count, 'all nonce codes are unique')

      // All public points should be unique
      const binder_pns = new Set(nonces.map(n => n.binder_pn))
      t.equal(binder_pns.size, count, 'all binder_pn values are unique')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: to_member_nonce adds idx to nonce', t => {
    try {
      const share_secret = Buff.random(32).hex
      const idx = 2

      const nonce = generate_nonce_pair(share_secret)
      const member_nonce = to_member_nonce(nonce, idx)

      t.equal(member_nonce.idx, idx, 'idx is correct')
      t.equal(member_nonce.binder_pn, nonce.binder_pn, 'binder_pn preserved')
      t.equal(member_nonce.hidden_pn, nonce.hidden_pn, 'hidden_pn preserved')
      t.equal(member_nonce.code, nonce.code, 'code preserved')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: get_public_nonce extracts public from secret', t => {
    try {
      const share_secret = Buff.random(32).hex

      const nonce = generate_nonce_pair(share_secret)
      const secret = derive_secret_nonce(share_secret, nonce.code)
      const public_nonce = get_public_nonce(secret)

      t.equal(public_nonce.binder_pn, nonce.binder_pn, 'binder_pn matches')
      t.equal(public_nonce.hidden_pn, nonce.hidden_pn, 'hidden_pn matches')
      t.equal(public_nonce.code, nonce.code, 'code matches')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })

  tape.test('Nonce: round-trip code derivation', t => {
    try {
      const share_secret = Buff.random(32).hex
      const idx = 1

      // Step 1: Generator creates nonce with code
      const original = generate_nonce_pair(share_secret)

      // Step 2: Peer receives nonce (with code)
      const received = { ...original }

      // Step 3: During signing, peer sends back the nonce (with code and idx)
      const sent_back = to_member_nonce(received, idx)

      // Step 4: Generator re-derives secret from code
      const derived = derive_secret_nonce(share_secret, sent_back.code)

      // Step 5: Verify derived secret matches what we would have had
      const derived_binder_pn = get_pubkey(derived.binder_sn, 'ecdsa')
      const derived_hidden_pn = get_pubkey(derived.hidden_sn, 'ecdsa')

      t.equal(derived.code, sent_back.code, 'round-trip: code matches')
      t.equal(derived_binder_pn, original.binder_pn, 'round-trip: binder_pn matches')
      t.equal(derived_hidden_pn, original.hidden_pn, 'round-trip: hidden_pn matches')

    } catch (err) {
      t.fail(parse_error(err))
    }
    t.end()
  })
}

import { BifrostSigner }       from '@/class/signer.js'
import { parse_group_vector }  from '@/test/lib/parse.js'
import { parse_error }         from '@frostr/bifrost/util'
import { schnorr }             from '@noble/curves/secp256k1'
import { Buff }                from '@cmdcode/buff'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {
  tape.test('BifrostSigner tests', t => {
    try {
      const vec    = parse_group_vector(VECTOR)
      const group  = vec.group
      const share  = vec.shares[0]
      const signer = new BifrostSigner(group, share)

      // Test constructor and getters
      t.test('constructor and getters', st => {
        st.ok(signer.group !== undefined, 'group getter returns value')
        st.equal(signer.group.threshold, group.threshold, 'group threshold matches')
        st.equal(signer.group.group_pk, group.group_pk, 'group public key matches')
        st.ok(signer.pubkey !== undefined, 'pubkey getter returns value')
        st.equal(typeof signer.pubkey, 'string', 'pubkey is a string')
        st.equal(signer.pubkey.length, 64, 'pubkey is 32 bytes hex')
        st.ok(signer.config !== undefined, 'config getter returns value')
        st.end()
      })

      // Test sign_message
      t.test('sign_message() creates valid signature', st => {
        const message = Buff.str('test message').digest.hex
        const sig = signer.sign_message(message)

        st.equal(typeof sig, 'string', 'signature is a string')
        st.equal(sig.length, 128, 'signature is 64 bytes hex')

        // Verify signature with the signer's pubkey
        const isValid = schnorr.verify(sig, message, signer.pubkey)
        st.ok(isValid, 'signature is valid for signer pubkey')
        st.end()
      })

      // Test sign_message with auxrand
      t.test('sign_message() with auxrand produces different signatures', st => {
        const message = Buff.str('deterministic test').digest.hex
        const auxrand1 = Buff.str('random1').digest
        const auxrand2 = Buff.str('random2').digest

        const sig1 = signer.sign_message(message, auxrand1)
        const sig2 = signer.sign_message(message, auxrand2)

        st.notEqual(sig1, sig2, 'different auxrand produces different signatures')

        // Both signatures should still be valid
        st.ok(schnorr.verify(sig1, message, signer.pubkey), 'sig1 is valid')
        st.ok(schnorr.verify(sig2, message, signer.pubkey), 'sig2 is valid')
        st.end()
      })

      // Test gen_ecdh_share
      t.test('gen_ecdh_share() creates ECDH package', st => {
        const members = [ 1, 2, 3 ]
        const ecdh_pk = '02' + 'a'.repeat(64)  // valid compressed public key

        const pkg = signer.gen_ecdh_share(members, ecdh_pk)

        st.ok(pkg !== undefined, 'returns ECDH package')
        st.equal(pkg.idx, share.idx, 'package idx matches share idx')
        st.deepEqual(pkg.members, members, 'members array matches')
        st.ok(Array.isArray(pkg.entries), 'entries is an array')
        st.equal(pkg.entries.length, 1, 'entries has one element')
        st.equal(pkg.entries[0].ecdh_pk, ecdh_pk, 'entry ecdh_pk matches')
        st.ok(pkg.entries[0].keyshare !== undefined, 'entry keyshare is present')
        st.equal(typeof pkg.entries[0].keyshare, 'string', 'keyshare is a string')
        st.end()
      })

      // Test gen_batched_ecdh_shares
      t.test('gen_batched_ecdh_shares() creates batched ECDH package', st => {
        const members = [ 1, 2, 3 ]
        // Use real valid public keys from group members
        const ecdh_pks = vec.group.members.slice(0, 3).map(m => m.pubkey)

        const pkg = signer.gen_batched_ecdh_shares(members, ecdh_pks)

        st.ok(pkg !== undefined, 'returns ECDH package')
        st.equal(pkg.idx, share.idx, 'package idx matches share idx')
        st.deepEqual(pkg.members, members, 'members array matches')
        st.ok(Array.isArray(pkg.entries), 'entries is an array')
        st.equal(pkg.entries.length, 3, 'entries has three elements')

        for (let i = 0; i < 3; i++) {
          st.equal(pkg.entries[i].ecdh_pk, ecdh_pks[i], `entry ${i} ecdh_pk matches`)
          st.ok(pkg.entries[i].keyshare !== undefined, `entry ${i} keyshare is present`)
        }
        st.end()
      })

      // Test wrap and unwrap (encryption/decryption roundtrip)
      t.test('wrap() and unwrap() roundtrip', st => {
        // Use signer's own pubkey for a self-encryption test
        const content = 'secret message to encrypt'
        const pubkey = signer.pubkey

        const encrypted = signer.wrap(content, pubkey)
        st.notEqual(encrypted, content, 'encrypted content differs from original')

        const decrypted = signer.unwrap(encrypted, pubkey)
        st.equal(decrypted, content, 'decrypted content matches original')
        st.end()
      })

      // Test wrap with different pubkeys produces different ciphertext
      t.test('wrap() with different recipients', st => {
        const content = 'test content'
        const pubkey1 = signer.pubkey
        // Use second signer's pubkey
        const signer2 = new BifrostSigner(group, vec.shares[1])
        const pubkey2 = signer2.pubkey

        const encrypted1 = signer.wrap(content, pubkey1)
        const encrypted2 = signer.wrap(content, pubkey2)

        st.notEqual(encrypted1, encrypted2, 'different recipients produce different ciphertext')
        st.end()
      })

      // Test multiple signers have different pubkeys
      t.test('different shares produce different signers', st => {
        const signer1 = new BifrostSigner(group, vec.shares[0])
        const signer2 = new BifrostSigner(group, vec.shares[1])
        const signer3 = new BifrostSigner(group, vec.shares[2])

        st.notEqual(signer1.pubkey, signer2.pubkey, 'signer1 and signer2 have different pubkeys')
        st.notEqual(signer2.pubkey, signer3.pubkey, 'signer2 and signer3 have different pubkeys')
        st.notEqual(signer1.pubkey, signer3.pubkey, 'signer1 and signer3 have different pubkeys')

        // All signers should have the same group
        st.equal(signer1.group.group_pk, signer2.group.group_pk, 'all signers share the same group')
        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

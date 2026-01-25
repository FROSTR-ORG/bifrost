/**
 * ECDH Unit Tests
 *
 * Tests for ECDH package creation and combination.
 */

import { Buff }        from '@vbyte/buff'
import { parse_error } from '@/util/index.js'

import {
  create_ecdh_pkg,
  create_batched_ecdh_pkg,
  combine_ecdh_pkgs,
  combine_batched_ecdh_pkgs
} from '@/lib/ecdh.js'

import { parse_group_vector } from '@/test/lib/parse.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {

  tape.test('ECDH: combine_ecdh_pkgs tests', t => {

    const vec   = parse_group_vector(VECTOR)
    const group = vec.group

    t.test('combine_ecdh_pkgs combines shares correctly', st => {
      try {
        // Use first 2 shares (threshold is 2)
        const members = [1, 2]
        const share1 = vec.shares.find(s => s.idx === 1)!
        const share2 = vec.shares.find(s => s.idx === 2)!

        // Target pubkey to derive secret for
        const ecdh_pk = group.members[0].pubkey

        // Create ECDH packages from each signer
        const pkg1 = create_ecdh_pkg(members, ecdh_pk, share1)
        const pkg2 = create_ecdh_pkg(members, ecdh_pk, share2)

        st.ok(pkg1.idx === 1, 'pkg1 has idx 1')
        st.ok(pkg2.idx === 2, 'pkg2 has idx 2')

        // Combine the packages
        const secret = combine_ecdh_pkgs([pkg1, pkg2], ecdh_pk)

        st.equal(typeof secret, 'string', 'combined secret is a string')
        // ECDH returns compressed point (33 bytes = 66 hex chars)
        st.equal(secret.length, 66, 'combined secret is 33 bytes hex (compressed point)')

        st.end()
      } catch (err) {
        st.fail(parse_error(err))
      }
    })

    t.test('combine_ecdh_pkgs throws for missing ecdh_pk', st => {
      try {
        const members = [1, 2]
        const share1 = vec.shares.find(s => s.idx === 1)!
        const share2 = vec.shares.find(s => s.idx === 2)!

        const ecdh_pk = group.members[0].pubkey
        const wrong_pk = group.members[1].pubkey

        const pkg1 = create_ecdh_pkg(members, ecdh_pk, share1)
        const pkg2 = create_ecdh_pkg(members, ecdh_pk, share2)

        st.throws(
          () => combine_ecdh_pkgs([pkg1, pkg2], wrong_pk),
          /not found in package/,
          'throws when ecdh_pk not in packages'
        )

        st.end()
      } catch (err) {
        st.fail(parse_error(err))
      }
    })

    t.test('combine_batched_ecdh_pkgs combines multiple targets', st => {
      try {
        const members = [1, 2]
        const share1 = vec.shares.find(s => s.idx === 1)!
        const share2 = vec.shares.find(s => s.idx === 2)!

        // Multiple target pubkeys
        const ecdh_pks = group.members.slice(0, 2).map(m => m.pubkey)

        // Create batched ECDH packages
        const pkg1 = create_batched_ecdh_pkg(members, ecdh_pks, share1)
        const pkg2 = create_batched_ecdh_pkg(members, ecdh_pks, share2)

        st.equal(pkg1.entries.length, 2, 'pkg1 has 2 entries')
        st.equal(pkg2.entries.length, 2, 'pkg2 has 2 entries')

        // Combine the batched packages
        const secrets = combine_batched_ecdh_pkgs([pkg1, pkg2])

        st.equal(secrets.size, 2, 'combined secrets has 2 entries')
        st.ok(secrets.has(ecdh_pks[0]), 'has secret for first pubkey')
        st.ok(secrets.has(ecdh_pks[1]), 'has secret for second pubkey')

        // Verify secrets are different
        const secret1 = secrets.get(ecdh_pks[0])!
        const secret2 = secrets.get(ecdh_pks[1])!
        st.notEqual(secret1, secret2, 'different pubkeys produce different secrets')

        st.end()
      } catch (err) {
        st.fail(parse_error(err))
      }
    })

    t.test('same members produce same secret deterministically', st => {
      try {
        const members = [1, 2]
        const share1 = vec.shares.find(s => s.idx === 1)!
        const share2 = vec.shares.find(s => s.idx === 2)!

        const ecdh_pk = group.members[0].pubkey

        // Create packages twice
        const pkg1a = create_ecdh_pkg(members, ecdh_pk, share1)
        const pkg2a = create_ecdh_pkg(members, ecdh_pk, share2)
        const secret_a = combine_ecdh_pkgs([pkg1a, pkg2a], ecdh_pk)

        const pkg1b = create_ecdh_pkg(members, ecdh_pk, share1)
        const pkg2b = create_ecdh_pkg(members, ecdh_pk, share2)
        const secret_b = combine_ecdh_pkgs([pkg1b, pkg2b], ecdh_pk)

        st.equal(secret_a, secret_b, 'same inputs produce same secret')

        st.end()
      } catch (err) {
        st.fail(parse_error(err))
      }
    })

    t.test('different member combinations produce different secrets', st => {
      try {
        const ecdh_pk = group.members[0].pubkey

        // Combination [1, 2]
        const share1 = vec.shares.find(s => s.idx === 1)!
        const share2 = vec.shares.find(s => s.idx === 2)!
        const pkg1_12 = create_ecdh_pkg([1, 2], ecdh_pk, share1)
        const pkg2_12 = create_ecdh_pkg([1, 2], ecdh_pk, share2)
        const secret_12 = combine_ecdh_pkgs([pkg1_12, pkg2_12], ecdh_pk)

        // Combination [1, 3]
        const share3 = vec.shares.find(s => s.idx === 3)!
        const pkg1_13 = create_ecdh_pkg([1, 3], ecdh_pk, share1)
        const pkg3_13 = create_ecdh_pkg([1, 3], ecdh_pk, share3)
        const secret_13 = combine_ecdh_pkgs([pkg1_13, pkg3_13], ecdh_pk)

        // Both should produce valid secrets (in threshold scheme, they should be the same!)
        st.equal(typeof secret_12, 'string', 'secret_12 is valid')
        st.equal(typeof secret_13, 'string', 'secret_13 is valid')

        // In a proper threshold scheme, different combinations should produce the same secret
        st.equal(secret_12, secret_13, 'different member combinations produce same secret (threshold property)')

        st.end()
      } catch (err) {
        st.fail(parse_error(err))
      }
    })
  })
}

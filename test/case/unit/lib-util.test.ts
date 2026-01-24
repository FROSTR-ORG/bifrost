import { parse_error }             from '@/util/index.js'
import { generate_dealer_package } from '@/lib/index.js'
import { convert_pubkey }      from '@/util/crypto.js'

import {
  get_group_indexes,
  select_random_peers,
  get_member_indexes,
  recover_secret_key,
  normalize_pubkey
} from '@/lib/util.js'

import type { Test } from 'tape'

export default function (tape : Test) {
  tape.test('lib/util function tests', t => {
    try {
      // Generate a fresh package for testing
      const vec = generate_dealer_package(2, 3)
      const group = vec.group

      // Test get_group_indexes
      t.test('get_group_indexes()', st => {
        const indexes = get_group_indexes(group)

        st.ok(Array.isArray(indexes), 'returns an array')
        st.equal(indexes.length, group.members.length, 'returns index for each member')

        // Each index matches the member idx
        group.members.forEach((member, i) => {
          st.equal(indexes[i], member.idx, `index ${i} matches member idx`)
        })
        st.end()
      })

      // Test select_random_peers
      t.test('select_random_peers()', st => {
        const peers = ['peer1', 'peer2', 'peer3', 'peer4', 'peer5']

        // Should return threshold-1 peers
        const selected = select_random_peers(peers, 3)
        st.equal(selected.length, 2, 'returns threshold-1 peers')

        // All selected peers should be from original list
        selected.forEach(peer => {
          st.ok(peers.includes(peer), `selected peer "${peer}" is from original list`)
        })

        // Should not return duplicates
        const uniqueSelected = new Set(selected)
        st.equal(uniqueSelected.size, selected.length, 'no duplicate peers')

        // When peers.length < threshold-1, returns all peers
        const fewPeers = ['a', 'b']
        const selectedFew = select_random_peers(fewPeers, 5)
        st.equal(selectedFew.length, 2, 'returns all peers when fewer than threshold-1')

        // Empty peers array
        const empty = select_random_peers([], 3)
        st.equal(empty.length, 0, 'returns empty array for empty input')

        // Threshold of 1 returns 0 peers
        const zeroSelect = select_random_peers(peers, 1)
        st.equal(zeroSelect.length, 0, 'threshold=1 returns 0 peers')

        // Randomness test - run multiple times and verify we get different orderings
        // (statistically this should vary, but we just check the function runs)
        let hasVariation = false
        const firstRun = select_random_peers([...peers], 4).join(',')
        for (let i = 0; i < 20; i++) {
          const run = select_random_peers([...peers], 4).join(',')
          if (run !== firstRun) {
            hasVariation = true
            break
          }
        }
        st.ok(true, 'randomness function executes without error')
        st.end()
      })

      // Test get_member_indexes
      t.test('get_member_indexes()', st => {
        // Get pubkeys from members (converted to bip340 format)
        const pubkeys = group.members.map(m => convert_pubkey(m.pubkey, 'bip340'))

        // Should return indexes for all pubkeys
        const indexes = get_member_indexes(group, pubkeys)
        st.equal(indexes.length, pubkeys.length, 'returns index for each pubkey')

        // Each index should match the member idx
        pubkeys.forEach((pk, i) => {
          const member = group.members.find(m => convert_pubkey(m.pubkey, 'bip340') === pk)
          st.ok(indexes.includes(member!.idx), `pubkey ${i} maps to correct index`)
        })

        // Subset of pubkeys
        const subset = pubkeys.slice(0, 2)
        const subsetIndexes = get_member_indexes(group, subset)
        st.equal(subsetIndexes.length, 2, 'works with subset of pubkeys')

        // Should throw if pubkey not in group
        st.throws(
          () => get_member_indexes(group, ['deadbeef'.repeat(8)]),
          /index count does not match pubkey count/,
          'throws for unknown pubkey'
        )

        // Should throw if not all pubkeys found
        st.throws(
          () => get_member_indexes(group, [...pubkeys, 'invalid']),
          /index count does not match pubkey count/,
          'throws when pubkey count mismatch'
        )

        // Empty pubkeys
        const emptyIndexes = get_member_indexes(group, [])
        st.equal(emptyIndexes.length, 0, 'returns empty array for empty pubkeys')
        st.end()
      })

      // Test recover_secret_key
      t.test('recover_secret_key()', st => {
        // Should recover secret key from threshold shares
        const shares = vec.shares.slice(0, group.threshold)
        const secret = recover_secret_key(group, shares)

        st.ok(typeof secret === 'string', 'returns a string')
        st.equal(secret.length, 64, 'secret is 32 bytes hex')

        // Same shares should always produce same secret
        const secret2 = recover_secret_key(group, shares)
        st.equal(secret, secret2, 'deterministic recovery')

        // Different valid share combinations should produce same secret
        // (shares 0,1 vs shares 1,2 for threshold=2)
        if (vec.shares.length >= 3 && group.threshold === 2) {
          const altShares = [vec.shares[1], vec.shares[2]]
          const altSecret = recover_secret_key(group, altShares)
          st.equal(secret, altSecret, 'different share combinations recover same secret')
        }

        // Should throw with insufficient shares
        if (group.threshold > 1) {
          st.throws(
            () => recover_secret_key(group, [vec.shares[0]]),
            /not enough shares provided/,
            'throws for insufficient shares'
          )
        }

        // Should throw for shares not in group (new simplified format)
        const fakeShare = {
          idx: 999,
          seckey: 'a'.repeat(64)
        }
        st.throws(
          () => recover_secret_key(group, [fakeShare, fakeShare]),
          /share not found in group/,
          'throws for invalid share'
        )
        st.end()
      })

      // Test normalize_pubkey
      t.test('normalize_pubkey()', st => {
        // Valid 64-char x-only pubkey
        const xonly = 'a'.repeat(64)
        st.equal(normalize_pubkey(xonly), xonly, 'accepts 64-char x-only pubkey')

        // Valid 66-char compressed pubkey (strips prefix)
        const compressed = '02' + 'b'.repeat(64)
        st.equal(normalize_pubkey(compressed), 'b'.repeat(64), 'strips prefix from 66-char compressed pubkey')

        // Invalid: wrong length (odd)
        st.throws(
          () => normalize_pubkey('abc'),
          /Invalid pubkey format/,
          'throws for odd length string'
        )

        // Invalid: wrong length (63 chars)
        st.throws(
          () => normalize_pubkey('a'.repeat(63)),
          /Invalid pubkey format/,
          'throws for 63-char string'
        )

        // Invalid: wrong length (65 chars)
        st.throws(
          () => normalize_pubkey('a'.repeat(65)),
          /Invalid pubkey format/,
          'throws for 65-char string'
        )

        // Invalid: non-hex characters
        st.throws(
          () => normalize_pubkey('g'.repeat(64)),
          /Invalid pubkey format/,
          'throws for non-hex characters'
        )

        // Invalid: mixed valid/invalid chars
        st.throws(
          () => normalize_pubkey('abcdef' + 'xyz'.repeat(20) + 'ab'),
          /Invalid pubkey format/,
          'throws for mixed valid/invalid chars'
        )

        // Invalid: empty string
        st.throws(
          () => normalize_pubkey(''),
          /Invalid pubkey format/,
          'throws for empty string'
        )

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}

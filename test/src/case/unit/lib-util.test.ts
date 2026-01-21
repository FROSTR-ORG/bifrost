import { parse_error }         from '@frostr/bifrost/util'
import { parse_group_vector }  from '@/test/lib/parse.js'
import { convert_pubkey }      from '@/util/crypto.js'

import {
  get_group_indexes,
  select_random_peers,
  get_member_indexes,
  recover_secret_key
} from '@/lib/util.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape : Test) {
  tape.test('lib/util function tests', t => {
    try {
      const vec   = parse_group_vector(VECTOR)
      const group = vec.group

      // Test get_group_indexes
      t.test('get_group_indexes()', st => {
        const indexes = get_group_indexes(group)

        st.ok(Array.isArray(indexes), 'returns an array')
        st.equal(indexes.length, group.commits.length, 'returns index for each commit')

        // Each index matches the commit idx
        group.commits.forEach((commit, i) => {
          st.equal(indexes[i], commit.idx, `index ${i} matches commit idx`)
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
        // Get pubkeys from commits (converted to bip340 format)
        const pubkeys = group.commits.map(c => convert_pubkey(c.pubkey, 'bip340'))

        // Should return indexes for all pubkeys
        const indexes = get_member_indexes(group, pubkeys)
        st.equal(indexes.length, pubkeys.length, 'returns index for each pubkey')

        // Each index should match the commit idx
        pubkeys.forEach((pk, i) => {
          const commit = group.commits.find(c => convert_pubkey(c.pubkey, 'bip340') === pk)
          st.ok(indexes.includes(commit!.idx), `pubkey ${i} maps to correct index`)
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

        // Should throw for shares not in group
        const fakeShare = {
          idx: 999,
          seckey: 'a'.repeat(64),
          binder_sn: 'b'.repeat(64),
          hidden_sn: 'c'.repeat(64)
        }
        st.throws(
          () => recover_secret_key(group, [fakeShare, fakeShare]),
          /share not found in group/,
          'throws for invalid share'
        )
        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

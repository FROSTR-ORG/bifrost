import { Buff }        from '@vbyte/buff'
import { parse_error } from '@/util/index.js'

import {
  get_peer_by_pubkey,
  get_peer_pubkeys,
  get_recv_pubkeys,
  get_send_pubkeys,
  get_expired_pubkeys,
  get_signable_pubkeys
} from '@/lib/peer.js'

import { NoncePool } from '@/class/pool.js'

import { now } from '@/util/helpers.js'
import { PEER_STATE_EXPIRY } from '@/const.js'

import type { Test }                        from 'tape'
import type { PeerData, GroupPackage }      from '@/types/index.js'

// Helper to create test peer data
function create_peer (
  pubkey  : string,
  send    : boolean = true,
  recv    : boolean = true,
  status  : 'online' | 'offline' = 'online',
  updated : number = now()
) : PeerData {
  return {
    pubkey,
    policy : { send, recv },
    status,
    updated
  }
}

export default function (tape : Test) {
  tape.test('peer function tests', t => {
    try {
      const peer1 = create_peer('pubkey1', true, true, 'online')
      const peer2 = create_peer('pubkey2', true, false, 'online')
      const peer3 = create_peer('pubkey3', false, true, 'offline')
      const peer4 = create_peer('pubkey4', false, false, 'online')
      const peers : PeerData[] = [ peer1, peer2, peer3, peer4 ]

      // Test get_peer_by_pubkey
      t.test('get_peer_by_pubkey()', st => {
        const found = get_peer_by_pubkey(peers, 'pubkey2')
        st.ok(found !== undefined, 'finds existing peer')
        st.equal(found?.pubkey, 'pubkey2', 'returns correct peer')

        const notFound = get_peer_by_pubkey(peers, 'nonexistent')
        st.equal(notFound, undefined, 'returns undefined for nonexistent peer')

        const empty = get_peer_by_pubkey([], 'pubkey1')
        st.equal(empty, undefined, 'returns undefined for empty array')
        st.end()
      })

      // Test get_peer_pubkeys
      t.test('get_peer_pubkeys()', st => {
        const pubkeys = get_peer_pubkeys(peers)
        st.equal(pubkeys.length, 4, 'returns all pubkeys')
        st.ok(pubkeys.includes('pubkey1'), 'includes pubkey1')
        st.ok(pubkeys.includes('pubkey2'), 'includes pubkey2')
        st.ok(pubkeys.includes('pubkey3'), 'includes pubkey3')
        st.ok(pubkeys.includes('pubkey4'), 'includes pubkey4')

        const emptyResult = get_peer_pubkeys([])
        st.equal(emptyResult.length, 0, 'returns empty array for empty input')
        st.end()
      })

      // Test get_recv_pubkeys
      t.test('get_recv_pubkeys()', st => {
        const recvPubkeys = get_recv_pubkeys(peers)
        st.equal(recvPubkeys.length, 2, 'returns only peers with recv=true')
        st.ok(recvPubkeys.includes('pubkey1'), 'includes peer with recv=true')
        st.ok(recvPubkeys.includes('pubkey3'), 'includes peer with recv=true')
        st.notOk(recvPubkeys.includes('pubkey2'), 'excludes peer with recv=false')
        st.notOk(recvPubkeys.includes('pubkey4'), 'excludes peer with recv=false')
        st.end()
      })

      // Test get_send_pubkeys
      t.test('get_send_pubkeys()', st => {
        const sendPubkeys = get_send_pubkeys(peers)
        st.equal(sendPubkeys.length, 2, 'returns only peers with send=true')
        st.ok(sendPubkeys.includes('pubkey1'), 'includes peer with send=true')
        st.ok(sendPubkeys.includes('pubkey2'), 'includes peer with send=true')
        st.notOk(sendPubkeys.includes('pubkey3'), 'excludes peer with send=false')
        st.notOk(sendPubkeys.includes('pubkey4'), 'excludes peer with send=false')
        st.end()
      })

      // Test get_expired_pubkeys
      t.test('get_expired_pubkeys()', st => {
        const current = now()
        const freshPeer   = create_peer('fresh', true, true, 'online', current)
        const offlinePeer = create_peer('offline', true, true, 'offline', current)
        const expiredPeer = create_peer('expired', true, true, 'online', current - PEER_STATE_EXPIRY - 1)
        const testPeers = [ freshPeer, offlinePeer, expiredPeer ]

        const expired = get_expired_pubkeys(testPeers)

        st.ok(expired.includes('offline'), 'includes offline peers')
        st.ok(expired.includes('expired'), 'includes peers with old timestamps')
        st.notOk(expired.includes('fresh'), 'excludes fresh online peers')
        st.end()
      })

      // Test edge cases
      t.test('edge cases', st => {
        // All peers with same policy
        const allSend = [
          create_peer('a', true, false),
          create_peer('b', true, false),
          create_peer('c', true, false)
        ]
        st.equal(get_send_pubkeys(allSend).length, 3, 'all peers returned when all have send=true')
        st.equal(get_recv_pubkeys(allSend).length, 0, 'no peers returned when all have recv=false')

        // Single peer
        const single = [ create_peer('single', true, true) ]
        st.equal(get_peer_pubkeys(single).length, 1, 'works with single peer')
        st.equal(get_peer_by_pubkey(single, 'single')?.pubkey, 'single', 'finds single peer')

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })

  tape.test('get_signable_pubkeys() tests', t => {
    // Create test keys - use 64-char hex pubkeys (x-only format)
    const pk1 = Buff.random(32).hex
    const pk2 = Buff.random(32).hex
    const pk3 = Buff.random(32).hex
    const our_pk = Buff.random(32).hex
    const our_seckey = Buff.random(32).hex

    // Create group package with members
    const group : GroupPackage = {
      group_pk  : Buff.random(32).hex,
      threshold : 2,
      members   : [
        { idx: 1, pubkey: pk1 },
        { idx: 2, pubkey: pk2 },
        { idx: 3, pubkey: pk3 },
        { idx: 4, pubkey: our_pk }
      ]
    }

    t.test('returns peers with send policy AND nonces available', st => {
      try {
        // Create pool with our index
        const pool = new NoncePool(4, our_seckey, { critical_threshold: 1 })
        pool.init_peers(group.members)

        // Store nonces from peer 1 and peer 2 (simulate receiving nonces)
        const nonces1 = pool.generate_for_peer(1, 5)
        const nonces2 = pool.generate_for_peer(2, 5)
        pool.store_incoming(1, nonces1)
        pool.store_incoming(2, nonces2)
        // Peer 3 has NO nonces

        // Create peers with send policy enabled
        const peers : PeerData[] = [
          create_peer(pk1, true, true),   // send=true, has nonces
          create_peer(pk2, true, true),   // send=true, has nonces
          create_peer(pk3, true, true)    // send=true, NO nonces
        ]

        const signable = get_signable_pubkeys(peers, pool, group)

        st.equal(signable.length, 2, 'returns only peers with nonces')
        st.ok(signable.includes(pk1), 'includes peer 1 (has nonces)')
        st.ok(signable.includes(pk2), 'includes peer 2 (has nonces)')
        st.notOk(signable.includes(pk3), 'excludes peer 3 (no nonces)')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('excludes peers without send policy regardless of nonces', st => {
      try {
        const pool = new NoncePool(4, our_seckey, { critical_threshold: 1 })
        pool.init_peers(group.members)

        // All peers have nonces
        const nonces1 = pool.generate_for_peer(1, 5)
        const nonces2 = pool.generate_for_peer(2, 5)
        const nonces3 = pool.generate_for_peer(3, 5)
        pool.store_incoming(1, nonces1)
        pool.store_incoming(2, nonces2)
        pool.store_incoming(3, nonces3)

        // But peer 3 has send=false
        const peers : PeerData[] = [
          create_peer(pk1, true, true),   // send=true
          create_peer(pk2, true, true),   // send=true
          create_peer(pk3, false, true)   // send=false
        ]

        const signable = get_signable_pubkeys(peers, pool, group)

        st.equal(signable.length, 2, 'returns only peers with send=true')
        st.ok(signable.includes(pk1), 'includes peer 1')
        st.ok(signable.includes(pk2), 'includes peer 2')
        st.notOk(signable.includes(pk3), 'excludes peer 3 (send=false)')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('returns empty array when no peers have nonces', st => {
      try {
        const pool = new NoncePool(4, our_seckey, { critical_threshold: 1 })
        pool.init_peers(group.members)
        // No nonces stored for any peer

        const peers : PeerData[] = [
          create_peer(pk1, true, true),
          create_peer(pk2, true, true),
          create_peer(pk3, true, true)
        ]

        const signable = get_signable_pubkeys(peers, pool, group)

        st.equal(signable.length, 0, 'returns empty array when no nonces')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('returns empty array when peers list is empty', st => {
      try {
        const pool = new NoncePool(4, our_seckey, { critical_threshold: 1 })
        pool.init_peers(group.members)

        const signable = get_signable_pubkeys([], pool, group)

        st.equal(signable.length, 0, 'returns empty for empty peers list')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('handles pubkey format with 02 prefix', st => {
      try {
        // Create group with prefixed pubkeys (33-byte compressed format)
        const prefixed_pk1 = '02' + pk1
        const prefixed_pk2 = '02' + pk2
        const group_with_prefix : GroupPackage = {
          group_pk  : Buff.random(32).hex,
          threshold : 2,
          members   : [
            { idx: 1, pubkey: prefixed_pk1 },
            { idx: 2, pubkey: prefixed_pk2 },
            { idx: 4, pubkey: '02' + our_pk }
          ]
        }

        const pool = new NoncePool(4, our_seckey, { critical_threshold: 1 })
        pool.init_peers(group_with_prefix.members)

        // Store nonces for peer 1
        const nonces1 = pool.generate_for_peer(1, 5)
        pool.store_incoming(1, nonces1)

        // Peers use x-only format (no prefix)
        const peers : PeerData[] = [
          create_peer(pk1, true, true),   // x-only, member has 02 prefix
          create_peer(pk2, true, true)    // x-only, member has 02 prefix (no nonces)
        ]

        const signable = get_signable_pubkeys(peers, pool, group_with_prefix)

        st.equal(signable.length, 1, 'matches x-only pubkey to prefixed member')
        st.ok(signable.includes(pk1), 'includes peer with matching pubkey and nonces')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })

    t.test('respects critical_threshold for can_sign', st => {
      try {
        // Pool with critical_threshold of 2
        const pool = new NoncePool(4, our_seckey, { critical_threshold: 2 })
        pool.init_peers(group.members)

        // Store only 2 nonces for peer 1 (at critical threshold, not above)
        const nonces1 = pool.generate_for_peer(1, 2)
        pool.store_incoming(1, nonces1)

        // Store 5 nonces for peer 2 (above critical threshold)
        const nonces2 = pool.generate_for_peer(2, 5)
        pool.store_incoming(2, nonces2)

        const peers : PeerData[] = [
          create_peer(pk1, true, true),
          create_peer(pk2, true, true)
        ]

        const signable = get_signable_pubkeys(peers, pool, group)

        st.equal(signable.length, 1, 'only includes peer above critical threshold')
        st.notOk(signable.includes(pk1), 'excludes peer at critical threshold')
        st.ok(signable.includes(pk2), 'includes peer above critical threshold')

      } catch (err) {
        st.fail(parse_error(err))
      }
      st.end()
    })
  })
}

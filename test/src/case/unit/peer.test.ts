import { parse_error } from '@frostr/bifrost/util'

import {
  get_peer_by_pubkey,
  get_peer_pubkeys,
  get_recv_pubkeys,
  get_send_pubkeys,
  get_expired_pubkeys
} from '@/lib/peer.js'

import { now } from '@/util/helpers.js'
import { PEER_STATE_EXPIRY } from '@/const.js'

import type { Test }     from 'tape'
import type { PeerData } from '@/types/index.js'

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
    } finally {
      t.end()
    }
  })
}

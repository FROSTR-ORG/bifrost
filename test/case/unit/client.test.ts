/**
 * BifrostNode Unit Tests
 *
 * Tests for BifrostNode construction, configuration, and non-network operations.
 * Network operations are covered by integration tests.
 */

import { BifrostNode }       from '@/class/client.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { parse_error }        from '@/util/index.js'

import type { Test } from 'tape'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape: Test) {
  tape.test('BifrostNode tests', t => {
    try {
      const vec   = parse_group_vector(VECTOR)
      const group = vec.group
      const share = vec.shares[0]
      const relays = ['wss://test.relay.example']

      // ========================================================================
      // Constructor Tests
      // ========================================================================

      t.test('constructor creates node with minimal config', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node !== undefined, 'node is created')
        st.equal(node.is_ready, false, 'node is not ready before connect')

        // Note: close() requires network connection to work fully
        // In unit tests, we just verify node creation
        st.end()
      })

      t.test('constructor accepts custom configuration', st => {
        const node = new BifrostNode(group, share, relays, {
          debug: true,
          sign_interval: 200,
          ecdh_interval: 200,
          max_sign_batch: 5,
          max_ecdh_batch: 5
        })

        st.equal(node.debug, true, 'debug option is respected')
        st.equal(node.config.sign_interval, 200, 'sign_interval is set')
        st.equal(node.config.ecdh_interval, 200, 'ecdh_interval is set')
        st.equal(node.config.max_sign_batch, 5, 'max_sign_batch is set')
        st.equal(node.config.max_ecdh_batch, 5, 'max_ecdh_batch is set')

        st.end()
      })

      t.test('constructor rejects invalid config', st => {
        // max_sign_batch exceeds pool_size
        st.throws(() => {
          new BifrostNode(group, share, relays, {
            max_sign_batch: 100,
            pool_config: { pool_size: 20 }
          })
        }, /max_sign_batch.*cannot exceed pool_size/, 'rejects max_sign_batch > pool_size')

        st.end()
      })

      // ========================================================================
      // Getter Tests
      // ========================================================================

      t.test('pubkey getter returns correct format', st => {
        const node = new BifrostNode(group, share, relays)

        st.equal(typeof node.pubkey, 'string', 'pubkey is a string')
        st.equal(node.pubkey.length, 64, 'pubkey is 32 bytes hex (BIP-340)')

        st.end()
      })

      t.test('signer getter returns BifrostSigner', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.signer !== undefined, 'signer is accessible')
        st.equal(node.signer.idx, share.idx, 'signer has correct idx')
        st.equal(node.signer.group.group_pk, group.group_pk, 'signer has correct group')

        st.end()
      })

      t.test('pool getter returns NoncePool', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.pool !== undefined, 'pool is accessible')
        st.equal(typeof node.pool.config, 'object', 'pool has config')
        st.ok(node.pool.config.pool_size > 0, 'pool has valid pool_size')

        st.end()
      })

      t.test('group getter returns GroupPackage', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.group !== undefined, 'group is accessible')
        st.equal(node.group.threshold, group.threshold, 'threshold matches')
        st.equal(node.group.group_pk, group.group_pk, 'group_pk matches')
        st.equal(node.group.members.length, group.members.length, 'members count matches')

        st.end()
      })

      t.test('config getter returns merged config', st => {
        const node = new BifrostNode(group, share, relays, {
          debug: true,
          policies: []
        })

        st.ok(node.config !== undefined, 'config is accessible')
        st.equal(node.config.debug, true, 'custom debug is preserved')
        st.ok(node.config.sign_interval > 0, 'default sign_interval is set')
        st.ok(node.config.ecdh_interval > 0, 'default ecdh_interval is set')
        st.ok(node.config.default_policy !== undefined, 'default_policy is set')

        st.end()
      })

      t.test('cache getter returns cache object', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.cache !== undefined, 'cache is accessible')
        st.ok(node.cache.ecdh !== undefined, 'ecdh cache is accessible')

        st.end()
      })

      t.test('client getter returns NostrNode', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.client !== undefined, 'client is accessible')
        st.equal(typeof node.client.connect, 'function', 'client has connect method')
        st.equal(typeof node.client.close, 'function', 'client has close method')

        st.end()
      })

      t.test('req getter returns API object', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.req !== undefined, 'req is accessible')
        st.equal(typeof node.req.sign, 'function', 'sign API is a function')
        st.equal(typeof node.req.sign_batch, 'function', 'sign_batch API is a function')
        st.equal(typeof node.req.ecdh, 'function', 'ecdh API is a function')
        st.equal(typeof node.req.ecdh_batch, 'function', 'ecdh_batch API is a function')
        st.equal(typeof node.req.ping, 'function', 'ping API is a function')
        st.equal(typeof node.req.echo, 'function', 'echo API is a function')
        st.equal(typeof node.req.onboard, 'function', 'onboard API is a function')

        st.end()
      })

      t.test('batcher getters return batchers', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.sign_batcher !== undefined, 'sign_batcher is accessible')
        st.ok(node.ecdh_batcher !== undefined, 'ecdh_batcher is accessible')

        st.end()
      })

      // ========================================================================
      // Peer Initialization Tests
      // ========================================================================

      t.test('peers are initialized correctly', st => {
        const node = new BifrostNode(group, share, relays)

        // Should have N-1 peers (excludes self)
        st.equal(node.peers.length, group.members.length - 1, 'correct number of peers')

        // All peers should have correct structure
        for (const peer of node.peers) {
          st.ok(peer.pubkey !== undefined, 'peer has pubkey')
          st.equal(peer.pubkey.length, 64, 'peer pubkey is 32 bytes hex')
          st.ok(peer.policy !== undefined, 'peer has policy')
          st.equal(typeof peer.policy.send, 'boolean', 'peer has send policy')
          st.equal(typeof peer.policy.recv, 'boolean', 'peer has recv policy')
          st.equal(peer.status, 'offline', 'peer starts offline')
          st.ok(peer.updated > 0, 'peer has updated timestamp')
        }

        // Self should not be in peers
        const selfInPeers = node.peers.some(p => p.pubkey === node.pubkey)
        st.notOk(selfInPeers, 'self is not in peers list')

        st.end()
      })

      t.test('custom peer policies are applied', st => {
        // Create node first to get peer pubkeys
        const tempNode = new BifrostNode(group, share, relays)
        const peerPkBip340 = tempNode.peers[0].pubkey
        // Note: close() requires network connection, skip in unit tests

        const node = new BifrostNode(group, share, relays, {
          policies: [{
            pubkey: peerPkBip340,
            policy: { send: false, recv: true }
          }],
          default_policy: { send: true, recv: true }
        })

        // Find the peer with custom policy
        const customPeer = node.peers.find(p => p.pubkey === peerPkBip340)
        if (customPeer) {
          st.equal(customPeer.policy.send, false, 'custom send policy applied')
          st.equal(customPeer.policy.recv, true, 'custom recv policy applied')
        }

        // Other peers should have default policy
        const otherPeers = node.peers.filter(p => p.pubkey !== peerPkBip340)
        for (const peer of otherPeers) {
          st.equal(peer.policy.send, true, 'default send policy for other peers')
          st.equal(peer.policy.recv, true, 'default recv policy for other peers')
        }

        st.end()
      })

      // ========================================================================
      // Peer Update Tests
      // ========================================================================

      t.test('update_peer modifies peer data', st => {
        const node = new BifrostNode(group, share, relays)

        const firstPeer = node.peers[0]
        const originalStatus = firstPeer.status
        const originalUpdated = firstPeer.updated

        // Update the peer
        node.update_peer({
          ...firstPeer,
          status: 'online',
          updated: originalUpdated + 1000
        })

        // Verify the update
        const updatedPeer = node.peers.find(p => p.pubkey === firstPeer.pubkey)
        st.ok(updatedPeer !== undefined, 'peer still exists')
        st.equal(updatedPeer!.status, 'online', 'status was updated')
        st.equal(updatedPeer!.updated, originalUpdated + 1000, 'updated timestamp changed')

        st.end()
      })

      t.test('update_peer ignores unknown pubkeys', st => {
        const node = new BifrostNode(group, share, relays)

        const originalPeers = [...node.peers]

        // Try to update a non-existent peer
        node.update_peer({
          pubkey: 'a'.repeat(64),
          policy: { send: false, recv: false },
          status: 'online',
          updated: 0
        })

        // Peers should be unchanged
        st.deepEqual(node.peers, originalPeers, 'peers unchanged after invalid update')

        st.end()
      })

      // ========================================================================
      // Pool Configuration Tests
      // ========================================================================

      t.test('custom pool config is applied', st => {
        const node = new BifrostNode(group, share, relays, {
          max_sign_batch: 10,  // Must be <= pool_size
          pool_config: {
            pool_size: 30,
            min_threshold: 15,
            critical_threshold: 5
          }
        })

        st.equal(node.pool.config.pool_size, 30, 'custom pool_size applied')
        st.equal(node.pool.config.min_threshold, 15, 'custom min_threshold applied')
        st.equal(node.pool.config.critical_threshold, 5, 'custom critical_threshold applied')

        st.end()
      })

      // ========================================================================
      // Signer Destroy Tests (without network)
      // ========================================================================

      t.test('signer can be destroyed directly', st => {
        const node = new BifrostNode(group, share, relays)

        st.equal(node.signer.destroyed, false, 'signer starts not destroyed')

        // Destroy signer directly
        node.signer.destroy()

        st.equal(node.signer.destroyed, true, 'signer is destroyed')

        st.end()
      })

      // ========================================================================
      // Event Emitter Tests
      // ========================================================================

      t.test('node inherits EventEmitter functionality', st => {
        const node = new BifrostNode(group, share, relays)

        let eventReceived = false

        // Register a listener
        node.on('ready', () => {
          eventReceived = true
        })

        // Manually emit (since we're not connecting)
        node.emit('ready', node)

        st.ok(eventReceived, 'event was received')

        // Test once() and clear()
        let onceCount = 0
        node.once('closed', () => {
          onceCount++
        })

        node.emit('closed', node)
        node.emit('closed', node)

        st.equal(onceCount, 1, 'once() only fires once')

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}

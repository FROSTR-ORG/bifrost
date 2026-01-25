/**
 * Middleware Unit Tests
 *
 * Tests for BifrostNode middleware configuration and function interface.
 * Note: Full middleware execution requires network, tested here at config level.
 */

import { BifrostNode }       from '@/class/client.js'
import { parse_group_vector } from '@/test/lib/parse.js'
import { parse_error }        from '@/util/index.js'

import type { Test } from 'tape'
import type { BifrostNodeMiddleware } from '@/types/index.js'
import type { RpcMessageData } from '@vbyte/nostr-sdk'

import VECTOR from '@/test/vector/group.vec.json' assert { type: 'json' }

export default function (tape: Test) {
  tape.test('Middleware tests', t => {
    try {
      const vec   = parse_group_vector(VECTOR)
      const group = vec.group
      const share = vec.shares[0]
      const relays = ['wss://test.relay.example']

      // ========================================================================
      // Middleware Configuration Tests
      // ========================================================================

      t.test('node has empty middleware by default', st => {
        const node = new BifrostNode(group, share, relays)

        st.ok(node.config.middleware !== undefined, 'middleware config exists')
        st.equal(node.config.middleware.sign, undefined, 'sign middleware is undefined')
        st.equal(node.config.middleware.ecdh, undefined, 'ecdh middleware is undefined')

        st.end()
      })

      t.test('sign middleware is configurable', st => {
        let called = false
        const middleware: BifrostNodeMiddleware = {
          sign: (client, msg) => {
            called = true
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })

        st.equal(typeof node.config.middleware.sign, 'function', 'sign middleware is a function')
        st.equal(node.config.middleware.ecdh, undefined, 'ecdh middleware remains undefined')

        // Verify middleware can be invoked
        const mockMsg = { type: 'request' } as RpcMessageData
        const result = node.config.middleware.sign!(node, mockMsg)
        st.ok(called, 'middleware was called')
        st.equal(result, mockMsg, 'middleware returns the message')

        st.end()
      })

      t.test('ecdh middleware is configurable', st => {
        let called = false
        const middleware: BifrostNodeMiddleware = {
          ecdh: (client, msg) => {
            called = true
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })

        st.equal(typeof node.config.middleware.ecdh, 'function', 'ecdh middleware is a function')
        st.equal(node.config.middleware.sign, undefined, 'sign middleware remains undefined')

        // Verify middleware can be invoked
        const mockMsg = { type: 'request' } as RpcMessageData
        const result = node.config.middleware.ecdh!(node, mockMsg)
        st.ok(called, 'middleware was called')
        st.equal(result, mockMsg, 'middleware returns the message')

        st.end()
      })

      t.test('both middlewares can be configured together', st => {
        let signCalled = false
        let ecdhCalled = false

        const middleware: BifrostNodeMiddleware = {
          sign: (client, msg) => {
            signCalled = true
            return msg
          },
          ecdh: (client, msg) => {
            ecdhCalled = true
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })

        st.equal(typeof node.config.middleware.sign, 'function', 'sign middleware is set')
        st.equal(typeof node.config.middleware.ecdh, 'function', 'ecdh middleware is set')

        // Invoke both
        const mockMsg = { type: 'request' } as RpcMessageData
        node.config.middleware.sign!(node, mockMsg)
        node.config.middleware.ecdh!(node, mockMsg)

        st.ok(signCalled, 'sign middleware was called')
        st.ok(ecdhCalled, 'ecdh middleware was called')

        st.end()
      })

      // ========================================================================
      // Middleware Function Interface Tests
      // ========================================================================

      t.test('middleware receives correct arguments', st => {
        let receivedNode: BifrostNode | null = null
        let receivedMsg: RpcMessageData | null = null

        const middleware: BifrostNodeMiddleware = {
          sign: (client, msg) => {
            receivedNode = client
            receivedMsg = msg
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })
        const mockMsg = { type: 'request', method: 'sign' } as RpcMessageData

        node.config.middleware.sign!(node, mockMsg)

        st.equal(receivedNode, node, 'middleware receives the node instance')
        st.equal(receivedMsg, mockMsg, 'middleware receives the message')

        st.end()
      })

      t.test('middleware can transform messages', st => {
        const middleware: BifrostNodeMiddleware = {
          sign: (client, msg) => {
            // Return a transformed message
            return { ...msg, transformed: true } as RpcMessageData
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })
        const mockMsg = { type: 'request' } as RpcMessageData

        const result = node.config.middleware.sign!(node, mockMsg)

        st.notEqual(result, mockMsg, 'middleware returns different object')
        st.equal((result as { transformed?: boolean }).transformed, true, 'transformation applied')

        st.end()
      })

      t.test('middleware can access node properties', st => {
        let accessedPubkey: string | null = null

        const middleware: BifrostNodeMiddleware = {
          ecdh: (client, msg) => {
            accessedPubkey = client.pubkey
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })
        const mockMsg = { type: 'request' } as RpcMessageData

        node.config.middleware.ecdh!(node, mockMsg)

        st.equal(accessedPubkey, node.pubkey, 'middleware can access node.pubkey')
        st.equal(accessedPubkey?.length, 64, 'pubkey has correct length')

        st.end()
      })

      // ========================================================================
      // Middleware Error Handling Tests
      // ========================================================================

      t.test('middleware throwing is catchable', st => {
        const middleware: BifrostNodeMiddleware = {
          sign: () => {
            throw new Error('middleware rejection')
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })
        const mockMsg = { type: 'request' } as RpcMessageData

        st.throws(
          () => node.config.middleware.sign!(node, mockMsg),
          /middleware rejection/,
          'middleware throw is propagated'
        )

        st.end()
      })

      t.test('middleware can reject based on message content', st => {
        const middleware: BifrostNodeMiddleware = {
          ecdh: (client, msg) => {
            // Example: reject messages from certain methods
            if ((msg as { blocked?: boolean }).blocked) {
              throw new Error('request blocked by middleware')
            }
            return msg
          }
        }

        const node = new BifrostNode(group, share, relays, { middleware })

        // Normal message passes through
        const normalMsg = { type: 'request' } as RpcMessageData
        st.doesNotThrow(
          () => node.config.middleware.ecdh!(node, normalMsg),
          'normal messages pass through'
        )

        // Blocked message throws
        const blockedMsg = { type: 'request', blocked: true } as RpcMessageData
        st.throws(
          () => node.config.middleware.ecdh!(node, blockedMsg),
          /request blocked/,
          'blocked messages are rejected'
        )

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}

/**
 * Batcher Integration Tests Aggregator
 */

import sign_batcher_integration from './sign-batcher.int.test.js'
import ecdh_batcher_integration from './ecdh-batcher.int.test.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {
  tape.test('Batcher Integration Tests', t => {
    sign_batcher_integration(ctx, t)
    ecdh_batcher_integration(ctx, t)
  })
}

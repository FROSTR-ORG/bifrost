/**
 * Batcher Integration Tests Aggregator
 */

import sign_batcher_integration from './sign-batcher.integration.js'
import ecdh_batcher_integration from './ecdh-batcher.integration.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {
  tape.test('Batcher Integration Tests', t => {
    sign_batcher_integration(ctx, t)
    ecdh_batcher_integration(ctx, t)
    t.end()
  })
}

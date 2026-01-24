/**
 * Pool Integration Tests Aggregator
 */

import nonce_pool_integration from './nonce-pool.int.test.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {
  tape.test('Pool Integration Tests', t => {
    nonce_pool_integration(ctx, t)
  })
}

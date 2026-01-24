/**
 * API Integration Tests Aggregator
 */

import ping_integration    from './ping.int.test.js'
import echo_integration    from './echo.int.test.js'
import sign_integration    from './sign.int.test.js'
import ecdh_integration    from './ecdh.int.test.js'
import onboard_integration from './onboard.int.test.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {
  tape.test('API Integration Tests', t => {
    ping_integration(ctx, t)
    echo_integration(ctx, t)
    sign_integration(ctx, t)
    ecdh_integration(ctx, t)
    onboard_integration(ctx, t)
  })
}

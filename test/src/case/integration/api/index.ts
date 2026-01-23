/**
 * API Integration Tests Aggregator
 */

import ping_integration    from './ping.integration.js'
import echo_integration    from './echo.integration.js'
import sign_integration    from './sign.integration.js'
import ecdh_integration    from './ecdh.integration.js'
import onboard_integration from './onboard.integration.js'

import type { TestNetwork } from '@/test/types.js'
import type { Test }        from 'tape'

export default function (ctx : TestNetwork, tape : Test) {
  tape.test('API Integration Tests', t => {
    ping_integration(ctx, t)
    echo_integration(ctx, t)
    sign_integration(ctx, t)
    ecdh_integration(ctx, t)
    onboard_integration(ctx, t)
    t.end()
  })
}

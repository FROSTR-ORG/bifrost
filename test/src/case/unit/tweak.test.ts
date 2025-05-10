import { parse_error } from '@frostr/bifrost/util'

import {
  verify_seckey,
  verify_pubkey,
  tweak_pubkey,
  tweak_seckey,
  get_pubkey
} from '@/util/crypto.js'

import type { Test } from 'tape'

import VECTORS from '@/test/vector/ecc.vec.json' with { type: 'json' }

export default function (tape : Test) {

  const { pass, fail } = VECTORS

  tape.test('ecc tests (pass vectors)', t => {
    for (const { internal_secnonce, internal_pubnonce, internal_tweak, target_secnonce, target_pubnonce } of pass) {
      try {
        verify_seckey(internal_secnonce)
        t.pass('internal_secnonce is valid')
        verify_pubkey(internal_pubnonce, 'ecdsa')
        t.pass('internal_pubnonce is valid')

        const tweaked_secnonce = tweak_seckey(internal_secnonce, internal_tweak)
        t.equal(tweaked_secnonce, target_secnonce, 'tweak_secnonce returns the correct value')

        const tweaked_pubnonce = tweak_pubkey(internal_pubnonce, internal_tweak)
        t.equal(tweaked_pubnonce, target_pubnonce, 'tweak_pubnonce returns the correct value')

        const derived_pubnonce = get_pubkey(tweaked_secnonce, 'ecdsa')
        t.equal(derived_pubnonce, tweaked_pubnonce, 'tweaked secnonce returns the correct pubnonce')

      } catch (err) {
        t.fail(parse_error(err))
      }
    }
    t.end()
  })

  tape.test('ecc tests (fail vectors)', t => {
    for (const { internal_secnonce, internal_pubnonce, reason } of fail) {
      try {
        verify_seckey(internal_secnonce)
        verify_pubkey(internal_pubnonce, 'ecdsa')
        t.fail('should have thrown an error')
      } catch (err) {
        const msg = parse_error(err)
        t.true(msg.startsWith(reason), `fail: ${reason}`)
      }
    }
    t.end()
  })
}

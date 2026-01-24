/**
 * Unit Test Runner
 *
 * Unit tests for the Bifrost protocol (no network required).
 * Can be run standalone or as part of the main test suite.
 */

import tape from 'tape'

import type { Test } from 'tape'

import encode_unit_case   from './encode.test.js'
import group_unit_case    from './group.test.js'
import session_unit_case  from './session.test.js'
import tweak_unit_case    from './tweak.test.js'
import sign_unit_case     from './sign.test.js'
import recover_unit_case  from './recover.test.js'
import emitter_unit_case  from './emitter.test.js'
import peer_unit_case     from './peer.test.js'
import parse_unit_case    from './parse.test.js'
import signer_unit_case   from './signer.test.js'
import assert_unit_case   from './assert.test.js'
import helpers_unit_case  from './helpers.test.js'
import libutil_unit_case  from './lib-util.test.js'
import nonce_unit_case    from './nonce.test.js'
import pool_unit_case     from './pool.test.js'

/**
 * Register unit test cases on a parent test.
 * Used when running as part of the main test suite.
 */
export default function unit_test_cases (t : Test) {
  encode_unit_case(t)
  group_unit_case(t)
  tweak_unit_case(t)
  session_unit_case(t)
  sign_unit_case(t)
  recover_unit_case(t)
  emitter_unit_case(t)
  peer_unit_case(t)
  parse_unit_case(t)
  signer_unit_case(t)
  assert_unit_case(t)
  helpers_unit_case(t)
  libutil_unit_case(t)
  nonce_unit_case(t)
  pool_unit_case(t)
}

// Run standalone if executed directly
const isMain = process.argv[1]?.includes('unit/runner')
if (isMain) {
  tape('Unit Test Suite', async t => {
    unit_test_cases(t)
  })
}

import tape from 'tape'

import e2e_test_cases    from './src/case/e2e/index.js'
import encode_unit_case  from './src/case/unit/encode.test.js'
import group_unit_case   from './src/case/unit/group.test.js'
import session_unit_case from './src/case/unit/session.test.js'
import tweak_unit_case   from './src/case/unit/tweak.test.js'
import member_unit_case  from './src/case/unit/member.test.js'
import sign_unit_case    from './src/case/unit/sign.test.js'
import recover_unit_case from './src/case/unit/recover.test.js'
import emitter_unit_case from './src/case/unit/emitter.test.js'
import peer_unit_case    from './src/case/unit/peer.test.js'
import parse_unit_case   from './src/case/unit/parse.test.js'
import signer_unit_case  from './src/case/unit/signer.test.js'
import assert_unit_case  from './src/case/unit/assert.test.js'
import helpers_unit_case from './src/case/unit/helpers.test.js'
import libutil_unit_case from './src/case/unit/lib-util.test.js'

tape('Bifrost Test Suite', async t => {
  encode_unit_case(t)
  group_unit_case(t)
  tweak_unit_case(t)
  session_unit_case(t)
  member_unit_case(t)
  sign_unit_case(t)
  recover_unit_case(t)
  emitter_unit_case(t)
  peer_unit_case(t)
  parse_unit_case(t)
  signer_unit_case(t)
  assert_unit_case(t)
  helpers_unit_case(t)
  libutil_unit_case(t)
  e2e_test_cases(t)
})

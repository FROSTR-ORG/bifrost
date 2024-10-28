import tape from 'tape'

import e2e_test_cases    from './src/case/e2e/index.js'
import encode_unit_case  from './src/case/unit/encode.test.js'
import group_unit_case   from './src/case/unit/group.test.js'
import session_unit_case from './src/case/unit/session.test.js'
import tweak_unit_case   from './src/case/unit/tweak.test.js'
import member_unit_case  from './src/case/unit/member.test.js'
import sign_unit_case    from './src/case/unit/sign.test.js'

tape('Bifrost Test Suite', async t => {
    encode_unit_case(t)
    group_unit_case(t)
    tweak_unit_case(t)
    session_unit_case(t)
    member_unit_case(t)
    sign_unit_case(t)
    e2e_test_cases(t)
})

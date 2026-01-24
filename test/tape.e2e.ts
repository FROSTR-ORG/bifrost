import tape from 'tape'

import e2e_test_cases from './src/case/e2e/index.js'

tape('E2E Test Suite', async t => {
  e2e_test_cases(t)
})

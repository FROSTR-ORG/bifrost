import tape from 'tape'

import integration_test_cases from './src/case/integration/index.js'

tape('Integration Test Suite', async t => {
  integration_test_cases(t)
})

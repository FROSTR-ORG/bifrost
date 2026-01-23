import { generate_dealer_package } from '@frostr/bifrost/lib'
import { parse_error }             from '@frostr/bifrost/util'

import {
  decode_group_package,
  decode_share_package,
  encode_group_package,
  encode_share_package
} from '@/encoder/index.js'

import type { Test } from 'tape'

export default function (tape : Test) {
  tape.test('encoding tests', t => {
    try {
      // Generate a fresh dealer package for testing
      const pkg = generate_dealer_package(2, 3)

      // Test encoding/decoding
      const enc_group  = encode_group_package(pkg.group)
      const enc_shares = pkg.shares.map(e => encode_share_package(e))
      const dec_group  = decode_group_package(enc_group)
      const dec_shares = enc_shares.map(e => decode_share_package(e))

      // Verify prefix formats
      t.ok(enc_group.startsWith('bfgroup1'), 'group encoding has correct prefix')
      t.ok(enc_shares.every(s => s.startsWith('bfshare1')), 'share encodings have correct prefix')

      // Verify round-trip
      t.deepEqual(dec_group, pkg.group, 'group encodes and decodes correctly')
      t.deepEqual(dec_shares, pkg.shares, 'all shares encode and decode correctly')

      // Verify decoded values match original
      t.equal(dec_group.group_pk, pkg.group.group_pk, 'group public key matches')
      t.equal(dec_group.threshold, pkg.group.threshold, 'threshold matches')
      t.equal(dec_group.members.length, pkg.group.members.length, 'member count matches')
    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

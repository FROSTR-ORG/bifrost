import Schema from '@/schema/index.js'
import { parse_error } from '@/util/index.js'

import type { Test } from 'tape'

// Valid test data
const HEX32 = 'a'.repeat(64)
const HEX33 = '02' + 'b'.repeat(64)
const HEX64 = 'c'.repeat(128)

export default function (tape: Test) {
  tape.test('Schema validation tests', t => {
    try {
      // ========================================================================
      // Base Schema Tests
      // ========================================================================

      t.test('base.hex32 validates 32-byte hex strings', st => {
        // Valid cases
        st.ok(Schema.base.hex32.safeParse(HEX32).success, 'accepts valid 64-char hex')
        st.ok(Schema.base.hex32.safeParse('0'.repeat(64)).success, 'accepts all zeros')
        st.ok(Schema.base.hex32.safeParse('f'.repeat(64)).success, 'accepts all fs')
        st.ok(Schema.base.hex32.safeParse('ABCDEF'.repeat(10) + 'abcd').success, 'accepts mixed case')

        // Invalid cases
        st.notOk(Schema.base.hex32.safeParse(HEX33).success, 'rejects 66-char hex')
        st.notOk(Schema.base.hex32.safeParse('a'.repeat(63)).success, 'rejects 63-char hex')
        st.notOk(Schema.base.hex32.safeParse('a'.repeat(65)).success, 'rejects 65-char hex')
        st.notOk(Schema.base.hex32.safeParse('ghij'.repeat(16)).success, 'rejects non-hex chars')
        st.notOk(Schema.base.hex32.safeParse('').success, 'rejects empty string')
        st.notOk(Schema.base.hex32.safeParse(123).success, 'rejects numbers')

        st.end()
      })

      t.test('base.hex33 validates 33-byte hex strings', st => {
        // Valid cases
        st.ok(Schema.base.hex33.safeParse(HEX33).success, 'accepts valid 66-char hex')
        st.ok(Schema.base.hex33.safeParse('02' + '0'.repeat(64)).success, 'accepts compressed pubkey format')
        st.ok(Schema.base.hex33.safeParse('03' + 'f'.repeat(64)).success, 'accepts odd y compressed pubkey')

        // Invalid cases
        st.notOk(Schema.base.hex33.safeParse(HEX32).success, 'rejects 64-char hex')
        st.notOk(Schema.base.hex33.safeParse('a'.repeat(67)).success, 'rejects 67-char hex')
        st.notOk(Schema.base.hex33.safeParse('').success, 'rejects empty string')

        st.end()
      })

      t.test('base.hex64 validates 64-byte hex strings', st => {
        // Valid cases
        st.ok(Schema.base.hex64.safeParse(HEX64).success, 'accepts valid 128-char hex')

        // Invalid cases
        st.notOk(Schema.base.hex64.safeParse(HEX32).success, 'rejects 64-char hex')
        st.notOk(Schema.base.hex64.safeParse('a'.repeat(127)).success, 'rejects 127-char hex')

        st.end()
      })

      t.test('base.uint validates unsigned integers', st => {
        // Valid cases
        st.ok(Schema.base.uint.safeParse(0).success, 'accepts zero')
        st.ok(Schema.base.uint.safeParse(1).success, 'accepts positive int')
        st.ok(Schema.base.uint.safeParse(Number.MAX_SAFE_INTEGER).success, 'accepts MAX_SAFE_INTEGER')

        // Invalid cases
        st.notOk(Schema.base.uint.safeParse(-1).success, 'rejects negative')
        st.notOk(Schema.base.uint.safeParse(1.5).success, 'rejects float')
        st.notOk(Schema.base.uint.safeParse(Number.MAX_SAFE_INTEGER + 1).success, 'rejects > MAX_SAFE_INTEGER')
        st.notOk(Schema.base.uint.safeParse('123').success, 'rejects string')

        st.end()
      })

      t.test('base.stamp validates timestamps', st => {
        // Valid cases
        st.ok(Schema.base.stamp.safeParse(1234567890).success, 'accepts valid timestamp')
        st.ok(Schema.base.stamp.safeParse(500_000_001).success, 'accepts near minimum')
        st.ok(Schema.base.stamp.safeParse(Date.now() / 1000).success, 'accepts current time')

        // Invalid cases
        st.notOk(Schema.base.stamp.safeParse(499_999_999).success, 'rejects below minimum')
        st.notOk(Schema.base.stamp.safeParse(0).success, 'rejects zero')
        st.notOk(Schema.base.stamp.safeParse(-1).success, 'rejects negative')

        st.end()
      })

      t.test('base.bech32 validates bech32 strings', st => {
        // Valid cases
        st.ok(Schema.base.bech32.safeParse('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').success, 'accepts valid bech32')
        st.ok(Schema.base.bech32.safeParse('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7').success, 'accepts long bech32')

        // Invalid cases
        st.notOk(Schema.base.bech32.safeParse('BC1QW508').success, 'rejects uppercase')
        st.notOk(Schema.base.bech32.safeParse('bc1invalid').success, 'rejects invalid chars after 1')
        st.notOk(Schema.base.bech32.safeParse('').success, 'rejects empty string')

        st.end()
      })

      // ========================================================================
      // Peer Schema Tests
      // ========================================================================

      t.test('peer.policy validates policy objects', st => {
        // Valid cases
        st.ok(Schema.peer.policy.safeParse({ send: true, recv: true }).success, 'accepts both true')
        st.ok(Schema.peer.policy.safeParse({ send: false, recv: false }).success, 'accepts both false')
        st.ok(Schema.peer.policy.safeParse({ send: true, recv: false }).success, 'accepts mixed')

        // Invalid cases
        st.notOk(Schema.peer.policy.safeParse({ send: true }).success, 'rejects missing recv')
        st.notOk(Schema.peer.policy.safeParse({ recv: true }).success, 'rejects missing send')
        st.notOk(Schema.peer.policy.safeParse({ send: 'yes', recv: true }).success, 'rejects string value')
        st.notOk(Schema.peer.policy.safeParse({}).success, 'rejects empty object')
        st.notOk(Schema.peer.policy.safeParse(null).success, 'rejects null')

        st.end()
      })

      t.test('peer.config validates peer config objects', st => {
        const validConfig = {
          pubkey: HEX32,
          policy: { send: true, recv: true }
        }

        // Valid cases
        st.ok(Schema.peer.config.safeParse(validConfig).success, 'accepts valid config')

        // Invalid cases
        st.notOk(Schema.peer.config.safeParse({ ...validConfig, pubkey: 'short' }).success, 'rejects short pubkey')
        st.notOk(Schema.peer.config.safeParse({ pubkey: HEX32 }).success, 'rejects missing policy')

        st.end()
      })

      t.test('peer.data validates peer data objects', st => {
        const validData = {
          pubkey: HEX32,
          policy: { send: true, recv: true },
          status: 'online',
          updated: 1234567890
        }

        // Valid cases
        st.ok(Schema.peer.data.safeParse(validData).success, 'accepts valid data')
        st.ok(Schema.peer.data.safeParse({ ...validData, status: 'offline' }).success, 'accepts offline status')

        // Invalid cases
        st.notOk(Schema.peer.data.safeParse({ ...validData, status: 'unknown' }).success, 'rejects invalid status')
        st.notOk(Schema.peer.data.safeParse({ ...validData, updated: 0 }).success, 'rejects invalid timestamp')

        st.end()
      })

      t.test('peer.ping_req validates ping request objects', st => {
        // Valid cases
        st.ok(Schema.peer.ping_req.safeParse({ version: 1 }).success, 'accepts minimal request')
        st.ok(Schema.peer.ping_req.safeParse({ version: 2, pool_status: [] }).success, 'accepts with pool_status')
        st.ok(Schema.peer.ping_req.safeParse({ version: 2, nonces: [] }).success, 'accepts with nonces')

        // Invalid cases
        st.notOk(Schema.peer.ping_req.safeParse({}).success, 'rejects missing version')
        st.notOk(Schema.peer.ping_req.safeParse({ version: 'v1' }).success, 'rejects string version')

        st.end()
      })

      t.test('peer.ping_res validates ping response objects', st => {
        const policy = { send: true, recv: true }

        // Valid cases
        st.ok(Schema.peer.ping_res.safeParse({ policy }).success, 'accepts minimal response')
        st.ok(Schema.peer.ping_res.safeParse({ policy, pool_status: [] }).success, 'accepts with pool_status')
        st.ok(Schema.peer.ping_res.safeParse({ policy, nonces: [] }).success, 'accepts with nonces')

        // Invalid cases
        st.notOk(Schema.peer.ping_res.safeParse({}).success, 'rejects missing policy')
        st.notOk(Schema.peer.ping_res.safeParse({ policy: {} }).success, 'rejects empty policy')

        st.end()
      })

      // ========================================================================
      // Node Schema Tests
      // ========================================================================

      t.test('node.config validates node configuration', st => {
        const validConfig = {
          debug: false,
          middleware: {},
          policies: [],
          default_policy: { send: true, recv: true },
          sign_interval: 100,
          max_sign_batch: 10,
          ecdh_interval: 100,
          max_ecdh_batch: 10
        }

        // Valid cases
        st.ok(Schema.node.config.safeParse(validConfig).success, 'accepts valid config')
        st.ok(Schema.node.config.safeParse({
          ...validConfig,
          middleware: { sign: () => {}, ecdh: () => {} }
        }).success, 'accepts with middleware functions')

        // Invalid cases
        st.notOk(Schema.node.config.safeParse({ ...validConfig, debug: 'yes' }).success, 'rejects string debug')
        st.notOk(Schema.node.config.safeParse({ ...validConfig, max_sign_batch: 0 }).success, 'rejects zero batch size')
        st.notOk(Schema.node.config.safeParse({ ...validConfig, max_sign_batch: 1000 }).success, 'rejects too large batch size')

        st.end()
      })

      t.test('node.node_config validates nostr node configuration', st => {
        // Valid cases (optional schema)
        st.ok(Schema.node.node_config.safeParse(undefined).success, 'accepts undefined')
        st.ok(Schema.node.node_config.safeParse({}).success, 'accepts empty object')
        st.ok(Schema.node.node_config.safeParse({ msg_timeout: 5000 }).success, 'accepts msg_timeout')
        st.ok(Schema.node.node_config.safeParse({ sub_timeout: 10000 }).success, 'accepts sub_timeout')
        st.ok(Schema.node.node_config.safeParse({ max_retries: 3 }).success, 'accepts max_retries')
        st.ok(Schema.node.node_config.safeParse({
          msg_timeout: 5000,
          sub_timeout: 10000,
          max_retries: 5
        }).success, 'accepts all options')

        // Invalid cases
        st.notOk(Schema.node.node_config.safeParse({ msg_timeout: 100 }).success, 'rejects too small timeout')
        st.notOk(Schema.node.node_config.safeParse({ max_retries: -1 }).success, 'rejects negative retries')
        st.notOk(Schema.node.node_config.safeParse({ max_retries: 11 }).success, 'rejects too many retries')

        st.end()
      })

      // ========================================================================
      // Package Schema Tests
      // ========================================================================

      t.test('pkg.group validates group package', st => {
        const validGroup = {
          members: [{ idx: 1, pubkey: HEX33 }],
          group_pk: HEX33,
          threshold: 2
        }

        // Valid cases
        st.ok(Schema.pkg.group.safeParse(validGroup).success, 'accepts valid group')
        st.ok(Schema.pkg.group.safeParse({
          ...validGroup,
          members: [
            { idx: 1, pubkey: HEX33 },
            { idx: 2, pubkey: HEX33 },
            { idx: 3, pubkey: HEX33 }
          ]
        }).success, 'accepts multiple members')

        // Invalid cases
        st.notOk(Schema.pkg.group.safeParse({ ...validGroup, group_pk: HEX32 }).success, 'rejects 32-byte group_pk')
        st.notOk(Schema.pkg.group.safeParse({ ...validGroup, members: [{ idx: 1 }] }).success, 'rejects member without pubkey')
        st.notOk(Schema.pkg.group.safeParse({ threshold: 2, group_pk: HEX33 }).success, 'rejects missing members')

        st.end()
      })

      t.test('pkg.share validates share package', st => {
        const validShare = {
          idx: 1,
          seckey: HEX32
        }

        // Valid cases
        st.ok(Schema.pkg.share.safeParse(validShare).success, 'accepts valid share')
        st.ok(Schema.pkg.share.safeParse({ ...validShare, idx: 100 }).success, 'accepts large idx')

        // Invalid cases
        st.notOk(Schema.pkg.share.safeParse({ ...validShare, seckey: 'short' }).success, 'rejects short seckey')
        st.notOk(Schema.pkg.share.safeParse({ idx: 1 }).success, 'rejects missing seckey')
        st.notOk(Schema.pkg.share.safeParse({ ...validShare, idx: 'one' }).success, 'rejects string idx')

        st.end()
      })

      t.test('pkg.ecdh validates ECDH package', st => {
        const validEcdh = {
          idx: 1,
          members: [1, 2, 3],
          entries: [{ ecdh_pk: HEX33, keyshare: HEX32 }]
        }

        // Valid cases
        st.ok(Schema.pkg.ecdh.safeParse(validEcdh).success, 'accepts valid ecdh package')
        st.ok(Schema.pkg.ecdh.safeParse({
          ...validEcdh,
          entries: [
            { ecdh_pk: HEX33, keyshare: HEX32 },
            { ecdh_pk: HEX33, keyshare: HEX32 }
          ]
        }).success, 'accepts multiple entries')

        // Invalid cases
        st.notOk(Schema.pkg.ecdh.safeParse({ ...validEcdh, entries: [{ ecdh_pk: 'bad' }] }).success, 'rejects invalid entry')
        st.notOk(Schema.pkg.ecdh.safeParse({ idx: 1, members: [1, 2] }).success, 'rejects missing entries')

        st.end()
      })

      // ========================================================================
      // Sign Schema Tests
      // ========================================================================

      t.test('sign.session validates signing session', st => {
        const validSession = {
          content: null,
          hashes: [[HEX32]],
          members: [1, 2, 3],
          stamp: 1234567890,
          type: 'nostr',
          gid: HEX32,
          sid: HEX32
        }

        // Valid cases
        st.ok(Schema.sign.session.safeParse(validSession).success, 'accepts valid session')
        st.ok(Schema.sign.session.safeParse({
          ...validSession,
          content: 'some content'
        }).success, 'accepts with content')
        st.ok(Schema.sign.session.safeParse({
          ...validSession,
          type: 'bitcoin'
        }).success, 'accepts bitcoin type')
        st.ok(Schema.sign.session.safeParse({
          ...validSession,
          nonces: []
        }).success, 'accepts with nonces')

        // Invalid cases
        st.notOk(Schema.sign.session.safeParse({ ...validSession, gid: 'short' }).success, 'rejects invalid gid')
        st.notOk(Schema.sign.session.safeParse({ ...validSession, sid: 123 }).success, 'rejects number sid')
        st.notOk(Schema.sign.session.safeParse({ ...validSession, hashes: 'not array' }).success, 'rejects non-array hashes')

        st.end()
      })

      t.test('sign.psig_pkg validates partial signature package', st => {
        const validPsig = {
          idx: 1,
          psigs: [[HEX32, HEX32]],
          pubkey: HEX33,
          sid: HEX32
        }

        // Valid cases
        st.ok(Schema.sign.psig_pkg.safeParse(validPsig).success, 'accepts valid psig')
        st.ok(Schema.sign.psig_pkg.safeParse({
          ...validPsig,
          psigs: [[HEX32, HEX32], [HEX32, HEX32]]
        }).success, 'accepts multiple psigs')
        st.ok(Schema.sign.psig_pkg.safeParse({
          ...validPsig,
          nonce_code: HEX32
        }).success, 'accepts with nonce_code')
        st.ok(Schema.sign.psig_pkg.safeParse({
          ...validPsig,
          replenish: []
        }).success, 'accepts with replenish')

        // Invalid cases
        st.notOk(Schema.sign.psig_pkg.safeParse({ ...validPsig, pubkey: HEX32 }).success, 'rejects 32-byte pubkey')
        st.notOk(Schema.sign.psig_pkg.safeParse({ ...validPsig, psigs: [['short', HEX32]] }).success, 'rejects invalid psig entry')

        st.end()
      })

      // ========================================================================
      // Nonce Schema Tests
      // ========================================================================

      t.test('nonce.pool_config validates pool configuration', st => {
        const validConfig = {
          pool_size: 20,
          min_threshold: 10,
          critical_threshold: 5,
          replenish_count: 5
        }

        // Valid cases
        st.ok(Schema.nonce.pool_config.safeParse(validConfig).success, 'accepts valid config')

        // Invalid cases (refinement checks)
        st.notOk(Schema.nonce.pool_config.safeParse({
          ...validConfig,
          critical_threshold: 15  // must be < min_threshold
        }).success, 'rejects critical >= min')

        st.notOk(Schema.nonce.pool_config.safeParse({
          ...validConfig,
          min_threshold: 25  // must be < pool_size
        }).success, 'rejects min >= pool_size')

        st.end()
      })

      t.test('nonce.derived_public_nonce validates derived public nonce', st => {
        const validNonce = {
          binder_pn: HEX33,
          hidden_pn: HEX33,
          code: HEX32
        }

        // Valid cases
        st.ok(Schema.nonce.derived_public_nonce.safeParse(validNonce).success, 'accepts valid nonce')

        // Invalid cases
        st.notOk(Schema.nonce.derived_public_nonce.safeParse({
          ...validNonce,
          binder_pn: HEX32  // should be 33 bytes
        }).success, 'rejects 32-byte binder_pn')

        st.notOk(Schema.nonce.derived_public_nonce.safeParse({
          ...validNonce,
          code: 'short'
        }).success, 'rejects short code')

        st.end()
      })

      // ========================================================================
      // Onboard Schema Tests
      // ========================================================================

      t.test('onboard.onboard_req validates onboard request', st => {
        const validReq = {
          share_pk: HEX33,
          idx: 1
        }

        // Valid cases
        st.ok(Schema.onboard.onboard_req.safeParse(validReq).success, 'accepts valid request')

        // Invalid cases
        st.notOk(Schema.onboard.onboard_req.safeParse({ share_pk: HEX33 }).success, 'rejects missing idx')
        st.notOk(Schema.onboard.onboard_req.safeParse({ idx: 1 }).success, 'rejects missing share_pk')
        st.notOk(Schema.onboard.onboard_req.safeParse({
          ...validReq,
          share_pk: HEX32
        }).success, 'rejects 32-byte share_pk')

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    }
  })
}

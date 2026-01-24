import { parse_error } from '@frostr/bifrost/util'

import {
  parse_ecdh_message,
  parse_session_message,
  parse_psig_message,
  parse_group_pkg,
  parse_share_pkg
} from '@/lib/parse.js'

import type { Test }           from 'tape'
import type { RpcMessageData } from '@vbyte/nostr-sdk'

// Valid test data - hex strings of correct lengths
const HEX32 = 'a'.repeat(64)  // 32 bytes = 64 hex chars
const HEX33 = '02' + 'b'.repeat(64)  // 33 bytes = 66 hex chars (compressed pubkey)

// Helper to create a mock RpcMessageData for request messages
function create_mock_request (data : string) : RpcMessageData {
  return {
    id     : HEX32,
    type   : 'request',
    method : 'test',
    params : [ data ],
    peers  : [],
    event  : {
      id         : HEX32,
      pubkey     : HEX32,
      kind       : 20004,
      content    : '',
      tags       : [],
      created_at : 1234567890,
      sig        : HEX32 + HEX32
    }
  } as RpcMessageData
}

// Helper to create a mock RpcMessageData for accept messages
function create_mock_accept (data : unknown) : RpcMessageData {
  return {
    id     : HEX32,
    type   : 'accept',
    status : true,
    data   : data,
    event  : {
      id         : HEX32,
      pubkey     : HEX32,
      kind       : 20004,
      content    : '',
      tags       : [],
      created_at : 1234567890,
      sig        : HEX32 + HEX32
    }
  } as RpcMessageData
}

// Valid ECDH package (new format with entries array)
const VALID_ECDH = {
  idx     : 1,
  members : [ 1, 2, 3 ],
  entries : [{
    ecdh_pk  : HEX33,
    keyshare : HEX32
  }]
}

// Valid session package
const VALID_SESSION = {
  content : null,
  hashes  : [[ HEX32 ]],
  members : [ 1, 2, 3 ],
  stamp   : 1234567890,
  type    : 'nostr',
  gid     : HEX32,
  sid     : HEX32
}

// Valid partial signature package
const VALID_PSIG = {
  idx    : 1,
  psigs  : [[ HEX32, HEX32 ]],
  pubkey : HEX33,
  sid    : HEX32
}

// Valid group package (new format with members instead of commits)
const VALID_GROUP = {
  members : [{
    idx    : 1,
    pubkey : HEX33
  }],
  group_pk  : HEX33,
  threshold : 2
}

// Valid share package (new simplified format without nonces)
const VALID_SHARE = {
  idx    : 1,
  seckey : HEX32
}

export default function (tape : Test) {
  tape.test('parse function tests', t => {
    try {
      // Test parse_ecdh_message - success case (request format)
      t.test('parse_ecdh_message() with valid request data', st => {
        const msg = create_mock_request(JSON.stringify(VALID_ECDH))
        const parsed = parse_ecdh_message(msg)

        st.equal(parsed.data.idx, VALID_ECDH.idx, 'idx is parsed correctly')
        st.deepEqual(parsed.data.members, VALID_ECDH.members, 'members are parsed correctly')
        st.ok(Array.isArray(parsed.data.entries), 'entries is an array')
        st.equal(parsed.data.entries.length, 1, 'entries has one element')
        st.equal(parsed.data.entries[0].ecdh_pk, VALID_ECDH.entries[0].ecdh_pk, 'entry ecdh_pk is parsed correctly')
        st.equal(parsed.data.entries[0].keyshare, VALID_ECDH.entries[0].keyshare, 'entry keyshare is parsed correctly')
        st.end()
      })

      // Test parse_ecdh_message - success case (accept format)
      t.test('parse_ecdh_message() with valid accept data', st => {
        const msg = create_mock_accept(VALID_ECDH)
        const parsed = parse_ecdh_message(msg)

        st.equal(parsed.data.idx, VALID_ECDH.idx, 'idx is parsed correctly')
        st.deepEqual(parsed.data.members, VALID_ECDH.members, 'members are parsed correctly')
        st.end()
      })

      // Test parse_ecdh_message - error cases
      t.test('parse_ecdh_message() with invalid data', st => {
        // Invalid JSON
        const invalidJson = create_mock_request('not valid json')
        st.throws(() => parse_ecdh_message(invalidJson), /ecdh message failed validation/, 'throws on invalid JSON')

        // Missing required field
        const missingField = create_mock_request(JSON.stringify({ idx: 1 }))
        st.throws(() => parse_ecdh_message(missingField), /ecdh message failed validation/, 'throws on missing field')

        // Invalid hex in entries
        const invalidHex = create_mock_request(JSON.stringify({
          ...VALID_ECDH,
          entries : [{ ecdh_pk: VALID_ECDH.entries[0].ecdh_pk, keyshare : 'not-hex' }]
        }))
        st.throws(() => parse_ecdh_message(invalidHex), /ecdh message failed validation/, 'throws on invalid hex')

        st.end()
      })

      // Test parse_session_message - success case
      t.test('parse_session_message() with valid data', st => {
        const msg = create_mock_request(JSON.stringify(VALID_SESSION))
        const parsed = parse_session_message(msg)

        st.equal(parsed.data.sid, VALID_SESSION.sid, 'sid is parsed correctly')
        st.equal(parsed.data.gid, VALID_SESSION.gid, 'gid is parsed correctly')
        st.deepEqual(parsed.data.members, VALID_SESSION.members, 'members are parsed correctly')
        st.end()
      })

      // Test parse_session_message - error cases
      t.test('parse_session_message() with invalid data', st => {
        // Invalid JSON
        const invalidJson = create_mock_request('{ broken }')
        st.throws(() => parse_session_message(invalidJson), /session message failed validation/, 'throws on invalid JSON')

        // Wrong type for members
        const wrongType = create_mock_request(JSON.stringify({
          ...VALID_SESSION,
          members : 'not-an-array'
        }))
        st.throws(() => parse_session_message(wrongType), /session message failed validation/, 'throws on wrong type')

        st.end()
      })

      // Test parse_psig_message - success case (accept format)
      t.test('parse_psig_message() with valid data', st => {
        const msg = create_mock_accept(VALID_PSIG)
        const parsed = parse_psig_message(msg)

        st.equal(parsed.data.idx, VALID_PSIG.idx, 'idx is parsed correctly')
        st.equal(parsed.data.sid, VALID_PSIG.sid, 'sid is parsed correctly')
        st.equal(parsed.data.pubkey, VALID_PSIG.pubkey, 'pubkey is parsed correctly')
        st.end()
      })

      // Test parse_psig_message - error cases
      t.test('parse_psig_message() with invalid data', st => {
        // Invalid psigs format
        const invalidPsigs = create_mock_accept({
          ...VALID_PSIG,
          psigs : 'not-an-array'
        })
        st.throws(() => parse_psig_message(invalidPsigs), /signature message failed validation/, 'throws on invalid psigs')

        // Invalid pubkey length
        const invalidPubkey = create_mock_accept({
          ...VALID_PSIG,
          pubkey : HEX32  // 32 bytes instead of 33
        })
        st.throws(() => parse_psig_message(invalidPubkey), /signature message failed validation/, 'throws on invalid pubkey length')

        st.end()
      })

      // Test parse_group_pkg - success case
      t.test('parse_group_pkg() with valid data', st => {
        const parsed = parse_group_pkg(VALID_GROUP)

        st.equal(parsed.threshold, VALID_GROUP.threshold, 'threshold is parsed correctly')
        st.equal(parsed.group_pk, VALID_GROUP.group_pk, 'group_pk is parsed correctly')
        st.equal(parsed.members.length, 1, 'members array is parsed correctly')
        st.end()
      })

      // Test parse_group_pkg - error cases
      t.test('parse_group_pkg() with invalid data', st => {
        // Null input
        st.throws(() => parse_group_pkg(null), /group package failed validation/, 'throws on null')

        // Missing members
        st.throws(() => parse_group_pkg({ threshold: 2 }), /group package failed validation/, 'throws on missing members')

        // Invalid member structure
        st.throws(() => parse_group_pkg({
          ...VALID_GROUP,
          members : [{ idx: 1 }]  // missing required pubkey field
        }), /group package failed validation/, 'throws on invalid member')

        st.end()
      })

      // Test parse_share_pkg - success case
      t.test('parse_share_pkg() with valid data', st => {
        const parsed = parse_share_pkg(VALID_SHARE)

        st.equal(parsed.idx, VALID_SHARE.idx, 'idx is parsed correctly')
        st.equal(parsed.seckey, VALID_SHARE.seckey, 'seckey is parsed correctly')
        st.end()
      })

      // Test parse_share_pkg - error cases
      t.test('parse_share_pkg() with invalid data', st => {
        // Undefined input
        st.throws(() => parse_share_pkg(undefined), /share package failed validation/, 'throws on undefined')

        // Invalid seckey length
        st.throws(() => parse_share_pkg({
          ...VALID_SHARE,
          seckey : 'abc'  // too short
        }), /share package failed validation/, 'throws on invalid seckey length')

        // Wrong type
        st.throws(() => parse_share_pkg({
          ...VALID_SHARE,
          idx : 'not-a-number'
        }), /share package failed validation/, 'throws on wrong type')

        st.end()
      })

    } catch (err) {
      t.fail(parse_error(err))
    } finally {
      t.end()
    }
  })
}

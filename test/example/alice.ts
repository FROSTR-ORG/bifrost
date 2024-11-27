import { get_shared_secret } from '@cmdcode/nostr-p2p/lib'
import { FrostNode }         from '@frostr/bifrost'

import {
  generate_seckey,
  get_pubkey
} from '@cmdcode/frost/lib'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

const ALIAS     = 'alice'
const GROUP_ENC = 'bfgroup1q27tjd2jrfp2cv9ax8wl9ca22yrwhj2h4w54l4x2glhstfdq7qnn5qqqqqpqqqqqqypffpg3g9kgmslefg9s50l9wnwr6kscaqj4prjja7zfnuvzr9kngkczkjxw39lgx9z6hfmamr5kzaqsu9649dlcknvdd00e6u5fkfxj8dps8stp48vv22nynn8dun29yxewvd45w9x2fdqnvedj5ypdw83nnye6qqqqqqsz9uryaurs6aevce2y7ys7w70n3qcpw4k9t3skmnygqler8wfxy26sxx70s08h4y73nrypxcgaxwrlqmd3r5y54ka7y7zxf5jrdz8eeluaqgu5ftdeqtt2ffsrrncs9ct9r4grah476pf07nqsxkz9lvfup82g5qqqqqpsx654gcwjf865qvmm46pqwpatxzzvg9f32d973ladkn83uxay0cltq2aaw8x396prxht7u8zcej7hxcdy68v4g3vedww2p7nej53h3kvvyq5wms34g0jqv932xevptkqlppv3hctehcvz4q74zcwzkkv6ed8tlyctrrld'
const SHARE_ENC = 'bfshare1qqqqqqdspt6ugq2le6w9x3ds8xyhvvu3gu7tg7qq9yd9h3vr8479e927mluka499h7rerhpesvf6m7q85grxqqmuhhmvqh7zxms7um5fd50dkws9x8q5j25kua450fkmzdchl2sh5kdztf7p0etc3gm75fvcspngdykmc6'

const PEERS = [
//  '02948511416c8dc3f94a0b0a3fe574dc3d5a18e825508e52ef8499f182196d345b',
  '022f064ef070d772cc6544f121e779f388301756c55c616dcc8807f233b92622b5',
  '036a95461d249f540337bae820707ab3084c41531534be8ffadb4cf1e1ba47e3eb'
]

const RELAYS = [
  'ws://localhost:8002',
  // 'wss://relay.nostrdice.com',
  // 'wss://relay.snort.social'
]

const ECDH_SECKEY = generate_seckey()
const ECDH_PUBKEY = get_pubkey(ECDH_SECKEY)


const MESSAGE = 'FF'.repeat(32)

const group = decode_group_pkg(GROUP_ENC)
const share = decode_share_pkg(SHARE_ENC)

console.log('ecdh secret:', get_shared_secret(ECDH_SECKEY.hex, group.pubkey))

const client = new FrostNode(RELAYS, group, share)

client.event.on('init', async () => {
  console.log(`${ALIAS} is now online`)

  const res1 = await client.req_ecdh(PEERS, ECDH_PUBKEY)
  console.log('ecdh res:', res1)

  // const res2 = await client.req_sign_msg(PEERS, MESSAGE)
  // console.log('sign msg res:', res2)
})

client.connect()

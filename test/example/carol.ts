import { generate_seckey, get_pubkey } from '@cmdcode/frost/lib'
import { FrostNode } from '@frostr/bifrost'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

const ALIAS     = 'carol'
const GROUP_ENC = 'bfgroup1q27tjd2jrfp2cv9ax8wl9ca22yrwhj2h4w54l4x2glhstfdq7qnn5qqqqqpqqqqqqypffpg3g9kgmslefg9s50l9wnwr6kscaqj4prjja7zfnuvzr9kngkczkjxw39lgx9z6hfmamr5kzaqsu9649dlcknvdd00e6u5fkfxj8dps8stp48vv22nynn8dun29yxewvd45w9x2fdqnvedj5ypdw83nnye6qqqqqqsz9uryaurs6aevce2y7ys7w70n3qcpw4k9t3skmnygqler8wfxy26sxx70s08h4y73nrypxcgaxwrlqmd3r5y54ka7y7zxf5jrdz8eeluaqgu5ftdeqtt2ffsrrncs9ct9r4grah476pf07nqsxkz9lvfup82g5qqqqqpsx654gcwjf865qvmm46pqwpatxzzvg9f32d973ladkn83uxay0cltq2aaw8x396prxht7u8zcej7hxcdy68v4g3vedww2p7nej53h3kvvyq5wms34g0jqv932xevptkqlppv3hctehcvz4q74zcwzkkv6ed8tlyctrrld'
const SHARE_ENC = 'bfshare1qqqqqqay7lavclww9scckuu7psh3yla2w5jza5npvx6ed409yk09j33m8haa3de99k9euq7m03748maxe9a2qd8pu5vpc2yw4eya6rfa976wauuamja2h9228kvuuxjvlvmx9l69tnly5uv3senvhlsw2e772gaugg5x3a'

const RELAYS = [
  'ws://localhost:8002',
  // 'wss://relay.nostrdice.com',
  // 'wss://relay.snort.social'
]

const group = decode_group_pkg(GROUP_ENC)
const share = decode_share_pkg(SHARE_ENC)

const client = new FrostNode(RELAYS, group, share)

client.event.on('init', async () => {
  console.log(`${ALIAS} is now online`)
})

client.connect()

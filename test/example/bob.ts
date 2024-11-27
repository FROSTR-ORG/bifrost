import { generate_seckey, get_pubkey } from '@cmdcode/frost/lib'
import { FrostNode } from '@frostr/bifrost'

import {
  decode_group_pkg,
  decode_share_pkg
} from '@frostr/bifrost/api'

const ALIAS     = 'bob'
const GROUP_ENC = 'bfgroup1q27tjd2jrfp2cv9ax8wl9ca22yrwhj2h4w54l4x2glhstfdq7qnn5qqqqqpqqqqqqypffpg3g9kgmslefg9s50l9wnwr6kscaqj4prjja7zfnuvzr9kngkczkjxw39lgx9z6hfmamr5kzaqsu9649dlcknvdd00e6u5fkfxj8dps8stp48vv22nynn8dun29yxewvd45w9x2fdqnvedj5ypdw83nnye6qqqqqqsz9uryaurs6aevce2y7ys7w70n3qcpw4k9t3skmnygqler8wfxy26sxx70s08h4y73nrypxcgaxwrlqmd3r5y54ka7y7zxf5jrdz8eeluaqgu5ftdeqtt2ffsrrncs9ct9r4grah476pf07nqsxkz9lvfup82g5qqqqqpsx654gcwjf865qvmm46pqwpatxzzvg9f32d973ladkn83uxay0cltq2aaw8x396prxht7u8zcej7hxcdy68v4g3vedww2p7nej53h3kvvyq5wms34g0jqv932xevptkqlppv3hctehcvz4q74zcwzkkv6ed8tlyctrrld'
const SHARE_ENC = 'bfshare1qqqqqq42s9uys0ukl4nw7h98ytwygkvamcc8rffsc4nljnd5xxx44mwdpcv9tluj4gkshdzcrceruqt3f4z88kdadtkqtjk2e4l7973hlyarrxdkgwlz0u7pm6gr4tasut7uhrcajtdal0eqqx7r0p0zpt6ml9sa370axx'

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

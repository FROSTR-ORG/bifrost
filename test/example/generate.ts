import { generate_seckey, get_pubkey }  from '@cmdcode/frost/lib'

import { generate_key_set } from '@frostr/bifrost/api'

const seckey = generate_seckey()
const pubkey = get_pubkey(seckey)

console.log('seckey:', seckey.hex)
console.log('pubkey:', pubkey)

const threshold = 2
const share_ct  = 3

const keyset = generate_key_set(threshold, share_ct, [ seckey.hex ])

console.dir(keyset, { depth: null })

export { keyset }

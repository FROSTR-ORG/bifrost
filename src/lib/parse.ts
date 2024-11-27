import { parse_message }      from '@cmdcode/nostr-p2p/lib'
import { derive_ecdh_secret } from '@cmdcode/frost/lib'

import type { EventMessage } from '@cmdcode/nostr-p2p'

import Schema from '@/schema/index.js'

export function parse_ecdh_response (
  responses : EventMessage[]
) {
  const schema = Schema.pkg.ecdh_pkg
  const shares = responses.map(e => {
    const parsed = parse_message(e, schema)
    if (parsed === null) throw new Error('response failed validation')
    return { idx: parsed.dat.idx, pubkey: parsed.dat.pubshare }
  })
  return derive_ecdh_secret(shares)
}

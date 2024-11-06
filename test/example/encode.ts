import { keyset } from './generate.js'

const encoded_shares = encode_share_pkg(keyset.shares)

console.log('encoded shares:', encoded_shares)

const encoded_group  = encode_group_pkg(keyset.group)

console.log('encoded group:', encoded_group)

const decoded_shares = encoded_shares.map(e => decode_share_pkg(e))

console.log('decoded shares:', encoded_shares)

const decoded_group  = decode_group_pkg(encoded_group)

console.log('decoded group:', encoded_group)

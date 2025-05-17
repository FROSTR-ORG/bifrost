import * as CredEncoder  from './cred.js'
import * as GroupEncoder from './group.js'
import * as ShareEncoder from './share.js'

export * from './cred.js'
export * from './group.js'
export * from './share.js'

export namespace PackageEncoder {

  export const cred = {
    encode : CredEncoder.encode_credentials,
    decode : CredEncoder.decode_credentials
  }

  export const group = {
    encode      : GroupEncoder.encode_group_pkg,
    decode      : GroupEncoder.decode_group_pkg,
    serialize   : GroupEncoder.serialize_group_data,
    deserialize : GroupEncoder.deserialize_group_data
  }

  export const share = {
    encode      : ShareEncoder.encode_share_pkg,
    decode      : ShareEncoder.decode_share_pkg,
    serialize   : ShareEncoder.serialize_share_data,
    deserialize : ShareEncoder.deserialize_share_data
  }
}
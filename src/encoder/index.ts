import * as GroupEncoder   from './group.js'
import * as OnboardEncoder from './onboard.js'
import * as ShareEncoder   from './share.js'

export * from './group.js'
export * from './onboard.js'
export * from './share.js'

export namespace PackageEncoder {

  export const group = {
    encode      : GroupEncoder.encode_group_package,
    decode      : GroupEncoder.decode_group_package,
    serialize   : GroupEncoder.serialize_group_data,
    deserialize : GroupEncoder.deserialize_group_data
  }

  export const onboard = {
    encode      : OnboardEncoder.encode_onboard_package,
    decode      : OnboardEncoder.decode_onboard_package,
    serialize   : OnboardEncoder.serialize_onboard_data,
    deserialize : OnboardEncoder.deserialize_onboard_data
  }

  export const share = {
    encode      : ShareEncoder.encode_share_package,
    decode      : ShareEncoder.decode_share_package,
    serialize   : ShareEncoder.serialize_share_data,
    deserialize : ShareEncoder.deserialize_share_data
  }
}
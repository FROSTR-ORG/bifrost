import { Buff }            from '@cmdcode/buff'
import { is_group_member } from '@/lib/group.js'
import { Assert }          from '@/util/index.js'

import {
  deserialize_group_data,
  serialize_group_data
} from './group.js'

import {
  deserialize_share_data,
  serialize_share_data
} from './share.js'

import type {
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

import * as CONST from '@/const.js'

const SPLIT_IDX = CONST.SHARE_DATA_SIZE

/**
 * Encode a set of credentials.
 * 
 * @param group_pkg - The group package.
 * @param share_pkg - The share package.
 * @returns The encoded credentials.
 */
export function encode_credentials (
  group_pkg : GroupPackage,
  share_pkg : SharePackage
) : string {
  Assert.ok(is_group_member(group_pkg, share_pkg), 'share not included in group')
  const group = serialize_group_data(group_pkg)
  const share = serialize_share_data(share_pkg)
  const cred  = Buff.join([ share, group ])
  return cred.to_bech32m('bfcred')
}

/**
 * Decode a set of credentials.
 * 
 * @param groupstr - The group package to decode.
 * @param sharestr - The share package to decode.
 * @returns The decoded credentials.
 */
export function decode_credentials (
  credstr : string
) : { group : GroupPackage, share : SharePackage } {
  const bytes = Buff.bech32m(credstr)
  const sdata = bytes.slice(0, SPLIT_IDX)
  const gdata = bytes.slice(SPLIT_IDX)
  const group = deserialize_group_data(gdata)
  const share = deserialize_share_data(sdata)
  Assert.ok(is_group_member(group, share), 'share not included in group')
  return { group, share }
}

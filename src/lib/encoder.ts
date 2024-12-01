import { Buff }   from '@cmdcode/buff'
import { Assert } from '@/util/index.js'

import type {
  CommitPackage
} from '@/types/index.js'

import * as CONST from '@/const.js'

export function serialize_commit_pkg (
  pkg : CommitPackage
) : Uint8Array {
  const idx = Buff.num(pkg.idx,       CONST.COMMIT_INDEX_SIZE)
  const spk = Buff.hex(pkg.pubkey,    CONST.COMMIT_PUBKEY_SIZE)
  const bpn = Buff.hex(pkg.binder_pn, CONST.COMMIT_PNONCE_SIZE)
  const hpn = Buff.hex(pkg.hidden_pn, CONST.COMMIT_PNONCE_SIZE)
  return Buff.join([ idx, spk, bpn, hpn ])
}

export function deserialize_commit_pkg (
  data : Uint8Array
) : CommitPackage {
  const stream    = new Buff(data).stream
  Assert.size(stream.data, CONST.COMMIT_DATA_SIZE)
  const idx       = stream.read(CONST.COMMIT_INDEX_SIZE).num
  const pubkey    = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  const binder_pn = stream.read(CONST.COMMIT_PNONCE_SIZE).hex
  const hidden_pn = stream.read(CONST.COMMIT_PNONCE_SIZE).hex
  Assert.size(stream.data, 0)
  return { idx, binder_pn, hidden_pn, pubkey }
}
